from datetime import datetime, timedelta, timezone

import pytest

from app import chatbot_logic
from app.chatbot_logic import Corrida, DadosDoApp, EstadoConversa, responder
from app.models import ChatbotProfile
from tests.helpers import run_payload

AGORA = datetime(2026, 9, 28, 12, 0, tzinfo=timezone.utc)
BRASILIA = timezone(timedelta(hours=-3))


def corrida(dias_atras: float, km: float, minutos: float) -> Corrida:
    return Corrida(distancia_km=km, duracao_s=int(minutos * 60), quando=AGORA - timedelta(days=dias_atras))


def perguntar(mensagem: str, *, corridas=(), meta=None, estado=None):
    dados = DadosDoApp(nome="Ana", corridas=list(corridas), meta_semanal_km=meta, agora=AGORA, fuso=BRASILIA)
    return responder(mensagem, estado if estado is not None else EstadoConversa(), dados)


# --- motor (sem banco) ------------------------------------------------------


def test_pace_min_seg_nao_vira_decimal():
    pace, _ = chatbot_logic.extrair_pace_e_distancia("meu pace é 4:25")
    assert chatbot_logic.formatar_pace(pace) == "4:25"


def test_horario_nao_vira_pace():
    assert chatbot_logic.extrair_pace_e_distancia("treino às 6:30 da manhã")[0] is None


@pytest.mark.parametrize(
    ("mensagem", "distancia", "objetivo"),
    [
        # Regressao: "meia maratona" contem "maratona" e virava 42,2 km
        ("quanto tempo eu faria uma meia maratona?", 21.0975, "meia_maratona"),
        ("quero correr a meia-maratona", 21.0975, "meia_maratona"),
        ("quanto tempo na maratona?", 42.195, "maratona"),
        # Regressao: "15km" contem "5km" e virava 5 km
        ("quanto tempo eu faria 15km?", 15.0, None),
        ("treino pra 5k", 5.0, "5k"),
    ],
)
def test_distancia_e_objetivo_da_prova(mensagem, distancia, objetivo):
    assert chatbot_logic.extrair_pace_e_distancia(mensagem)[1] == distancia
    assert chatbot_logic.detectar_objetivo(mensagem) == objetivo


def test_pace_na_meia_maratona_nao_projeta_42km():
    texto = perguntar("meu pace é 5:10, quanto tempo eu faria uma meia maratona?").texto
    assert "21.1km" in texto and "1h49min" in texto


def test_estatisticas_saem_das_corridas_do_app():
    texto = perguntar("minhas estatísticas", corridas=[corrida(1, 5, 30), corrida(2, 10, 50)]).texto
    assert "Corridas: 2" in texto
    assert "Distância total: 15.0 km" in texto
    assert "Pace médio: 5:20" in texto  # 80 min / 15 km


def test_sem_corridas_aponta_para_a_tela_de_corrida():
    assert "Correr" in perguntar("minhas estatísticas").texto


def test_zonas_usam_pace_das_corridas_quando_nao_informado():
    texto = perguntar("quais minhas zonas de treino?", corridas=[corrida(1, 5, 25)]).texto
    assert "5:00 min/km" in texto
    assert "pace médio das suas últimas corridas" in texto


def test_pace_informado_vence_as_corridas():
    estado = EstadoConversa()
    perguntar("meu pace é 4:30", corridas=[corrida(1, 5, 30)], estado=estado)
    texto = perguntar("quanto tempo eu faria 10km?", corridas=[corrida(1, 5, 30)], estado=estado).texto
    assert "45min00s" in texto
    assert "pace médio" not in texto


def test_meus_recordes_mostra_dados_e_bater_recorde_da_dicas():
    corridas = [corrida(1, 5, 25), corrida(2, 5.1, 30), corrida(3, 0.3, 1)]
    texto = perguntar("quais são meus recordes?", corridas=corridas).texto
    assert "5 km: 5:00 min/km" in texto
    assert "Melhor pace: 5:00" in texto  # os 300 m a 3:20/km nao contam

    dica = perguntar("como bater meu recorde?", corridas=corridas).texto
    assert dica == chatbot_logic.CONHECIMENTO["batendo_recordes"]["curta"]


def test_meta_pelo_chat_devolve_meta_semanal():
    resposta = perguntar("meta: 25 km", corridas=[corrida(1, 5, 30)])
    assert resposta.nova_meta_semanal_km == 25
    assert "5.0 km" in resposta.texto


@pytest.mark.parametrize("mensagem", ["meta: 0", "meta: 900", "meta: muito"])
def test_meta_invalida_nao_altera_perfil(mensagem):
    assert perguntar(mensagem).nova_meta_semanal_km is None


def test_progresso_da_meta_semanal():
    texto = perguntar("qual minha meta?", corridas=[corrida(1, 5, 30), corrida(10, 20, 120)], meta=20).texto
    assert "Últimos 7 dias: 5.0 km (25%)" in texto  # a corrida de 10 dias atras fica fora
    assert "Faltam 15.0 km" in texto


def test_janela_de_7_dias_segue_o_fuso_do_usuario():
    # 22/09 01:00 UTC ainda e 21/09 em Brasilia: fora da janela 22-28/09 local.
    borda = Corrida(distancia_km=8, duracao_s=2400, quando=datetime(2026, 9, 22, 1, 0, tzinfo=timezone.utc))
    base = dict(nome="Ana", corridas=[corrida(1, 5, 30), borda], agora=AGORA)
    assert chatbot_logic.km_ultimos_7_dias(DadosDoApp(**base, fuso=BRASILIA)) == 5
    assert chatbot_logic.km_ultimos_7_dias(DadosDoApp(**base, fuso=timezone.utc)) == 13


def test_registrar_manda_para_o_gps():
    assert "GPS" in perguntar("registrar: 5, 30").texto


def test_aprender_tem_limite():
    estado = EstadoConversa()
    for i in range(chatbot_logic.MAX_RESPOSTAS_APRENDIDAS):
        perguntar(f"aprender: pergunta {i} | resposta {i}", estado=estado)
    assert "limite" in perguntar("aprender: mais uma | nao cabe", estado=estado).texto
    assert len(estado.respostas_aprendidas) == chatbot_logic.MAX_RESPOSTAS_APRENDIDAS


def test_saudacao_cita_a_ultima_corrida():
    texto = perguntar("oi", corridas=[corrida(1, 5.2, 29.5)]).texto
    assert texto.startswith("Olá, Ana!")
    assert "5.2 km a 5:40 min/km (ontem)" in texto


# --- API ----------------------------------------------------------------------


def chat(client, message: str, **extra):
    return client.post("/chatbot/message", json={"message": message, **extra})


def test_exige_login(client):
    assert chat(client, "oi").status_code in (401, 403)


def test_usa_corridas_reais_do_usuario(client, make_user):
    make_user("ana", "Ana Souza")
    for _ in range(2):
        assert client.post("/activities", json=run_payload("ana", km=5.0, seconds=1800)).status_code == 200

    response = chat(client, "minhas estatísticas")
    assert response.status_code == 200, response.text
    reply = response.json()["reply"]
    assert "Corridas: 2" in reply
    assert "Distância total: 10.0 km" in reply
    assert "Pace médio: 6:00" in reply
    assert chat(client, "oi").json()["reply"].startswith("Olá, Ana!")


def test_nao_ve_corridas_de_outra_pessoa(client, make_user):
    make_user("bruno")
    client.post("/activities", json=run_payload("bruno"))
    make_user("ana")
    assert "ainda não tem corridas" in chat(client, "minhas estatísticas").json()["reply"]


def test_meta_pelo_chat_vira_meta_do_perfil(client, make_user):
    make_user("ana")
    assert chat(client, "meta: 30").status_code == 200
    assert client.get("/users/ana").json()["weeklyGoalKm"] == 30


def test_memoria_persiste_entre_mensagens(client, make_user):
    make_user("ana")
    chat(client, "meu pace é 5:00")
    assert "50min00s" in chat(client, "quanto tempo eu faria 10km?").json()["reply"]


def test_respostas_aprendidas_sao_por_usuario(client, make_user, login):
    make_user("bruno")
    make_user("ana")
    chat(client, "aprender: qual meu tenis | Um de placa")
    assert chat(client, "qual meu tenis").json()["reply"] == "Um de placa"

    login("bruno")
    assert chat(client, "qual meu tenis").json()["reply"] != "Um de placa"


def test_cria_perfil_se_ainda_nao_existir(client, login):
    login("nova")
    assert chat(client, "oi").status_code == 200


@pytest.mark.parametrize("body", [{"message": "   "}, {"message": "oi", "utcOffsetMinutes": 5000}])
def test_rejeita_entrada_invalida(client, make_user, body):
    make_user("ana")
    assert client.post("/chatbot/message", json=body).status_code == 422


def test_excluir_conta_apaga_memoria_do_chatbot(client, make_user, db):
    make_user("ana")
    chat(client, "meu pace é 5:00")
    assert db.query(ChatbotProfile).filter_by(user_id="ana").count() == 1

    assert client.delete("/users/ana").status_code == 204
    assert db.query(ChatbotProfile).filter_by(user_id="ana").count() == 0
