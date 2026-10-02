"""Treinador virtual (chatbot de corrida).

O motor e app/chatbot_logic.py; aqui fica so a ponte com o banco: carrega a
memoria da conversa (chatbot_profiles) e um retrato dos dados do usuario
(corridas e meta semanal), responde e grava o que mudou.
"""

import copy
from datetime import timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app import chatbot_logic
from app.auth import FirebaseUser, get_current_user
from app.database import get_db
from app.models import Activity, ChatbotProfile
from app.rate_limit import rate_limit
from app.schemas_chatbot import ChatMessageIn, ChatMessageOut
from app.services.activity_effects import get_or_create_user

router = APIRouter(prefix="/chatbot", tags=["chatbot"])

# Campos escalares de EstadoConversa, com o mesmo nome em ChatbotProfile.
_CAMPOS_ESTADO = (
    "pace_informado",
    "distancia_frequente",
    "objetivo_principal",
    "nivel",
    "aguardando_aprofundamento",
    "ultimo_topico_explicado",
)


def _carregar_corridas(db: Session, user_id: str) -> list[chatbot_logic.Corrida]:
    """Todas as corridas, como getUserStats faz no app, para os totais
    baterem com a tela de estatisticas. So as colunas usadas: route (a rota
    inteira em JSON) e de longe a mais pesada da tabela."""
    rows = (
        db.query(Activity.distance, Activity.duration_seconds, Activity.created_at, Activity.calories)
        .filter(Activity.user_id == user_id, Activity.distance > 0, Activity.duration_seconds > 0)
        .order_by(Activity.created_at.desc())
        .all()
    )
    return [
        chatbot_logic.Corrida(
            distancia_km=row.distance,
            duracao_s=row.duration_seconds,
            quando=row.created_at,
            calorias=row.calories,
        )
        for row in rows
    ]


def _estado_da_conversa(profile: ChatbotProfile | None) -> chatbot_logic.EstadoConversa:
    if profile is None:
        return chatbot_logic.EstadoConversa()
    # deepcopy: o motor altera o dict in-place. Sem a copia, o valor "novo"
    # seria o mesmo objeto ja carregado e o SQLAlchemy nao veria mudanca.
    return chatbot_logic.EstadoConversa(
        **{campo: getattr(profile, campo) for campo in _CAMPOS_ESTADO},
        respostas_aprendidas=copy.deepcopy(profile.respostas_aprendidas or {}),
    )


@router.post("/message", response_model=ChatMessageOut, dependencies=[Depends(rate_limit("chatbot", 30, 60))])
def send_message(
    payload: ChatMessageIn,
    db: Session = Depends(get_db),
    current_user: FirebaseUser = Depends(get_current_user),
):
    # Mesmo auto-provisionamento de POST /activities e do pet: contas Google
    # podem chegar aqui antes de qualquer outro fluxo ter criado o perfil.
    user = get_or_create_user(db, current_user.uid, "Corredor", None)

    dados = chatbot_logic.DadosDoApp(
        nome=user.display_name.split()[0] if user.display_name and user.display_name.strip() else None,
        corridas=_carregar_corridas(db, user.uid),
        meta_semanal_km=user.weekly_goal_km,
        fuso=timezone(timedelta(minutes=payload.utc_offset_minutes)),
    )
    profile = db.get(ChatbotProfile, user.uid)
    estado = _estado_da_conversa(profile)

    resposta = chatbot_logic.responder(payload.message, estado, dados)

    if profile is None:
        profile = ChatbotProfile(user_id=user.uid)
        db.add(profile)
    for campo in _CAMPOS_ESTADO:
        setattr(profile, campo, getattr(estado, campo))
    profile.respostas_aprendidas = estado.respostas_aprendidas
    if resposta.nova_meta_semanal_km is not None:
        user.weekly_goal_km = resposta.nova_meta_semanal_km
    db.commit()

    return ChatMessageOut(reply=resposta.texto)
