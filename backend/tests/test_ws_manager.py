"""Push do WebSocket de grupo (app/ws_manager.py).

O envio para cada conexao faz await (rede), e nesse intervalo outra pessoa
pode abrir ou fechar a tela do mesmo grupo. Alem disso, o push e so um aviso
para o app buscar de novo: falhar nele nunca pode desfazer, nem parecer que
desfez, uma escrita que ja foi gravada no banco.
"""

import asyncio

from app.ws_manager import GroupConnectionManager


class FakeSocket:
    def __init__(self) -> None:
        self.received: list[dict] = []

    async def accept(self) -> None:
        pass

    async def send_json(self, message: dict) -> None:
        await asyncio.sleep(0.01)  # simula a rede: cede o loop para outras tarefas
        self.received.append(message)


def test_broadcast_survives_someone_connecting_mid_send():
    async def scenario():
        manager = GroupConnectionManager()
        first, second = FakeSocket(), FakeSocket()
        await manager.connect(1, first)
        await manager.connect(1, second)

        async def newcomer():
            await asyncio.sleep(0.005)  # chega enquanto o primeiro envio ainda espera a rede
            await manager.connect(1, FakeSocket())

        joining = asyncio.create_task(newcomer())
        await manager.broadcast(1, {"type": "message_created"})
        await joining
        return first, second, manager

    first, second, manager = asyncio.run(scenario())
    assert first.received == [{"type": "message_created"}]
    assert second.received == [{"type": "message_created"}]
    assert len(manager.active[1]) == 3


def test_broadcast_survives_someone_disconnecting_mid_send():
    async def scenario():
        manager = GroupConnectionManager()
        sockets = [FakeSocket(), FakeSocket(), FakeSocket()]
        for socket in sockets:
            await manager.connect(1, socket)

        async def leaver():
            await asyncio.sleep(0.005)
            manager.disconnect(1, sockets[2])

        leaving = asyncio.create_task(leaver())
        await manager.broadcast(1, {"type": "post_created"})
        await leaving
        return manager

    manager = asyncio.run(scenario())
    assert len(manager.active[1]) == 2


def test_message_is_saved_and_returned_even_if_the_push_fails(client, make_user, monkeypatch):
    from app.ws_manager import manager

    make_user("ana", "Ana")
    group = client.post("/groups", json={"name": "Treino", "city": "SP"}).json()["id"]

    async def broken_broadcast(group_id, message):
        raise RuntimeError("falha no push")

    monkeypatch.setattr(manager, "broadcast", broken_broadcast)

    response = client.post(f"/groups/{group}/messages", json={"text": "Oi"})
    assert response.status_code == 200, response.text
    # A mensagem foi gravada uma vez so: quem recebe 500 aqui reenvia e duplica.
    assert [m["text"] for m in client.get(f"/groups/{group}/messages").json()] == ["Oi"]
