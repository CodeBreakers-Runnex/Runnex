"""Conversa com o treinador virtual no terminal, sem banco nem login.

Usa o mesmo motor do POST /chatbot/message (app/chatbot_logic.py), com
corridas de exemplo no lugar das corridas reais e a memoria da conversa so
enquanto o script roda. Substitui o antigo chatbot_runnex.py para testar
respostas rapido:

    cd backend
    python scripts/chatbot_cli.py
    python scripts/chatbot_cli.py --sem-corridas
"""

import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.chatbot_logic import Corrida, DadosDoApp, EstadoConversa, responder  # noqa: E402

BRASILIA = timezone(timedelta(hours=-3))


def corridas_de_exemplo(agora: datetime) -> list[Corrida]:
    # (dias atras, km, minutos) — mais recente primeiro, como vem do banco
    exemplo = [(1, 5.2, 29.5), (3, 10.1, 58), (5, 4.0, 22), (9, 21.3, 128), (14, 5.0, 26.5)]
    return [
        Corrida(distancia_km=km, duracao_s=int(minutos * 60), quando=agora - timedelta(days=dias))
        for dias, km, minutos in exemplo
    ]


def main() -> None:
    # Console do Windows nao e UTF-8 por padrao: sem isso os acentos saem trocados.
    for stream in (sys.stdout, sys.stdin):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")

    agora = datetime.now(timezone.utc)
    sem_corridas = "--sem-corridas" in sys.argv[1:]
    dados = DadosDoApp(
        nome="Corredor",
        corridas=[] if sem_corridas else corridas_de_exemplo(agora),
        meta_semanal_km=None if sem_corridas else 25,
        agora=agora,
        fuso=BRASILIA,
    )
    estado = EstadoConversa()

    print("Treinador virtual do Runnex — digite 'sair' para encerrar.")
    if not sem_corridas:
        print("(usando 5 corridas de exemplo e meta semanal de 25 km)")

    while True:
        try:
            mensagem = input("\nVocê: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break
        if not mensagem:
            continue
        if mensagem.lower() in ("sair", "exit", "quit"):
            break
        resposta = responder(mensagem, estado, dados)
        if resposta.nova_meta_semanal_km is not None:
            dados.meta_semanal_km = resposta.nova_meta_semanal_km
        print(f"\nTreinador: {resposta.texto}")


if __name__ == "__main__":
    main()
