"""Regras comuns das listagens: tamanho maximo de pagina e quem aparece.

Bug real encontrado na analise de 30/09: private_profile era respeitado nas
rotas diretas (/users/{id}, /activities/user/{id}) e no ranking global, mas
as corridas de uma conta privada continuavam no feed global - com a rota
GPS, que pode revelar onde a pessoa mora - e em /activities/by-users e
/users/by-ids. Toda listagem que mistura usuarios passa por visible_to().
"""

from sqlalchemy import or_

from app.models import User

MAX_PAGE_SIZE = 100


def page_size(limit: int) -> int:
    """Corta em vez de rejeitar: uma tela que peca mais (ex.: "ver mais" do
    ranking) continua funcionando, so recebe no maximo MAX_PAGE_SIZE."""
    return max(1, min(limit, MAX_PAGE_SIZE))


def visible_to(viewer_uid: str):
    """Perfis publicos, mais o proprio usuario (quem e privado continua
    vendo as proprias corridas no feed)."""
    return or_(User.private_profile.is_(False), User.uid == viewer_uid)
