import logging

from anyio import from_thread
from fastapi import WebSocket

logger = logging.getLogger(__name__)


class GroupConnectionManager:
    """Conexoes WebSocket ativas por grupo — substitui o polling de 15s do
    frontend (chat, feed de posts, comentarios) por push imediato.

    Escopo por grupo (nao por post/mensagem individual) porque a tela de
    grupo mantem uma unica conexao por vez: mais simples e barato do que uma
    conexao por sub-recurso, e o evento carrega o suficiente pro frontend
    decidir se precisa re-buscar algo."""

    def __init__(self) -> None:
        self.active: dict[int, set[WebSocket]] = {}

    async def connect(self, group_id: int, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active.setdefault(group_id, set()).add(websocket)

    def disconnect(self, group_id: int, websocket: WebSocket) -> None:
        connections = self.active.get(group_id)
        if not connections:
            return
        connections.discard(websocket)
        if not connections:
            self.active.pop(group_id, None)

    async def broadcast(self, group_id: int, message: dict) -> None:
        connections = self.active.get(group_id)
        if not connections:
            return
        dead: list[WebSocket] = []
        # Copia: cada send_json cede o loop, e nesse intervalo alguem pode
        # abrir ou fechar a tela do grupo, mudando o set durante a iteracao
        # ("Set changed size during iteration").
        for connection in list(connections):
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)
        for connection in dead:
            self.disconnect(group_id, connection)

    def broadcast_from_thread(self, group_id: int, message: dict) -> None:
        """Para rotas sincronas (def): o FastAPI as roda numa thread do pool,
        e o envio volta para o loop de eventos, dono das conexoes.

        Best-effort: a rota chama isto depois do commit. Se o push falhar e a
        excecao subir, o app recebe 500 de uma escrita ja gravada e a pessoa
        reenvia (mensagem duplicada). Quem perdeu o aviso recebe a mudanca no
        polling de seguranca do app."""
        try:
            from_thread.run(self.broadcast, group_id, message)
        except Exception:
            logger.exception("Falha ao avisar o grupo %s pelo WebSocket", group_id)


manager = GroupConnectionManager()
