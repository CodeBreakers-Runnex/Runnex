"""Hidratação e alimentação no treinador virtual (chat reativo).

Dois cuidados guiam estes testes:
- Colisão: o motor casa por palavra-chave e a primeira regra que bate ganha.
  Perguntas de comida e bebida não podem cair antes em "quanto tempo" (pedido
  de pace), "última corrida" (histórico) ou nos tópicos de treino ("ritmo",
  "meia", "recuperação"), nem o contrário: "gelo" e "sedentário" não são
  pergunta de nutrição.
- Conteúdo: só entra o que foi conferido nas diretrizes (30 a 60 g de
  carboidrato por hora em esforços acima de 1 hora; proteína de boa qualidade
  em até 2 horas depois; hidratação individualizada). Nada de litros, ml,
  calorias ou peso.
"""

import random
import re
from datetime import datetime, timedelta, timezone

import pytest

from app import chatbot_logic
from app.chatbot_logic import CONHECIMENTO, Corrida, DadosDoApp, EstadoConversa, responder, texto_reposicao
from tests.helpers import run_payload

AGORA = datetime(2026, 9, 28, 12, 0, tzinfo=timezone.utc)
BRASILIA = timezone(timedelta(hours=-3))
AVISO = "não substitui nutricionista"
POR_HORA = "30 a 60 g de carboidrato por hora"
# Valores que o plano proíbe: volume, calorias e qualquer coisa por peso.
PROIBIDO = re.compile(r"\b\d+(?:[.,]\d+)?\s*(?:ml|l|litros?|kcal|calorias?|kg)\b|g/kg|por quilo", re.IGNORECASE)


def corrida(dias_atras: float, km: float, minutos: float) -> Corrida:
    return Corrida(distancia_km=km, duracao_s=int(minutos * 60), quando=AGORA - timedelta(days=dias_atras))


def perguntar(mensagem: str, *, corridas=(), estado=None):
    dados = DadosDoApp(nome="Ana", corridas=list(corridas), meta_semanal_km=20, agora=AGORA, fuso=BRASILIA)
    return responder(mensagem, estado if estado is not None else EstadoConversa(), dados)


def chat(client, mensagem: str):
    return client.post("/chatbot/message", json={"message": mensagem})


ULTIMAS = [corrida(1, 10.0, 55), corrida(3, 5.0, 30)]


# --- colisão: nutrição não pode cair em outra regra -------------------------


def test_quanto_tempo_depois_de_correr_nao_vira_pedido_de_pace():
    # "quanto tempo" é palavra-chave do cálculo de tempo estimado.
    resposta = perguntar("quanto tempo depois da corrida devo comer?", corridas=ULTIMAS).texto
    assert "Me diga seu pace" not in resposta
    assert AVISO in resposta


def test_ultima_corrida_na_pergunta_nao_vira_historico():
    # "última corrida" é palavra-chave do histórico.
    dados = DadosDoApp(nome="Ana", corridas=ULTIMAS, agora=AGORA, fuso=BRASILIA)
    resposta = perguntar("o que comer depois da minha última corrida?", corridas=ULTIMAS).texto
    assert resposta != chatbot_logic.texto_historico(dados)
    assert not resposta.startswith("Suas últimas corridas")
    assert AVISO in resposta


def test_ritmo_na_pergunta_nao_vira_treino_de_ritmo():
    resposta = perguntar("o que beber depois de correr em ritmo de prova?", corridas=ULTIMAS).texto
    assert CONHECIMENTO["treino_ritmo"]["curta"] not in resposta
    assert AVISO in resposta


def test_recuperacao_na_pergunta_nao_vira_treino_de_recuperacao():
    resposta = perguntar("o que comer para a recuperação depois do longão?", corridas=ULTIMAS).texto
    assert CONHECIMENTO["treino_recuperacao"]["curta"] not in resposta
    assert AVISO in resposta


def test_gel_na_meia_maratona_nao_vira_meia_maratona():
    resposta = perguntar("devo tomar gel na meia maratona?").texto
    assert CONHECIMENTO["meia_maratona"]["curta"] not in resposta
    assert POR_HORA in resposta


def test_o_que_e_isotonico_nao_vira_explicacao_de_pace():
    resposta = perguntar("o que é isotônico?").texto
    assert "Pace é o tempo por quilômetro" not in resposta
    assert AVISO in resposta


def test_saudacao_junto_da_pergunta_responde_a_pergunta():
    resposta = perguntar("oi, o que posso comer depois de correr?", corridas=ULTIMAS).texto
    assert not resposta.startswith("Olá")
    assert AVISO in resposta


def test_resposta_ensinada_pelo_usuario_continua_ganhando():
    estado = EstadoConversa()
    perguntar("aprender: o que comer depois da corrida | banana com aveia", estado=estado)
    assert perguntar("o que comer depois da corrida", estado=estado).texto == "banana com aveia"


@pytest.mark.parametrize(
    "mensagem", ["como cuidar da dor no pé com gelo?", "sou sedentário, por onde começar?", "tem carbono na pista?"]
)
def test_palavras_parecidas_nao_sao_pergunta_de_nutricao(mensagem):
    # \b nas palavras-chave: "gel" não pode casar com "gelo", nem "sede" com "sedentário".
    assert AVISO not in perguntar(mensagem).texto


# --- o que já funcionava continua igual ---------------------------------------


@pytest.mark.parametrize(
    ("mensagem", "comeca_com"),
    [
        ("meus recordes", "Seus recordes"),
        ("minhas últimas corridas", "Suas últimas corridas"),
        ("minhas estatísticas", "Suas estatísticas"),
        ("qual minha meta semanal", "Meta semanal"),
        ("oi", "Olá, Ana!"),
    ],
)
def test_perguntas_sobre_os_proprios_dados_continuam_iguais(mensagem, comeca_com):
    assert perguntar(mensagem, corridas=ULTIMAS).texto.startswith(comeca_com)


def test_agradecimento_continua_igual():
    # A resposta é sorteada de uma lista; qualquer uma delas serve.
    assert perguntar("obrigado").texto in chatbot_logic._AGRADECIMENTOS


def test_calculo_de_tempo_continua_igual():
    # A redação é sorteada; o que importa é o cálculo (10 km a 5:00 = 50 min).
    assert "50min00s" in perguntar("quanto tempo eu faria 10 km no pace 5:00").texto


def test_topicos_de_treino_continuam_iguais():
    assert perguntar("dicas de alongamento").texto == CONHECIMENTO["alongamento"]["curta"]
    assert perguntar("treino para meia maratona").texto == CONHECIMENTO["meia_maratona"]["curta"]


def test_antes_de_correr_continua_sendo_o_pre_treino_de_antes():
    assert perguntar("o que comer antes de correr").texto == CONHECIMENTO["pre_treino"]["curta"]


# --- reposição depois da corrida, por duração ---------------------------------


def _todas_as_variantes(duracao, distancia=None, vezes=80):
    textos = set()
    for semente in range(vezes):
        random.seed(semente)
        textos.add(texto_reposicao(duracao, distancia))
    return textos


@pytest.mark.parametrize("duracao", [20, 45, 60])
def test_faixa_curta_ate_60_minutos(duracao):
    for texto in _todas_as_variantes(duracao):
        assert "por hora" not in texto  # a faixa de g/h vale acima de 1 hora
        assert "proteína" in texto and AVISO in texto


@pytest.mark.parametrize("duracao", [61, 90, 120])
def test_faixa_media_de_1_a_2_horas(duracao):
    for texto in _todas_as_variantes(duracao):
        assert POR_HORA in texto
        assert "podem ser maiores" not in texto
        assert "proteína" in texto and AVISO in texto


@pytest.mark.parametrize("duracao", [121, 150, 240])
def test_faixa_longa_acima_de_2_horas(duracao):
    for texto in _todas_as_variantes(duracao):
        assert POR_HORA in texto
        assert "podem ser maiores" in texto
        assert "proteína" in texto and AVISO in texto


@pytest.mark.parametrize("duracao", [20, 75, 150])
def test_reposicao_nao_traz_volume_caloria_nem_peso(duracao):
    for texto in _todas_as_variantes(duracao):
        assert not PROIBIDO.search(texto), texto


def test_reposicao_sorteia_entre_variantes():
    assert len(_todas_as_variantes(30)) > 1


def test_reposicao_so_com_distancia_estima_a_duracao():
    # 5 km a 6 min/km = 30 min (faixa curta); 21 km = 126 min (faixa longa).
    assert all("podem ser maiores" not in t and "por hora" not in t for t in _todas_as_variantes(None, 5))
    assert all("podem ser maiores" in t for t in _todas_as_variantes(None, 21))


def test_reposicao_sem_dado_nenhum_pede_duracao_ou_distancia():
    texto = texto_reposicao(None, None)
    assert "quanto tempo" in texto and "km" in texto
    assert AVISO not in texto


# --- reposição no chat: usa a última corrida ou o que a pessoa disse ---------


def test_usa_a_ultima_corrida_do_usuario():
    resposta = perguntar("o que devo comer depois da corrida?", corridas=[corrida(1, 10.0, 55)]).texto
    assert "10.0 km" in resposta and "55 min" in resposta and "ontem" in resposta
    assert "por hora" not in resposta  # 55 min: faixa curta


def test_ultima_corrida_longa_cai_na_faixa_certa():
    assert POR_HORA in perguntar("o que beber depois de correr?", corridas=[corrida(0, 20.0, 110)]).texto
    assert "podem ser maiores" in perguntar("o que beber depois de correr?", corridas=[corrida(0, 32.0, 200)]).texto


def test_sem_corrida_pede_duracao_ou_distancia():
    resposta = perguntar("o que comer depois da corrida?").texto
    assert "quanto tempo" in resposta and "km" in resposta


@pytest.mark.parametrize(
    ("mensagem", "faixa_longa", "tem_g_por_hora"),
    [
        ("corri 40 minutos, o que comer depois?", False, False),
        ("corri 100 minutos, o que comer depois?", False, True),
        ("corri 1h30 e agora, o que comer?", False, True),
        ("corri 2h30, o que comer depois?", True, True),
        ("fiz 2 horas e 30 minutos, o que beber depois?", True, True),
    ],
)
def test_duracao_dita_na_mensagem(mensagem, faixa_longa, tem_g_por_hora):
    resposta = perguntar(mensagem).texto
    assert ("podem ser maiores" in resposta) is faixa_longa
    assert (POR_HORA in resposta) is tem_g_por_hora


def test_duracao_da_mensagem_vale_mais_que_a_ultima_corrida():
    resposta = perguntar("corri 2h30, o que comer depois?", corridas=[corrida(1, 5.0, 30)]).texto
    assert "podem ser maiores" in resposta


def test_so_distancia_na_mensagem_estima_a_duracao():
    resposta = perguntar("corri 21 km, o que beber depois?").texto
    assert "podem ser maiores" in resposta and "Estimando" in resposta


def test_horario_nao_vira_duracao():
    # "às 6h" é hora do dia, não uma corrida de 6 horas.
    resposta = perguntar("treinei às 6h, o que comer depois?", corridas=[corrida(0, 5.0, 30)]).texto
    assert "podem ser maiores" not in resposta and "30 min" in resposta


# --- conteúdo estático e "quero saber mais" -----------------------------------


@pytest.mark.parametrize("topico", ["hidratacao", "alimentacao_corrida", "pos_treino"])
def test_topicos_de_nutricao_sem_numero_nao_conferido(topico):
    for tamanho in ("curta", "detalhada"):
        texto = CONHECIMENTO[topico][tamanho]
        assert AVISO in texto, (topico, tamanho)
        assert not PROIBIDO.search(texto), (topico, tamanho, texto)
        assert "30 min" not in texto and "30min" not in texto  # a "janela de 30 minutos" não foi confirmada


def test_hidratacao_nao_afirma_beber_conforme_a_sede():
    # Não foi possível confirmar essa redação na fonte (texto do ACSM de 2007).
    for tamanho in ("curta", "detalhada"):
        assert "sede" not in CONHECIMENTO["hidratacao"][tamanho].lower()


@pytest.mark.parametrize(
    ("pergunta", "topico"),
    [
        ("como me hidratar nos treinos?", "hidratacao"),
        ("quanta água devo tomar?", "hidratacao"),
        ("o que beber durante a corrida?", "hidratacao"),
        ("devo comer carboidrato durante a prova?", "alimentacao_corrida"),
        ("qual a melhor comida para corredor?", "alimentacao_corrida"),
        ("o que comer antes e depois de correr?", "alimentacao_corrida"),
    ],
)
def test_perguntas_gerais_viram_o_topico_e_o_saber_mais_aprofunda(pergunta, topico):
    estado = EstadoConversa()
    assert perguntar(pergunta, estado=estado).texto == CONHECIMENTO[topico]["curta"]
    assert estado.aguardando_aprofundamento and estado.ultimo_topico_explicado == topico
    assert perguntar("quero saber mais", estado=estado).texto == CONHECIMENTO[topico]["detalhada"]


def test_saber_mais_depois_da_reposicao_abre_o_pos_treino():
    estado = EstadoConversa()
    perguntar("o que comer depois da corrida?", corridas=ULTIMAS, estado=estado)
    assert perguntar("quero saber mais", estado=estado).texto == CONHECIMENTO["pos_treino"]["detalhada"]


def test_pergunta_so_de_bebida_antes_de_correr_nao_vira_refeicao():
    # pre_treino fala só de refeições; "beber antes" é hidratação.
    assert perguntar("o que beber antes de correr?").texto == CONHECIMENTO["hidratacao"]["curta"]


def test_ajuda_menciona_o_recurso():
    assert "depois de correr" in perguntar("ajuda").texto


# --- pela API (com corridas de verdade no banco) -------------------------------


def test_api_usa_a_ultima_corrida_salva(client, make_user):
    make_user("ana", "Ana Souza")
    assert client.post("/activities", json=run_payload("ana", km=10.0, seconds=3300)).status_code == 200
    resposta = chat(client, "o que devo comer depois da corrida?")
    assert resposta.status_code == 200, resposta.text
    reply = resposta.json()["reply"]
    assert "10.0 km" in reply and "55 min" in reply and AVISO in reply
