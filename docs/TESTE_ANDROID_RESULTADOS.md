# Resultados do roteiro Android (preencher no aparelho)

Modelo para registrar a execução de [`TESTE_ANDROID.md`](TESTE_ANDROID.md). Só os
passos que **exigem aparelho real** (GPS, segundo plano, login nativo, Android
matando o app). Detalhes de cada passo estão no roteiro completo.

Resultado: ✅ passou · ❌ falhou (descrever) · ⚠️ passou com ressalva · ⚪ não executado

| Campo | Valor |
|---|---|
| Aparelho / fabricante | |
| Versão do Android | |
| Economia de bateria | ligada / desligada |
| APK (versionName / versionCode) | 0.1.4 / 2 |
| Backend usado (URL) | |
| Data | |
| Quem testou | |

## Passos obrigatórios

| # | Passo (resumo) | Resultado | Observação (o que aconteceu, números) |
|---|---|---|---|
| 1.1 | Criar conta e-mail/senha → tela "Confirme seu email" | | |
| 1.4 | Login com Google pelo seletor nativo | | |
| 1.5 | Fechar pelo multitarefa e reabrir → continua logado | | |
| 2.1 | Primeira corrida pede permissão de localização e notificação | | |
| 2.2 | Negar localização → mensagem clara, sem travar | | |
| 2.3 | Correr ~500 m → distância sobe, rota no mapa, notificação fixa | | |
| 2.4 | Tela bloqueada 3 min andando → trecho contado | | |
| 2.5 | Outro app em primeiro plano 2 min → trecho contado | | |
| 2.6 | Pausar, andar 100 m, retomar → trecho pausado **não** conta e a distância **volta a subir** depois de retomar (correção P1-01) | | |
| 2.7 | Finalizar e salvar → aparece na Home/Feed/Perfil; XP e RunCoins sobem | | |
| 2.8 | Distância comparada com outro app (Strava/Google Fit) | | Diferença: ___ % |
| 2.9 | Trecho de carro/ônibus → ignorado | | |
| 2.10 | Forçar fechamento no meio → oferece "continuar corrida" | | |
| 2.11 | Iniciar e finalizar parado → "Corrida cancelada", sem erro | | |
| 2.12 | Salvar sem internet → erro claro; recupera depois | | |
| 3.3 | Chat do grupo chega em tempo real no aparelho (WebSocket) | | |
| 5.3 | Excluir conta Google (conta de teste) | | |
| 6.1 | Abrir com backend hibernado → sem tela branca | | |
| 6.3 | Botão voltar do Android em cada tela | | |

## Bugs encontrados

| # do passo | Aparelho | Esperado | Aconteceu | Print/vídeo |
|---|---|---|---|---|
| | | | | |
