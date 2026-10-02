"""Motor do chatbot de corrida (treinador virtual do Runnex).

Veio de chatbot_runnex.py (versao standalone de teste da branch
ChatbotRunnex), que ja tinha corrigido os bugs do prototipo original:
pace "4:25" lido como decimal 4.25, zona sempre reportada como "Zona 4",
estado em pickle e treinos compartilhados entre usuarios.

O que mudou para rodar dentro do app:

- Estatisticas, historico e recordes saem das corridas reais do usuario
  (tabela activities, registradas pelo GPS), nao de treinos digitados no
  chat. "registrar:" deixou de gravar: uma corrida digitada pularia as
  regras de plausibilidade (activity_rules.py) e contaria para XP, ranking
  e RunCoins.
- "meta:" define a meta semanal do perfil (users.weekly_goal_km), a mesma
  que a tela de Perfil mostra, em vez de uma meta paralela do chatbot.
- Sem pace informado na conversa, zonas e tempo estimado usam o pace medio
  das corridas recentes.

O modulo e puro (sem banco, sem FastAPI): recebe o estado da conversa e um
retrato dos dados do app e devolve a resposta. routers/chatbot.py carrega e
salva esse estado; scripts/chatbot_cli.py usa o mesmo motor no terminal.
"""

import random
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone, tzinfo
from typing import Optional

# ---------------------------------------------------------------------------
# Base de conhecimento
# ---------------------------------------------------------------------------

CONHECIMENTO: dict[str, dict[str, str]] = {
    "tecnica_corrida": {
        "curta": "Mantenha o corpo ereto, olhar para frente, ombros relaxados, braços em 90 graus e pisada com o meio do pé. Passos curtos e rápidos, cadência de 170-180 por minuto.",
        "detalhada": "A técnica correta envolve vários pontos. O corpo fica ereto com leve inclinação para frente. A cabeça fica alinhada com a coluna, olhar no horizonte. Os ombros relaxados. Os braços trabalham em ângulo de 90 graus. A pisada ideal é com o meio do pé. A cadência ideal fica entre 170 e 180 passos por minuto.",
    },
    "postura": {
        "curta": "Coluna ereta, ombros para trás e relaxados, quadril estável, joelhos levemente flexionados.",
        "detalhada": "A postura correta começa pela coluna ereta e alongada. Os ombros ficam para trás e para baixo, relaxados. O quadril deve estar estável. Os joelhos ficam levemente flexionados.",
    },
    "passada": {
        "curta": "Pise com o meio do pé, embaixo do corpo. Cadência ideal de 170-180 passos por minuto.",
        "detalhada": "A passada ideal tem o pé aterrissando embaixo do centro de gravidade. A pisada deve ser com o meio do pé. A cadência deve ficar entre 170 e 180 passos por minuto.",
    },
    "braco": {
        "curta": "Cotovelos em 90 graus, movimento para frente e para trás, mãos relaxadas.",
        "detalhada": "O movimento dos braços ajuda no equilíbrio. Os cotovelos ficam em ângulo de 90 graus. O movimento é para frente e para trás.",
    },
    "treino_continuo": {
        "curta": "Corrida em ritmo constante e confortável por 30-90 minutos.",
        "detalhada": "O treino contínuo é correr em ritmo constante por 30 a 90 minutos, numa intensidade de 60-70% da frequência cardíaca máxima.",
    },
    "treino_intervalado": {
        "curta": "Alterne alta intensidade com recuperação. Exemplo: 30s rápido e 90s caminhando, repetindo 8-12 vezes.",
        "detalhada": "O treino intervalado alterna alta intensidade com recuperação. Exemplo: 30 segundos rápido, 90 segundos caminhando. Repete-se de 8 a 12 vezes.",
    },
    "treino_fartlek": {
        "curta": "Alternância livre de ritmos, sem estrutura fixa.",
        "detalhada": "O fartlek é um treino livre onde você alterna ritmos sem estrutura rígida. Acelere até um ponto, recupere, acelere de novo.",
    },
    "treino_longo": {
        "curta": "A corrida mais longa da semana, em ritmo confortável.",
        "detalhada": "O treino longo é a corrida mais longa da semana. A duração varia de 1 hora até 3 horas para maratona.",
    },
    "treino_tiro": {
        "curta": "Sprints curtos e intensos, como 10x 100m rápido.",
        "detalhada": "O treino de tiro foca em velocidade pura. São sprints curtos e intensos, como 10 repetições de 100 metros.",
    },
    "treino_recuperacao": {
        "curta": "Corrida bem leve de 20-30 minutos para recuperação.",
        "detalhada": "O treino de recuperação é uma corrida bem leve de 20 a 30 minutos. Ajuda na recuperação ativa.",
    },
    "treino_ritmo": {
        "curta": "Corrida de 20-40 minutos no seu limiar anaeróbico.",
        "detalhada": "O treino de ritmo é correr de 20 a 40 minutos no seu limiar anaeróbico. É o pace mais rápido que você sustenta por cerca de uma hora.",
    },
    "pre_treino": {
        "curta": "Refeição completa 2-3h antes, ou lanche leve 30-60min antes.",
        "detalhada": "Refeição completa 2-3 horas antes com carboidratos e proteína magra. Lanche leve 30-60 minutos antes.",
    },
    "pos_treino": {
        "curta": "Coma proteína e carboidrato até 30min após. Hidrate-se bem.",
        "detalhada": "Após o treino, consuma proteína e carboidrato nos primeiros 30 minutos. Duas horas depois, refeição completa.",
    },
    "hidratacao": {
        "curta": "Beba 2-3 litros por dia. Durante o treino: 150-300ml a cada 15-20min.",
        "detalhada": "Beba 2-3 litros de água por dia. Durante o treino, beba 150-300ml a cada 15-20 minutos.",
    },
    "suplementos": {
        "curta": "Whey, creatina e cafeína podem ajudar. Consulte nutricionista.",
        "detalhada": "Whey protein ajuda na recuperação. Creatina ajuda na força. Cafeína melhora performance.",
    },
    "emagrecimento": {
        "curta": "Corrida queima 60-100 calorias por km. Dieta é 70% do resultado.",
        "detalhada": "Corrida queima 60-100 calorias por quilômetro. Dieta é 70% do resultado.",
    },
    "lesoes_comuns": {
        "curta": "Canelite, fascite, joelho de corredor e tendinite são as mais comuns.",
        "detalhada": "As lesões mais comuns: canelite, fascite plantar, joelho de corredor e tendinite de Aquiles.",
    },
    "prevencao": {
        "curta": "Regra dos 10%: não aumente volume mais que 10% por semana.",
        "detalhada": "Não aumente volume em mais de 10% por semana. Fortaleça core, glúteos e panturrilhas.",
    },
    "recuperacao": {
        "curta": "Caminhada leve após, alongamento, hidratação e sono.",
        "detalhada": "Após o treino, faça caminhada leve, alongue, hidrate e durma bem.",
    },
    "respirar": {
        "curta": "Ritmo 3:2 (inspire 3 passos, expire 2). Respire pelo nariz e boca.",
        "detalhada": "Use o ritmo 3:2, inspire por 3 passos e expire por 2. Respire pelo nariz e boca juntos.",
    },
    "tenis": {
        "curta": "Conheça sua pisada. Tamanho com 1 dedo de folga. Troque a cada 500-800km.",
        "detalhada": "Conheça seu tipo de pisada. O tamanho ideal tem um dedo de folga. Troque a cada 500-800km.",
    },
    "roupa": {
        "curta": "Evite algodão, prefira tecidos leves e respiráveis.",
        "detalhada": "Evite algodão. Prefira tecidos leves e respiráveis.",
    },
    "acessorios": {
        "curta": "Relógio GPS é o mais útil. Refletivos para segurança.",
        "detalhada": "O relógio GPS é o acessório mais útil. Para segurança, use refletivos.",
    },
    "iniciante": {
        "curta": "Comece alternando corrida e caminhada. 3x por semana, 20-30min.",
        "detalhada": "Para iniciantes, comece alternando corrida com caminhada. 3x por semana, 20-30 minutos.",
    },
    "intermediario": {
        "curta": "Semana típica: intervalado, corrida leve, ritmo, longão e recuperação.",
        "detalhada": "Para intermediários: intervalado, corrida leve, treino de ritmo, longão e recuperação.",
    },
    "avancado": {
        "curta": "Volume de 60-100km semanais. Dois treinos de qualidade.",
        "detalhada": "Treinamento avançado: volume de 60-100km semanais. Dois treinos de qualidade.",
    },
    "maratona": {
        "curta": "Preparação de 16-20 semanas. Longões até 35km.",
        "detalhada": "Preparar para maratona: 16-20 semanas. Longões progressivos até 35km.",
    },
    "5k": {
        "curta": "Prova ideal para iniciantes. Tempo médio 25-35min.",
        "detalhada": "A prova de 5km é perfeita para iniciantes. Tempo médio entre 25 e 35 minutos.",
    },
    "10k": {
        "curta": "Bom desafio para intermediários. Tempo médio 45-70min.",
        "detalhada": "A prova de 10km é um bom desafio. Tempo médio entre 45 e 70 minutos.",
    },
    "meia_maratona": {
        "curta": "21km exige preparação séria. Mínimo 12 semanas.",
        "detalhada": "A meia maratona exige mínimo de 12 semanas de treino.",
    },
    "maratona_completa": {
        "curta": "42km é o desafio máximo. Cuidado com a parede no km 30-35.",
        "detalhada": "A maratona é o desafio máximo. Cuidado com a parede no km 30-35.",
    },
    "frequencia_cardiaca": {
        "curta": "5 zonas de treino baseadas na FC máxima (220 - idade).",
        "detalhada": "Existem 5 zonas de treinamento baseadas na frequência cardíaca máxima.",
    },
    "vo2max": {
        "curta": "Capacidade máxima de consumo de oxigênio. Melhore com intervalados.",
        "detalhada": "O VO2 máximo é a capacidade máxima de consumir oxigênio. Melhore com intervalados.",
    },
    "limiar": {
        "curta": "Ponto onde o corpo acumula lactato. Treine 1x por semana.",
        "detalhada": "O limiar anaeróbico é o ponto onde o corpo acumula lactato.",
    },
    "conceito_pace": {
        "curta": "Pace é o tempo por quilômetro. Pace 6:00 significa 6 minutos por km.",
        "detalhada": "Pace é o tempo que você leva para percorrer um quilômetro. Pace 6:00 significa 6 minutos por quilômetro.",
    },
    "calculo_pace": {
        "curta": "Divida o tempo em minutos pela distância em km. Ex: 30min ÷ 5km = pace 6:00.",
        "detalhada": "Para calcular o pace: divida o tempo total em minutos pela distância em quilômetros.",
    },
    "paces_por_nivel": {
        "curta": "Iniciantes: pace 7:00-8:00. Intermediários: 5:30-6:30. Avançados: abaixo de 5:00.",
        "detalhada": "Iniciantes: pace 7:00-8:00. Intermediários: 5:30-6:30. Avançados: abaixo de 5:00.",
    },
    "como_melhorar_pace": {
        "curta": "Combine treinos de base, ritmo e intervalados. Consistência é a chave.",
        "detalhada": "Para melhorar o pace, combine treinos de base, ritmo e intervalados.",
    },
    "batendo_recordes": {
        "curta": "Treine no pace alvo, saia conservador, acelere no final.",
        "detalhada": "Para bater recorde, treine no pace alvo. Na prova, saia conservador.",
    },
    "periodizacao_recordes": {
        "curta": "Divida o treino em fases: base, construção, polimento e taper.",
        "detalhada": "Periodização: base, construção, polimento e taper.",
    },
    "treinos_para_recorde": {
        "curta": "Tempo run, intervalados e longões. 80% fácil, 20% intenso.",
        "detalhada": "Para bater recorde: tempo run, intervalados e longões.",
    },
    "psicologia_recordes": {
        "curta": "Confie no treino. Divida a prova em partes. Visualize-se no pace alvo.",
        "detalhada": "Confie no treino. Divida a prova em partes menores.",
    },
    "periodizacao": {
        "curta": "Divida o treino em ciclos: base, construção, polimento e taper.",
        "detalhada": "A periodização divide o treino em ciclos: base, construção, polimento e taper.",
    },
    "cross_training": {
        "curta": "Atividades complementares: natação, ciclismo, musculação.",
        "detalhada": "Cross-training inclui natação, ciclismo e musculação.",
    },
    "fortalecimento": {
        "curta": "Fortaleça core, glúteos e panturrilhas 2-3x por semana.",
        "detalhada": "Fortalecimento muscular é essencial. Foque em core, glúteos e panturrilhas.",
    },
    "alongamento": {
        "curta": "Alongue após o treino, nunca antes. Mantenha 20-30 segundos.",
        "detalhada": "Alongue após o treino. Mantenha cada alongamento por 20-30 segundos.",
    },
    "aquecimento": {
        "curta": "Aqueça 5-10 minutos antes de correr. Caminhada ou trote leve.",
        "detalhada": "Aqueça 5-10 minutos antes de correr.",
    },
    "desaquecimento": {
        "curta": "Caminhe 5-10 minutos após o treino para baixar a FC gradualmente.",
        "detalhada": "Caminhe 5-10 minutos após o treino.",
    },
}

MAPEAMENTO_CONHECIMENTO_CURTO: dict[str, str] = {
    "técnica": "tecnica_corrida", "postura": "postura", "passada": "passada", "braço": "braco",
    "intervalado": "treino_intervalado", "fartlek": "treino_fartlek", "longo": "treino_longo",
    "tiro": "treino_tiro", "recuperação": "treino_recuperacao", "contínuo": "treino_continuo",
    "ritmo": "treino_ritmo", "antes de correr": "pre_treino", "depois de correr": "pos_treino",
    "hidratação": "hidratacao", "água": "hidratacao", "suplemento": "suplementos",
    "emagrecer": "emagrecimento", "lesão": "lesoes_comuns", "prevenção": "prevencao",
    "respiração": "respirar", "tênis": "tenis", "roupa": "roupa", "acessório": "acessorios",
    "iniciante": "iniciante", "intermediário": "intermediario", "avançado": "avancado",
    # "meia" antes de "maratona": a busca para no primeiro termo deste dict
    # contido na mensagem, e "meia maratona" contem os dois.
    "meia": "meia_maratona", "maratona": "maratona", "5k": "5k", "10k": "10k",
    "frequência cardíaca": "frequencia_cardiaca", "vo2": "vo2max", "limiar": "limiar",
    "pace": "conceito_pace", "recorde": "batendo_recordes", "periodização": "periodizacao",
    "cross training": "cross_training", "fortalecimento": "fortalecimento",
    "alongamento": "alongamento", "aquecimento": "aquecimento", "desaquecimento": "desaquecimento",
}

# nome da zona -> (delta_min, delta_max) em relação ao pace de referência
# (Zona 4 / limiar). Deltas negativos = mais rápido que o pace de referência.
ZONAS_DELTAS: dict[str, tuple[float, float]] = {
    "zona1": (1.5, 2.5), "zona2": (0.75, 1.5), "zona3": (0.25, 0.5),
    "zona4": (-0.25, 0.1), "zona5": (-0.5, -0.15),
}

CONHECIMENTO_ZONAS: dict[str, dict[str, str]] = {
    "zona1": {"nome": "Zona 1 - Recuperação", "fc_percentual": "50-60% da FC máxima",
              "descricao": "Ritmo muito leve para recuperação ativa e aquecimento",
              "duracao": "20-40 minutos", "beneficios": "Recuperação, melhora circulação, remove ácido lático"},
    "zona2": {"nome": "Zona 2 - Resistência Aeróbica", "fc_percentual": "60-70% da FC máxima",
              "descricao": "Ritmo confortável para base aeróbica, consegue conversar",
              "duracao": "30-90 minutos", "beneficios": "Base aeróbica, queima de gordura, resistência"},
    "zona3": {"nome": "Zona 3 - Ritmo de Prova", "fc_percentual": "70-80% da FC máxima",
              "descricao": "Ritmo moderado para provas longas",
              "duracao": "20-60 minutos", "beneficios": "Melhora cardiovascular, ritmo de prova"},
    "zona4": {"nome": "Zona 4 - Limiar Anaeróbico", "fc_percentual": "80-90% da FC máxima",
              "descricao": "Ritmo forte que você sustenta por cerca de 1 hora",
              "duracao": "15-40 minutos", "beneficios": "Eleva limiar, melhora tolerância ao lactato"},
    "zona5": {"nome": "Zona 5 - Velocidade Máxima", "fc_percentual": "90-100% da FC máxima",
              "descricao": "Ritmo máximo para tiros e sprints",
              "duracao": "10-20 minutos (em tiros)", "beneficios": "Velocidade, potência, VO2 máximo"},
}

ZONAS_TREINO: dict[str, str] = {
    "recuperacao": "zona1", "regenerativo": "zona1", "leve": "zona1", "zona 1": "zona1",
    "base": "zona2", "aerobico": "zona2", "aeróbico": "zona2", "resistencia": "zona2",
    "resistência": "zona2", "zona 2": "zona2",
    "prova": "zona3", "ritmo": "zona3", "moderado": "zona3", "zona 3": "zona3",
    "limiar": "zona4", "anaerobico": "zona4", "anaeróbico": "zona4", "forte": "zona4", "zona 4": "zona4",
    "tiro": "zona5", "velocidade": "zona5", "sprint": "zona5", "maximo": "zona5", "máximo": "zona5", "zona 5": "zona5",
}

RESPOSTAS_TREINADAS: dict[str, list[str]] = {
    "tempo_estimado": [
        "Com pace de {pace_fmt} min/km em {distancia:.1f}km, seu tempo estimado é {tempo_formatado}.",
        "Seu tempo estimado para {distancia:.1f}km com pace de {pace_fmt} min/km é {tempo_formatado}.",
        "Calculando: {distancia:.1f}km a pace {pace_fmt} min/km = {tempo_formatado}.",
    ],
    "tempo_maratona": [
        "Com pace de {pace_fmt} min/km, você completaria a maratona em {tempo_formatado}.",
        "Seu tempo estimado de maratona com pace {pace_fmt} é {tempo_formatado}.",
        "Projetando seu pace de {pace_fmt} para os 42km, o tempo seria {tempo_formatado}.",
    ],
    "preparacao_maratona": [
        "Para maratona com seu pace, foque em: longões progressivos de 25km até 35-38km, treinos de ritmo de 15-20km no pace alvo, e intervalados de 1000m. Inclua trechos de 10-15km no pace de maratona durante os longões.",
        "Seu plano para maratona: 16-20 semanas de preparação, longões semanais progressivos, treinos de ritmo no pace alvo, e simulações de prova com hidratação e nutrição.",
        "Para manter seu pace na maratona: fortaleça resistência muscular, faça longões com trechos no pace alvo, e treine nutrição durante os treinos longos.",
    ],
    "melhoria_pace": [
        "Para melhorar seu pace de {pace_fmt}, inclua: intervalados de 1000m a pace {pace_alvo_fmt}, treinos de ritmo a {pace_alvo_fmt}, e longões progressivos.",
        "Evolução do pace {pace_fmt} para {pace_alvo_fmt}: faça intervalados 2x por semana, treinos de ritmo 1x por semana, e fortalecimento muscular.",
        "Seu pace atual de {pace_fmt} pode evoluir para {pace_alvo_fmt} com: treinos variados, consistência e descanso adequado.",
    ],
}

INTENCOES: dict[str, list[str]] = {
    "saudacao": [r"\b(olá|oi|hey|eae|eai|bom dia|boa tarde|boa noite)\b"],
    "despedida": [r"\b(tchau|até mais|adeus|bye|até logo)\b"],
    "ajuda": [r"\b(ajuda|help|o que você sabe|como funciona)\b"],
}

DISTANCIAS_PROVA = {"maratona": 42.195, "meia": 21.0975, "10k": 10.0, "5k": 5.0}

# A ordem importa: "meia maratona" contem "maratona", e antes a maratona era
# testada primeiro — "tempo na meia maratona" calculava 42,2 km. O lookbehind
# nos numeros evita o mesmo problema com "15km" (que contem "5km").
_PROVAS: list[tuple[str, re.Pattern]] = [
    ("meia", re.compile(r"meia[\s-]?maratona|(?<![\d.,])21\s?km?\b")),
    ("maratona", re.compile(r"maratona|(?<![\d.,])42\s?km?\b")),
    ("10k", re.compile(r"(?<![\d.,])10k(?:m)?\b")),
    ("5k", re.compile(r"(?<![\d.,])5k(?:m)?\b")),
]
_OBJETIVO_POR_PROVA = {"meia": "meia_maratona", "maratona": "maratona", "10k": "10k", "5k": "5k"}

_AGRADECIMENTOS = [
    "De nada! Qualquer dúvida sobre corrida, é só perguntar.",
    "Sempre às ordens! Bons treinos!",
    "Por nada! Continue correndo!",
]

# Contexto exigido perto do número para aceitar como pace — sem isso,
# "6:30" em "treino às 6:30 da manhã" não deveria virar pace 6:30/km.
_PACE_CONTEXT = re.compile(r"pace|ritmo|min/km|por km|/km")
# Segundos com 2 dígitos (00-59): pace de corrida é sempre min:seg, nunca
# minutos decimais — "4:25" tem que virar 4 + 25/60, nunca float("4.25").
_PACE_NUM = re.compile(r"(\d{1,2})[:.]([0-5]\d)")
_DISTANCIA_NUM = re.compile(r"(\d+(?:[.,]\d+)?)\s*(?:km|quilômetros|quilometros)\b")

# Corrida mais curta que isso nao entra em "melhor pace": 300 m num tiro
# dariam um recorde que nao diz nada sobre o ritmo do corredor.
MIN_KM_RECORDE = 1.0
_RECORDE_BUCKETS = [("5 km", 4.5, 5.5), ("10 km", 9.0, 11.0), ("21 km", 20.0, 22.5), ("42 km", 40.0, 44.0)]

# Quantas corridas recentes entram no pace medio usado quando o usuario
# nao informou um pace na conversa.
CORRIDAS_PACE_MEDIO = 5

# Mesmo limite de UserProfileCreate.weekly_goal_km (PUT /users/{uid}).
META_SEMANAL_MAX_KM = 500.0
_META_RE = re.compile(r"^\s*(\d+(?:[.,]\d+)?)\s*(?:km)?\s*(?:,.*)?$", re.IGNORECASE)

# "aprender:" guarda texto do proprio usuario no banco — limites para uma
# linha de chatbot_profiles nao crescer sem controle.
MAX_RESPOSTAS_APRENDIDAS = 50
MAX_PERGUNTA_APRENDIDA = 200
MAX_RESPOSTA_APRENDIDA = 500

_POSSESSIVO = re.compile(r"\b(meu|meus|minha|minhas)\b")
_PEDE_RECORDES = re.compile(r"\b(recordes?|records?|pb|melhor(?:es)? tempos?|melhor marca)\b")
_PEDE_META = re.compile(r"\b(metas?|objetivos)\b")
_PEDE_ESTATISTICAS = ("estatística", "estatistica", "stats", "meu desempenho", "meu resumo", "meus números", "meus numeros")
_PEDE_HISTORICO = (
    "últimos treinos", "ultimos treinos", "últimas corridas", "ultimas corridas", "última corrida",
    "ultima corrida", "minhas corridas", "histórico", "historico",
)


# ---------------------------------------------------------------------------
# Dados de entrada
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class Corrida:
    """Uma corrida salva no app (linha de activities)."""

    distancia_km: float
    duracao_s: int
    quando: datetime  # com fuso
    calorias: Optional[int] = None

    @property
    def pace(self) -> float:
        return self.duracao_s / 60 / self.distancia_km


@dataclass
class DadosDoApp:
    """Retrato somente-leitura do que o app ja sabe do corredor."""

    nome: Optional[str] = None
    corridas: list[Corrida] = field(default_factory=list)  # mais recente primeiro
    meta_semanal_km: Optional[float] = None
    agora: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    # Fuso do aparelho: "ultimos 7 dias" e as datas exibidas seguem o dia
    # local do usuario, igual a tela de Perfil.
    fuso: tzinfo = timezone.utc


@dataclass
class EstadoConversa:
    """O que o bot memoriza entre mensagens (uma linha de chatbot_profiles)."""

    pace_informado: Optional[float] = None
    distancia_frequente: Optional[float] = None
    objetivo_principal: Optional[str] = None
    nivel: Optional[str] = None
    aguardando_aprofundamento: bool = False
    ultimo_topico_explicado: Optional[str] = None
    respostas_aprendidas: dict[str, dict] = field(default_factory=dict)


@dataclass
class Resposta:
    texto: str
    # Preenchido por "meta: X" — quem chama grava em users.weekly_goal_km.
    nova_meta_semanal_km: Optional[float] = None


# ---------------------------------------------------------------------------
# Funções puras de extração e cálculo
# ---------------------------------------------------------------------------

def formatar_pace(pace: float) -> str:
    minutos = int(pace)
    segundos = int(round((pace - minutos) * 60))
    if segundos == 60:
        minutos += 1
        segundos = 0
    return f"{minutos}:{segundos:02d}"


def prova_mencionada(mensagem_lower: str) -> Optional[str]:
    for nome, padrao in _PROVAS:
        if padrao.search(mensagem_lower):
            return nome
    return None


def extrair_pace_e_distancia(mensagem_lower: str) -> tuple[Optional[float], Optional[float]]:
    """Única fonte de verdade pra extração de pace/distância da mensagem."""
    pace = None
    if _PACE_CONTEXT.search(mensagem_lower):
        match = _PACE_NUM.search(mensagem_lower)
        if match:
            # min:seg -> minutos decimais (ex.: 4:25 -> 4 + 25/60), nunca
            # "4.25" tratado como fração decimal.
            candidato = int(match.group(1)) + int(match.group(2)) / 60
            if 1 < candidato < 15:
                pace = candidato

    prova = prova_mencionada(mensagem_lower)
    distancia = DISTANCIAS_PROVA[prova] if prova else None
    if distancia is None:
        match = _DISTANCIA_NUM.search(mensagem_lower)
        if match:
            candidato = float(match.group(1).replace(",", "."))
            if 1 < candidato < 200:
                distancia = candidato

    return pace, distancia


def detectar_objetivo(mensagem_lower: str) -> Optional[str]:
    prova = prova_mencionada(mensagem_lower)
    return _OBJETIVO_POR_PROVA[prova] if prova else None


def detectar_nivel(mensagem_lower: str) -> Optional[str]:
    if any(p in mensagem_lower for p in ["iniciante", "começar", "primeira vez", "novato"]):
        return "iniciante"
    if any(p in mensagem_lower for p in ["avançado", "experiente", "elite"]):
        return "avancado"
    if any(p in mensagem_lower for p in ["intermediário", "intermediario"]):
        return "intermediario"
    return None


def calcular_zonas_treino(pace_referencia: float) -> dict[str, tuple[float, float]]:
    return {
        zona: (pace_referencia + delta_min, pace_referencia + delta_max)
        for zona, (delta_min, delta_max) in ZONAS_DELTAS.items()
    }


def texto_zonas_treino(pace_referencia: float) -> str:
    zonas = calcular_zonas_treino(pace_referencia)
    resposta = (
        f"Zonas de treinamento calculadas a partir do pace de referência de "
        f"{formatar_pace(pace_referencia)} min/km (tratado como seu pace de limiar / Zona 4):\n\n"
    )
    for zona in ["zona1", "zona2", "zona3", "zona4", "zona5"]:
        info = CONHECIMENTO_ZONAS[zona]
        pace_min, pace_max = zonas[zona]
        resposta += f"{info['nome']}\n"
        resposta += f"Pace: {formatar_pace(pace_min)} a {formatar_pace(pace_max)} min/km\n"
        resposta += f"{info['descricao']}\n\n"
    resposta += (
        "Se o pace que você me deu não for seu pace de limiar (ex.: era um pace de treino leve "
        "ou de prova), essas faixas vão estar deslocadas — me diga seu pace de limiar "
        "(o mais rápido que você sustenta por ~1h) pra recalcular certo."
    )
    return resposta


def texto_zona_especifica(pace_referencia: float, zona_texto: str) -> Optional[str]:
    zona_chave = ZONAS_TREINO.get(zona_texto.lower())
    if not zona_chave:
        return None
    zonas = calcular_zonas_treino(pace_referencia)
    pace_min, pace_max = zonas[zona_chave]
    info = CONHECIMENTO_ZONAS[zona_chave]
    return (
        f"{info['nome']}\n"
        f"FC: {info['fc_percentual']}\n"
        f"Seu pace nessa zona: {formatar_pace(pace_min)} a {formatar_pace(pace_max)} min/km\n"
        f"Descrição: {info['descricao']}\n"
        f"Duração ideal: {info['duracao']}\n"
        f"Benefícios: {info['beneficios']}\n"
    )


def _formatar_tempo(tempo_minutos: float) -> str:
    horas = int(tempo_minutos // 60)
    minutos = int(tempo_minutos % 60)
    segundos = int(round((tempo_minutos * 60) % 60))
    if segundos == 60:
        minutos += 1
        segundos = 0
    if minutos == 60:
        horas += 1
        minutos = 0
    if horas > 0:
        return f"{horas}h{minutos:02d}min{segundos:02d}s"
    return f"{minutos}min{segundos:02d}s"


def calcular_tempo_estimado_texto(pace: float, distancia: float) -> str:
    tempo_formatado = _formatar_tempo(pace * distancia)
    template = random.choice(RESPOSTAS_TREINADAS["tempo_estimado"])
    return template.format(pace_fmt=formatar_pace(pace), distancia=distancia, tempo_formatado=tempo_formatado)


def texto_pace_maratona(pace: float, mensagem_lower: str) -> str:
    tempo_formatado = _formatar_tempo(pace * 42.195)
    if any(p in mensagem_lower for p in ["preparar", "treinar", "manter", "como"]):
        pace_fmt = formatar_pace(pace)
        return (
            f"Com pace de {pace_fmt} min/km, seu tempo estimado de maratona é {tempo_formatado}. "
            f"Para manter esse pace nos 42km, foque em: longões progressivos até 35-38km com trechos "
            f"no pace alvo, treinos de ritmo de 15-20km a pace {pace_fmt}, e fortalecimento muscular."
        )
    template = random.choice(RESPOSTAS_TREINADAS["tempo_maratona"])
    return template.format(pace_fmt=formatar_pace(pace), tempo_formatado=tempo_formatado)


def texto_melhoria_pace(pace: float) -> str:
    pace_alvo = pace - 0.15
    template = random.choice(RESPOSTAS_TREINADAS["melhoria_pace"])
    return template.format(pace_fmt=formatar_pace(pace), pace_alvo_fmt=formatar_pace(pace_alvo))


def responder_pergunta_direta(mensagem_lower: str) -> Optional[str]:
    if "pace" in mensagem_lower or "ritmo" in mensagem_lower:
        return CONHECIMENTO["conceito_pace"]["curta"]
    if "fartlek" in mensagem_lower:
        return CONHECIMENTO["treino_fartlek"]["curta"]
    if "intervalado" in mensagem_lower:
        return CONHECIMENTO["treino_intervalado"]["curta"]
    if "limiar" in mensagem_lower:
        return CONHECIMENTO["limiar"]["curta"]
    if "vo2" in mensagem_lower:
        return CONHECIMENTO["vo2max"]["curta"]
    return None


def identificar_intencao(mensagem_lower: str) -> Optional[str]:
    for intencao, padroes in INTENCOES.items():
        for padrao in padroes:
            if re.search(padrao, mensagem_lower):
                return intencao
    return None


def buscar_conhecimento_curto(mensagem_lower: str) -> Optional[tuple[str, str]]:
    for palavra, topico in MAPEAMENTO_CONHECIMENTO_CURTO.items():
        if palavra in mensagem_lower and topico in CONHECIMENTO:
            return topico, CONHECIMENTO[topico]["curta"]
    return None


def normalizar_texto(texto: str) -> str:
    texto = texto.lower().strip()
    texto = re.sub(r"[^\w\s]", "", texto)
    texto = re.sub(r"\s+", " ", texto)
    return texto


def calcular_similaridade(texto1: str, texto2: str) -> float:
    palavras1 = set(normalizar_texto(texto1).split())
    palavras2 = set(normalizar_texto(texto2).split())
    if not palavras1 or not palavras2:
        return 0.0
    return len(palavras1 & palavras2) / len(palavras1 | palavras2)


# ---------------------------------------------------------------------------
# Dados reais do app
# ---------------------------------------------------------------------------

_SEM_CORRIDAS = (
    "Você ainda não tem corridas no Runnex. Toque em Correr (o botão do meio) pra registrar a "
    "primeira — assim que salvar, ela já aparece aqui."
)


def _dia_local(dados: DadosDoApp, momento: datetime):
    return momento.astimezone(dados.fuso).date()


def _data_curta(dados: DadosDoApp, corrida: Corrida) -> str:
    return _dia_local(dados, corrida.quando).strftime("%d/%m")


def _quando_relativo(dados: DadosDoApp, corrida: Corrida) -> str:
    dias = (_dia_local(dados, dados.agora) - _dia_local(dados, corrida.quando)).days
    if dias <= 0:
        return "hoje"
    if dias == 1:
        return "ontem"
    if dias < 7:
        return f"há {dias} dias"
    return f"em {_data_curta(dados, corrida)}"


def km_ultimos_7_dias(dados: DadosDoApp) -> float:
    """Hoje e os 6 dias anteriores no fuso do usuario — a mesma janela do
    "km da semana" da tela de Perfil (buildEmptyWeekMap em activitiesApi.ts)."""
    hoje = _dia_local(dados, dados.agora)
    inicio = hoje - timedelta(days=6)
    return sum(c.distancia_km for c in dados.corridas if inicio <= _dia_local(dados, c.quando) <= hoje)


def pace_medio_recente(corridas: list[Corrida]) -> Optional[float]:
    recentes = corridas[:CORRIDAS_PACE_MEDIO]
    km = sum(c.distancia_km for c in recentes)
    if km <= 0:
        return None
    pace = sum(c.duracao_s for c in recentes) / 60 / km
    return pace if 1 < pace < 15 else None


def texto_estatisticas(dados: DadosDoApp) -> str:
    corridas = dados.corridas
    if not corridas:
        return _SEM_CORRIDAS
    total_km = sum(c.distancia_km for c in corridas)
    total_s = sum(c.duracao_s for c in corridas)
    linhas = [
        "Suas estatísticas no Runnex:",
        "",
        f"Corridas: {len(corridas)}",
        f"Distância total: {total_km:.1f} km",
        f"Tempo total: {_formatar_tempo(total_s / 60)}",
        f"Distância média: {total_km / len(corridas):.1f} km por corrida",
        f"Pace médio: {formatar_pace(total_s / 60 / total_km)} min/km",
        f"Maior distância: {max(c.distancia_km for c in corridas):.1f} km",
        f"Últimos 7 dias: {km_ultimos_7_dias(dados):.1f} km",
    ]
    calorias = sum(c.calorias or 0 for c in corridas)
    if calorias:
        linhas.append(f"Calorias: {calorias} kcal")
    return "\n".join(linhas)


def texto_historico(dados: DadosDoApp) -> str:
    if not dados.corridas:
        return _SEM_CORRIDAS
    linhas = ["Suas últimas corridas:"]
    for c in dados.corridas[:5]:
        linhas.append(
            f"{_data_curta(dados, c)}: {c.distancia_km:.1f} km em {_formatar_tempo(c.duracao_s / 60)} "
            f"(pace {formatar_pace(c.pace)})"
        )
    return "\n".join(linhas)


def texto_recordes(dados: DadosDoApp) -> str:
    if not dados.corridas:
        return _SEM_CORRIDAS
    maior = max(dados.corridas, key=lambda c: c.distancia_km)
    linhas = ["Seus recordes:", f"Maior distância: {maior.distancia_km:.1f} km ({_data_curta(dados, maior)})"]

    validas = [c for c in dados.corridas if c.distancia_km >= MIN_KM_RECORDE]
    if validas:
        melhor = min(validas, key=lambda c: c.pace)
        linhas.append(f"Melhor pace: {formatar_pace(melhor.pace)} min/km ({_data_curta(dados, melhor)})")
    for rotulo, minimo, maximo in _RECORDE_BUCKETS:
        na_faixa = [c for c in dados.corridas if minimo <= c.distancia_km <= maximo]
        if na_faixa:
            melhor = min(na_faixa, key=lambda c: c.pace)
            linhas.append(
                f"{rotulo}: {formatar_pace(melhor.pace)} min/km — {melhor.distancia_km:.1f} km em "
                f"{_formatar_tempo(melhor.duracao_s / 60)} ({_data_curta(dados, melhor)})"
            )
    return "\n".join(linhas)


def texto_meta(dados: DadosDoApp) -> str:
    km_semana = km_ultimos_7_dias(dados)
    if not dados.meta_semanal_km:
        return (
            f"Você ainda não tem meta semanal. Nos últimos 7 dias você correu {km_semana:.1f} km. "
            "Pra definir, mande 'meta: 20' (km por semana) ou ajuste na tela de Perfil."
        )
    meta = dados.meta_semanal_km
    progresso = min(km_semana / meta * 100, 100)
    texto = f"Meta semanal: {meta:g} km\nÚltimos 7 dias: {km_semana:.1f} km ({progresso:.0f}%)\n"
    if km_semana >= meta:
        return texto + "Meta batida! Se estiver fácil, suba aos poucos — no máximo 10% por semana."
    return texto + f"Faltam {meta - km_semana:.1f} km."


# ---------------------------------------------------------------------------
# Textos de intenção e fallback
# ---------------------------------------------------------------------------

def _saudacao_nome(nome_usuario: Optional[str]) -> str:
    return f", {nome_usuario}" if nome_usuario else ""


def texto_intencao(intencao: str, estado: EstadoConversa, dados: DadosDoApp) -> str:
    nome = _saudacao_nome(dados.nome)
    if intencao == "saudacao":
        partes = [f"Olá{nome}!"]
        if dados.corridas:
            ultima = dados.corridas[0]
            partes.append(
                f"Sua última corrida foi {ultima.distancia_km:.1f} km a {formatar_pace(ultima.pace)} min/km "
                f"({_quando_relativo(dados, ultima)})."
            )
        if estado.objetivo_principal:
            partes.append(f"Seu objetivo é {estado.objetivo_principal.replace('_', ' ')}.")
        partes.append("Como posso ajudar?")
        return " ".join(partes)
    if intencao == "despedida":
        return f"Até mais{nome}! Se tiver mais dúvidas sobre corrida, é só chamar. Bons treinos!"
    if intencao == "ajuda":
        return (
            f"Posso ajudar{nome} com técnica, treinos, pace, zonas, provas (5k à maratona), nutrição, "
            "equipamento e lesões. Com os seus dados do Runnex: 'minhas estatísticas', 'minhas últimas "
            "corridas', 'meus recordes' e 'minha meta'. Pra definir a meta semanal: 'meta: 20'."
        )
    raise ValueError(f"intenção desconhecida: {intencao}")


def gerar_resposta_generica(nome_usuario, pace_atual, distancia_frequente) -> str:
    nome = _saudacao_nome(nome_usuario)
    if pace_atual and distancia_frequente:
        return (
            f"Entendi{nome}. Você mencionou pace de {formatar_pace(pace_atual)} e distância de "
            f"{distancia_frequente:.0f}km anteriormente. Pode me dar mais detalhes sobre sua dúvida?"
        )
    return random.choice([
        f"Entendi{nome}. Pode me dar mais detalhes? Sobre qual aspecto específico você quer saber?",
        f"Pode reformular{nome}? Quero entender melhor sua dúvida para ajudar.",
        f"Me conta mais{nome}. Qual seu pace, distância, objetivo?",
    ])


# ---------------------------------------------------------------------------
# Comandos
# ---------------------------------------------------------------------------

def _comando_registrar() -> str:
    return (
        "No Runnex as corridas entram pelo GPS: toque em Correr (o botão do meio) e salve ao terminar. "
        "Assim ela conta pra XP, RunCoins e ranking — e aparece aqui nas suas estatísticas na hora."
    )


def _comando_meta(corpo: str, dados: DadosDoApp) -> Resposta:
    match = _META_RE.match(corpo)
    if not match:
        return Resposta("Formato: 'meta: 20' — é a meta semanal em km, a mesma da tela de Perfil.")
    km = float(match.group(1).replace(",", "."))
    if not 0 < km <= META_SEMANAL_MAX_KM:
        return Resposta(f"A meta semanal precisa ficar entre 0 e {META_SEMANAL_MAX_KM:g} km.")
    return Resposta(
        f"Meta semanal definida: {km:g} km. Nos últimos 7 dias você correu {km_ultimos_7_dias(dados):.1f} km.",
        nova_meta_semanal_km=km,
    )


def _comando_aprender(corpo: str, estado: EstadoConversa) -> str:
    partes = corpo.split("|")
    if len(partes) != 2:
        return "Formato incorreto. Use: 'aprender: pergunta | resposta'"
    pergunta, resposta = partes[0].strip(), partes[1].strip()
    if not pergunta or not resposta:
        return "Formato incorreto. Use: 'aprender: pergunta | resposta'"
    if len(pergunta) > MAX_PERGUNTA_APRENDIDA or len(resposta) > MAX_RESPOSTA_APRENDIDA:
        return (
            f"Muito longo pra eu guardar — até {MAX_PERGUNTA_APRENDIDA} caracteres na pergunta "
            f"e {MAX_RESPOSTA_APRENDIDA} na resposta."
        )
    chave = normalizar_texto(pergunta)
    if not chave:
        return "Formato incorreto. Use: 'aprender: pergunta | resposta'"

    aprendidas = estado.respostas_aprendidas
    existente = aprendidas.get(chave)
    if existente:
        existente["resposta"] = resposta
        existente["frequencia"] += 1
    elif len(aprendidas) >= MAX_RESPOSTAS_APRENDIDAS:
        return f"Já guardei {MAX_RESPOSTAS_APRENDIDAS} respostas suas, que é o meu limite."
    else:
        aprendidas[chave] = {"resposta": resposta, "frequencia": 1}
    return f"Aprendi! Agora sei responder sobre '{pergunta}'"


def _encontrar_resposta_similar(estado: EstadoConversa, pergunta_lower: str) -> Optional[str]:
    aprendidas = estado.respostas_aprendidas
    chave = normalizar_texto(pergunta_lower)
    if chave in aprendidas:
        aprendidas[chave]["frequencia"] += 1
        return aprendidas[chave]["resposta"]

    melhor_similaridade, melhor_chave = 0.0, None
    for chave_conhecida in aprendidas:
        similaridade = calcular_similaridade(chave, chave_conhecida)
        if similaridade > melhor_similaridade:
            melhor_similaridade, melhor_chave = similaridade, chave_conhecida
    if melhor_similaridade > 0.5 and melhor_chave:
        aprendidas[melhor_chave]["frequencia"] += 1
        return aprendidas[melhor_chave]["resposta"]
    return None


# ---------------------------------------------------------------------------
# Perguntas em linguagem natural
# ---------------------------------------------------------------------------

def _pergunta_sobre_dados(mensagem_lower: str, dados: DadosDoApp) -> Optional[str]:
    """Pedidos sobre os proprios dados do app. Vem antes da base de
    conhecimento: "meus recordes" caia no topico "recorde" (dicas de como
    bater recorde) em vez de mostrar os recordes do usuario."""
    if any(p in mensagem_lower for p in _PEDE_ESTATISTICAS):
        return texto_estatisticas(dados)
    if any(p in mensagem_lower for p in _PEDE_HISTORICO):
        return texto_historico(dados)
    if _PEDE_RECORDES.search(mensagem_lower) and (
        _POSSESSIVO.search(mensagem_lower) or re.search(r"\bpb\b|melhor(?:es)? tempos?", mensagem_lower)
    ) and not any(p in mensagem_lower for p in ["bater", "quebrar", "superar"]):
        return texto_recordes(dados)
    if _PEDE_META.search(mensagem_lower):
        return texto_meta(dados)
    return None


def _pace_referencia(
    pace_extraido: Optional[float], estado: EstadoConversa, dados: DadosDoApp
) -> tuple[Optional[float], str]:
    """Pace da mensagem > pace dito antes na conversa > pace medio das
    corridas do app. Devolve junto um aviso quando o pace veio das corridas,
    pra resposta deixar claro de onde saiu o numero."""
    pace = pace_extraido or estado.pace_informado
    if pace:
        return pace, ""
    pace = pace_medio_recente(dados.corridas)
    if pace:
        return pace, (
            f"\n\n(Usei o pace médio das suas últimas corridas no Runnex: {formatar_pace(pace)} min/km. "
            "Pra usar outro, me diga, ex.: 'pace 5:00'.)"
        )
    return None, ""


def _analisar_pergunta_complexa(
    mensagem_lower: str, pace_extraido: Optional[float], distancia_extraida: Optional[float],
    estado: EstadoConversa, dados: DadosDoApp,
) -> Optional[str]:
    if any(p in mensagem_lower for p in
           ["zona", "zonas", "zona de treino", "zona de treinamento", "qual zona", "minha zona", "zona principal"]):
        pace_usar, aviso = _pace_referencia(pace_extraido, estado, dados)
        if pace_usar and 1 < pace_usar < 15:
            for zona_nome in ZONAS_TREINO:
                if zona_nome in mensagem_lower:
                    texto = texto_zona_especifica(pace_usar, zona_nome)
                    if texto:
                        return texto + aviso
            return texto_zonas_treino(pace_usar) + aviso
        return "Me diga seu pace para eu calcular suas zonas de treinamento. Exemplo: 'pace 4:25' ou 'corro a 4:25 por km'"

    tempo_keywords = [
        "quanto tempo", "tempo estimado", "tempo total", "tempo previsto", "qual tempo", "que tempo",
        "quanto levaria", "quanto leva", "quanto demora", "faria", "levaria", "completaria", "terminaria",
        "tempo de percurso", "tempo do percurso",
    ]
    if any(p in mensagem_lower for p in tempo_keywords):
        pace_usar, aviso = _pace_referencia(pace_extraido, estado, dados)
        distancia_usar = distancia_extraida or estado.distancia_frequente
        if not pace_usar:
            return "Me diga seu pace para eu calcular o tempo. Exemplo: 'pace 4:25' ou 'corro a 4:25 por km'"
        if not distancia_usar:
            return "Me diga a distância para eu calcular o tempo. Exemplo: '42km' ou 'maratona'"
        return calcular_tempo_estimado_texto(pace_usar, distancia_usar) + aviso

    maratona = prova_mencionada(mensagem_lower) == "maratona"
    if pace_extraido and maratona:
        return texto_pace_maratona(pace_extraido, mensagem_lower)

    if maratona and any(p in mensagem_lower for p in ["preparar", "treinar", "plano", "manter"]):
        return random.choice(RESPOSTAS_TREINADAS["preparacao_maratona"])

    if (any(p in mensagem_lower for p in ["melhorar", "evoluir", "abaixar"])
            and any(p in mensagem_lower for p in ["pace", "ritmo"])):
        pace_usar, aviso = _pace_referencia(pace_extraido, estado, dados)
        if pace_usar:
            return texto_melhoria_pace(pace_usar) + aviso
        return CONHECIMENTO["como_melhorar_pace"]["curta"]

    if any(p in mensagem_lower for p in ["o que é", "o que significa", "explique", "me explica", "como funciona"]):
        direta = responder_pergunta_direta(mensagem_lower)
        if direta:
            return direta

    return None


# ---------------------------------------------------------------------------
# Ponto de entrada
# ---------------------------------------------------------------------------

def responder(mensagem_original: str, estado: EstadoConversa, dados: DadosDoApp) -> Resposta:
    """Responde uma mensagem. Atualiza `estado` in-place (quem chama salva)."""
    mensagem_lower = mensagem_original.lower().strip()

    if estado.aguardando_aprofundamento and any(
        p in mensagem_lower for p in ["mais", "detalhe", "explica", "continua", "aprofundar", "quero saber mais"]
    ):
        estado.aguardando_aprofundamento = False
        if estado.ultimo_topico_explicado and estado.ultimo_topico_explicado in CONHECIMENTO:
            return Resposta(CONHECIMENTO[estado.ultimo_topico_explicado]["detalhada"])

    pace, distancia = extrair_pace_e_distancia(mensagem_lower)
    if pace is not None:
        estado.pace_informado = pace
    if distancia is not None:
        estado.distancia_frequente = distancia

    objetivo = detectar_objetivo(mensagem_lower)
    if objetivo:
        estado.objetivo_principal = objetivo
    nivel = detectar_nivel(mensagem_lower)
    if nivel:
        estado.nivel = nivel

    if mensagem_lower.startswith("registrar:"):
        return Resposta(_comando_registrar())
    if mensagem_lower.startswith("meta:"):
        return _comando_meta(mensagem_original.strip()[len("meta:"):], dados)
    if mensagem_lower.startswith("aprender:"):
        return Resposta(_comando_aprender(mensagem_original.strip()[len("aprender:"):], estado))

    aprendida = _encontrar_resposta_similar(estado, mensagem_lower)
    if aprendida:
        return Resposta(aprendida)

    sobre_dados = _pergunta_sobre_dados(mensagem_lower, dados)
    if sobre_dados:
        return Resposta(sobre_dados)

    complexa = _analisar_pergunta_complexa(mensagem_lower, pace, distancia, estado, dados)
    if complexa:
        return Resposta(complexa)

    intencao = identificar_intencao(mensagem_lower)
    if intencao:
        return Resposta(texto_intencao(intencao, estado, dados))

    curto = buscar_conhecimento_curto(mensagem_lower)
    if curto:
        topico, texto = curto
        estado.ultimo_topico_explicado = topico
        estado.aguardando_aprofundamento = True
        return Resposta(texto)

    if "obrigado" in mensagem_lower or "valeu" in mensagem_lower:
        return Resposta(random.choice(_AGRADECIMENTOS))

    return Resposta(gerar_resposta_generica(dados.nome, estado.pace_informado, estado.distancia_frequente))
