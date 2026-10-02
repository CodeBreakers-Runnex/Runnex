// Identifica a versão dos termos aceita por cada usuário no cadastro.
// Atualize junto com a data em "Última atualização" abaixo.
export const LEGAL_VERSION = "2026-10-01";

// Cada afirmação deste texto foi conferida com o código em 01/10/2026
// (o que é coletado, onde fica e quem vê). Ao mudar o que o app coleta ou
// mostra a outros usuários, atualize o texto e LEGAL_VERSION juntos.
export const legalContent = `
TERMOS DE USO E POLÍTICA DE PRIVACIDADE — RUNNEX
Última atualização: 01/10/2026

O Runnex é um aplicativo de corrida desenvolvido como projeto acadêmico pela equipe CodeBreakers, de Campinas-SP, disponível para Android e na web. Este documento tem duas partes: os Termos de Uso (regras de uso do aplicativo) e a Política de Privacidade (quais dados coletamos, para quê, quem vê e quais são os seus direitos).
Ao criar uma conta, você declara ter lido e aceitado as duas partes. Se não concordar, não utilize o aplicativo.


PARTE I — TERMOS DE USO

1. O QUE O RUNNEX OFERECE
• Registro de corridas por GPS, com distância, tempo, ritmo, calorias estimadas e o traçado do percurso no mapa;
• Estatísticas, meta semanal de quilometragem, pontos de experiência (XP), níveis e conquistas;
• Ranking e feed de corridas da comunidade;
• Grupos de corrida com publicações, comentários e chat;
• Lista de eventos esportivos de terceiros, com opção de salvar o evento e abrir o site oficial do organizador;
• Pet virtual que evolui com os seus treinos e ganha acessórios comprados com RunCoins, a moeda interna do aplicativo;
• Treinador virtual, que responde dúvidas sobre corrida com base em regras pré-definidas e nas suas próprias corridas;
• Atalho para abrir playlists de corrida em aplicativos de música. O Runnex não se conecta à sua conta nesses aplicativos nem troca dados com eles.

2. CONTA
Você pode criar uma conta com nome de usuário, e-mail e senha (com confirmação do e-mail) ou entrar com uma conta Google.
Ao se cadastrar, você declara que:
• Tem pelo menos 16 (dezesseis) anos;
• As informações fornecidas são verdadeiras;
• É responsável pelo sigilo da sua senha e pelas ações feitas na sua conta.

3. AVISO SOBRE SAÚDE
O Runnex é uma ferramenta de acompanhamento e motivação esportiva. Ele não oferece aconselhamento médico, diagnóstico ou tratamento.
Calorias, ritmo e demais métricas são estimativas e podem ter imprecisões. As orientações do treinador virtual são gerais e não substituem um profissional de educação física ou de saúde.
Consulte um médico antes de iniciar um programa de atividade física, especialmente se tiver alguma condição de saúde. A prática esportiva é de sua responsabilidade.

4. XP, RUNCOINS E REGRAS CONTRA FRAUDE
XP, níveis, conquistas e RunCoins existem apenas dentro do aplicativo. RunCoins não têm valor em dinheiro, não podem ser trocadas por produtos, descontos ou serviços e servem somente para comprar acessórios do pet virtual.
As corridas são conferidas pelo servidor (velocidade média, coerência entre a distância e o percurso registrado e tempo total por dia). Corridas que não passarem nessas verificações não são salvas.
É proibido simular treinos ou usar qualquer artifício para obter pontos indevidos. Constatada fraude, pontos, RunCoins e conquistas podem ser cancelados e a conta pode ser suspensa.

5. EVENTOS DE TERCEIROS
O Runnex lista eventos esportivos organizados por terceiros. Ao salvar um evento, o aplicativo abre o site oficial do organizador, onde a inscrição é feita.
Organização, alterações, cancelamentos e inscrições são de responsabilidade exclusiva do organizador do evento.

6. CONTEÚDO PUBLICADO E COMUNIDADE
Você continua dono do que publicar (corridas, fotos, publicações, comentários e mensagens) e autoriza o Runnex a exibir esse conteúdo dentro do aplicativo enquanto ele existir.
Você se compromete a não publicar conteúdo ofensivo, discriminatório, ilegal, que viole direitos de terceiros ou que exponha dados pessoais de outras pessoas sem autorização. Conteúdo que viole estes Termos pode ser removido.

7. CONDUTAS PROIBIDAS
• Usar o aplicativo para fins ilícitos;
• Tentar acessar dados de outros usuários ou áreas restritas do sistema;
• Usar robôs, scripts ou qualquer automação para interagir com o serviço;
• Assediar ou ameaçar outros usuários;
• Criar várias contas para burlar limites, pontuações ou rankings.

8. DISPONIBILIDADE E RESPONSABILIDADE
Por ser um projeto acadêmico hospedado em serviços gratuitos ou de baixo custo, o Runnex pode ficar lento ou indisponível em alguns momentos (por exemplo, o servidor pode levar até um minuto para responder após um período sem uso).
O Runnex não se responsabiliza por imprecisões causadas pelo sinal de GPS, por falhas de serviços de terceiros ou por perda de dados causada por falhas do aparelho ou da conexão.

9. ENCERRAMENTO DA CONTA
Você pode apagar todas as suas corridas pela opção "Apagar minhas corridas" e excluir sua conta a qualquer momento pela opção "Excluir minha conta", nas configurações do perfil. O que é apagado está descrito na seção 20.
Contas que violem estes Termos podem ser suspensas ou encerradas; em casos de fraude ou risco à segurança, a suspensão pode ser imediata.

10. PROPRIEDADE INTELECTUAL
A marca, o layout e o código do Runnex pertencem aos seus desenvolvedores. É vedado reproduzir ou explorar comercialmente o serviço sem autorização.

11. ALTERAÇÕES
Estes Termos e a Política de Privacidade podem ser atualizados. A data da versão em vigor aparece no topo deste documento, e o aplicativo registra qual versão você aceitou. Mudanças relevantes, principalmente sobre o uso de dados pessoais, serão comunicadas no aplicativo.

12. LEI E FORO
Este documento é regido pelas leis do Brasil. Fica eleito o foro da comarca de Campinas-SP, ressalvado o foro do domicílio do consumidor quando aplicável.


PARTE II — POLÍTICA DE PRIVACIDADE

Esta política segue a Lei Geral de Proteção de Dados Pessoais (Lei nº 13.709/2018 — LGPD).

13. QUEM CUIDA DOS SEUS DADOS
O controlador dos dados é a equipe CodeBreakers, responsável pelo Runnex. Dúvidas, pedidos e reclamações sobre dados pessoais podem ser enviados para runnexoficial@gmail.com, que funciona como canal do encarregado de dados.

14. QUAIS DADOS COLETAMOS
a) Cadastro: nome de usuário e e-mail. A senha é guardada pelo Firebase Authentication (Google) de forma protegida; o Runnex nunca tem acesso a ela. No login com Google, recebemos nome, e-mail e foto da conta Google.
b) Perfil (opcional): foto, bio, cidade, meta semanal e a configuração de perfil público ou privado.
c) Corridas: distância, duração, ritmo, calorias estimadas, data e hora e o traçado do percurso (sequência de pontos de latitude e longitude).
d) Comunidade: grupos dos quais participa, publicações e fotos publicadas nos grupos, comentários, mensagens de chat, curtidas e eventos salvos.
e) Gamificação: XP, nível, RunCoins, espécie e nome do pet e acessórios.
f) Treinador virtual: para manter o contexto da conversa, o servidor guarda o ritmo e a distância que você informar, seu objetivo, seu nível e as respostas que você ensinar a ele. O histórico das mensagens fica apenas no seu aparelho.
g) Aceite destes termos: a versão aceita e a data do aceite.
h) Dados técnicos: registros de erros e de requisições gerados pelo servidor e pelos provedores de hospedagem, e uma contagem temporária de requisições por usuário, mantida apenas em memória, para limitar abusos.

O Runnex NÃO coleta: contatos do aparelho, dados de pagamento, dados de sensores de saúde ou de passos, nem a sua localização fora de uma corrida em andamento. O aplicativo não usa ferramentas de publicidade, de análise de comportamento ou de rastreamento.

15. LOCALIZAÇÃO
A localização só é registrada enquanto uma corrida está em andamento, inclusive com o aplicativo em segundo plano. Nesse caso, o Android exibe uma notificação fixa informando que a corrida está sendo registrada. O acesso depende da sua permissão no sistema e pode ser revogado a qualquer momento nas configurações do aparelho.
Enquanto a corrida não é salva, o percurso fica guardado apenas no aparelho, para que ela possa ser retomada se o aplicativo for fechado.
Na tela de eventos, a opção "Usar minha localização" usa a sua posição apenas no aparelho, para mostrar a distância até cada evento; ela não é enviada ao servidor.

16. PARA QUE USAMOS E COM QUAL BASE LEGAL
• Criar e manter sua conta, registrar corridas, calcular estatísticas, XP, ranking, pet e respostas do treinador: execução do serviço que você contratou ao criar a conta (art. 7º, V, da LGPD);
• Exibir suas corridas e seu perfil para outros usuários quando o perfil é público: seu consentimento, que pode ser retirado a qualquer momento tornando o perfil privado (art. 7º, I);
• Prevenir fraudes, abusos e ataques (verificação das corridas, limite de requisições e registros técnicos): legítimo interesse em manter o serviço seguro (art. 7º, IX);
• Registrar a versão dos termos aceita: comprovar o seu aceite.
Seus dados não são vendidos nem usados para publicidade.

17. QUEM PODE VER SEUS DADOS
• Perfil público (padrão): seu nome, foto, nível, estatísticas e suas corridas, incluindo o traçado completo do percurso no mapa, aparecem no feed, no ranking e no seu perfil para outros usuários do aplicativo;
• Perfil privado: seu perfil e suas corridas ficam visíveis apenas para você e você não aparece nos rankings;
• Grupos: o que você publica em um grupo (publicações, comentários, mensagens), com seu nome e foto, é visto pelos membros daquele grupo, mesmo com o perfil privado;
• Seus dados de cadastro (e-mail) não são exibidos a outros usuários.
Atenção: como corridas costumam começar e terminar perto de casa, o traçado público pode indicar onde você mora ou trabalha. Se isso for uma preocupação, use o perfil privado.

18. COM QUEM COMPARTILHAMOS
Os dados são tratados por provedores que operam a infraestrutura do Runnex, apenas para essa finalidade:
• Google Firebase: autenticação (login, senha e confirmação de e-mail), hospedagem do site e um registro auxiliar de preferências da conta;
• Render: servidor do aplicativo e banco de dados onde ficam perfil, corridas, grupos, pet e memória do treinador.
Esses provedores podem armazenar dados em servidores fora do Brasil. Nesses casos, a transferência internacional ocorre para a execução do serviço e sob as garantias contratuais dos próprios provedores (art. 33 da LGPD).
O atalho para aplicativos de música apenas abre o aplicativo ou site escolhido; nenhum dado seu é enviado a eles. Os eventos são de terceiros, e a inscrição ocorre no site do organizador, sob a política de privacidade dele.

19. DADOS GUARDADOS NO SEU APARELHO
O aplicativo guarda no próprio aparelho: tema, unidade de distância e outras preferências, o histórico de mensagens do treinador e a corrida em andamento ainda não salva. Esses dados podem ser incluídos no backup automático do Android da sua conta Google e são apagados ao desinstalar o aplicativo ou limpar os dados dele.

20. POR QUANTO TEMPO GUARDAMOS
Os dados ficam guardados enquanto a sua conta existir.
• "Apagar minhas corridas" apaga todas as suas corridas e zera seu XP e sua quilometragem;
• "Excluir minha conta" apaga, de forma permanente, seu login, perfil, corridas, pet, memória do treinador, publicações, comentários, mensagens, curtidas, participação em grupos e eventos salvos. Grupos criados por você passam para o membro mais antigo e só são apagados se ficarem vazios;
• Registros técnicos mantidos pelos provedores de hospedagem são apagados conforme os prazos desses provedores.

21. SEUS DIREITOS
Pela LGPD (art. 18), você pode: confirmar se tratamos seus dados; acessar seus dados; corrigir dados incompletos ou desatualizados; pedir a portabilidade; pedir a eliminação; saber com quem os dados são compartilhados; e retirar o consentimento.
• No próprio aplicativo: editar o perfil, tornar o perfil privado, apagar suas corridas e excluir a conta;
• Por e-mail (runnexoficial@gmail.com): pedir uma cópia dos seus dados ou qualquer outro direito acima. Responderemos em até 15 dias.
Você também pode apresentar reclamação à Autoridade Nacional de Proteção de Dados (ANPD).

22. SEGURANÇA
Toda a comunicação com o servidor é criptografada (HTTPS); senhas ficam a cargo do Firebase Authentication; cada usuário só pode alterar os próprios dados; e as corridas e ações são conferidas pelo servidor, com limite de requisições por usuário. Nenhum sistema é totalmente imune a falhas. Se houver um incidente de segurança que possa trazer risco aos usuários, ele será comunicado aos afetados e à ANPD (art. 48 da LGPD).

23. CRIANÇAS E ADOLESCENTES
O Runnex é destinado a pessoas com 16 anos ou mais. Se identificarmos dados de alguém abaixo dessa idade, a conta será excluída.

24. CONTATO
runnexoficial@gmail.com
`;
