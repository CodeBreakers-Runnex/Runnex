from fastapi import WebSocket


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
        for connection in connections:
            try:
                await connection.send_json(message)
            except Exception:
                dead.append(connection)
        for connection in dead:
            self.disconnect(group_id, connection)


manager = GroupConnectionManager()
