# Roteiro de teste em Android real

O que os testes automatizados **não** cobrem: GPS de verdade, serviço em segundo
plano, login Google nativo e o comportamento do Android ao matar o app. Este
roteiro existe para isso. Rodar num aparelho físico (não emulador), com o backend
de produção (Render) e o APK gerado por `npm run android:apk`.

Anote em cada item: ✅ passou, ❌ falhou (com o que aconteceu) ou ⚠️ passou com ressalva.
Leva cerca de 1h30, incluindo duas corridas curtas na rua.

**Aparelho:** ______________ **Android:** ____ **Data:** ________ **Commit/APK:** ________

## 0. Preparação

- [ ] Backend no ar: abrir `https://<sua-api>.onrender.com/docs` no navegador do celular (o plano gratuito do Render hiberna; a primeira request pode levar ~1 min).
- [ ] Desinstalar versões antigas do app antes de instalar o APK novo.
- [ ] Deixar a bateria acima de 50% e desligar a economia de bateria no primeiro teste.

## 1. Conta e login

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 1.1 | Criar conta com e-mail/senha | Cai na tela "Confirme seu email"; o e-mail chega | |
| 1.2 | Tentar usar o app sem confirmar | Continua bloqueado na tela de confirmação | |
| 1.3 | Confirmar pelo link e voltar ao app | Entra normalmente | |
| 1.4 | Sair e entrar com Google (seletor nativo) | Entra; foto do Google aparece no perfil | |
| 1.5 | Fechar o app pelo multitarefa e abrir de novo | Continua logado | |

## 2. Corrida com GPS (o teste mais importante)

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 2.1 | Abrir "Iniciar corrida" pela primeira vez | Pede permissão de localização e de notificação | |
| 2.2 | Negar a localização | Mensagem clara, sem travar a tela | |
| 2.3 | Conceder e iniciar; caminhar/correr ~500 m | Distância sobe; rota desenha no mapa; notificação fixa "corrida ativa" | |
| 2.4 | Bloquear a tela por 3 min continuando a andar | Ao desbloquear, a distância incluiu o trecho com tela apagada | |
| 2.5 | Ir para outro app (WhatsApp) por 2 min andando | Mesma coisa: o trecho foi contado | |
| 2.6 | Pausar, andar 100 m, retomar | O trecho pausado **não** entra na distância | |
| 2.7 | Finalizar e salvar | "Corrida salva"; aparece na Home, no Feed e no Perfil; XP e RunCoins aumentam | |
| 2.8 | Comparar a distância com outro app (Strava, Google Fit) na mesma volta | Diferença de até ~5–10% | |
| 2.9 | Fazer um trecho de carro/ônibus com a corrida ativa | Trecho ignorado ("velocidade alta"); não soma km | |
| 2.10 | Iniciar, andar 200 m e **forçar o fechamento** do app | Ao reabrir, oferece "continuar corrida"; ao continuar, o cronômetro e a distância seguem | |
| 2.11 | Iniciar e finalizar parado (0 km) | "Corrida cancelada — nenhuma distância percorrida", sem erro | |
| 2.12 | Salvar sem internet (modo avião no fim) | Mensagem de erro clara; ao voltar a internet, a corrida pode ser recuperada e salva | |

> Se o 2.4/2.5 falhar só com a economia de bateria ligada, anote o fabricante:
> Xiaomi, Samsung e Motorola matam serviços em segundo plano de forma agressiva.
> É limitação conhecida do Android, não necessariamente bug do app. Vale citar na banca.

## 3. Social, grupos e tempo real (precisa de 2 aparelhos ou 1 celular + navegador)

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 3.1 | Criar um grupo no aparelho A | Grupo aparece na lista | |
| 3.2 | Entrar no grupo com a conta B (navegador) | Membros = 2 | |
| 3.3 | Mandar mensagem no chat de B | Aparece em A **sem recarregar** (WebSocket) | |
| 3.4 | Publicar post em A, curtir e comentar em B | Contadores atualizam nos dois | |
| 3.5 | Salvar uma corrida em A | "km da semana" do grupo aumenta | |
| 3.6 | Marcar perfil como privado em A | B não vê o perfil nem as corridas de A; A some do ranking global | |

## 4. Pet

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 4.1 | Escolher espécie e nome | Pet aparece; não dá para escolher de novo | |
| 4.2 | Comprar um item da loja com RunCoins suficientes | Saldo cai exatamente o preço do item | |
| 4.3 | Tentar comprar sem saldo | "RunCoins insuficientes", saldo intacto | |
| 4.4 | Equipar e desequipar acessório | Visual do pet muda | |

## 5. Conta e privacidade

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 5.1 | Trocar tema claro/escuro | Todas as telas legíveis nos dois temas | |
| 5.2 | Abrir Termos e Privacidade | Texto carrega; opção "Excluir minha conta" citada | |
| 5.3 | Excluir conta **Google** (use uma conta de teste) | Pede confirmação Google; depois volta ao login; entrar de novo cria perfil zerado | |
| 5.4 | Excluir conta **e-mail/senha** com senha errada | "Email ou senha incorretos"; nada é apagado | |
| 5.5 | Mesmo passo com a senha certa | Conta apagada; login antigo não funciona mais | |

## 6. Robustez

| # | Passo | Esperado | Resultado |
|---|---|---|---|
| 6.1 | Abrir o app com o backend hibernado (Render) | Carrega (lento na 1ª vez), sem tela branca | |
| 6.2 | Girar a tela | Layout se ajusta ou fica travado em retrato, sem quebrar | |
| 6.3 | Botão "voltar" do Android em cada tela | Volta à tela anterior; na Home, sai do app | |
| 6.4 | Aumentar a fonte do sistema para o máximo | Textos principais não cortam | |

## Depois do teste

Bugs encontrados viram issues no GitHub com: passo, aparelho, o que era esperado,
o que aconteceu, e print/vídeo. Os resultados dos itens 2.4, 2.8 e 2.10 são bons
números para a apresentação ("testado em aparelho X, erro de distância de Y%").
