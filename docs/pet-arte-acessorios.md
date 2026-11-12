# Arte dos acessórios do pet

Briefing para gerar as imagens de todos os acessórios. Total: **93 itens → 165 arquivos**
(93 ícones/artes + 72 versões por espécie de Corpo/Pés épicos e lendários).

## Especificações técnicas

| | Cabeça, Pescoço, ícones | Fundo | Corpo/Pés por espécie |
|---|---|---|---|
| Formato | PNG ou WebP | WebP ou JPG | PNG ou WebP |
| Tamanho | 512×512 | 1024×1024 | 1254×1254 (igual ao original do pet) |
| Fundo | **transparente** | opaco, preenche tudo | **transparente** |
| Enquadramento | só o objeto, centralizado, ~10% de margem | cenário inteiro, sem personagem | só a peça, na posição exata do corpo do pet |
| Ângulo | 3/4 olhando pra **direita** (igual aos pets) | horizonte baixo, centro vazio (o pet fica ali) | mesma pose da ilustração original |

### Estilo (manter em TODOS)
- Mesmo traço dos pets: anime/cel-shading, contorno escuro fino, sombras suaves.
- Paleta da marca: preto/grafite + **roxo neon (#7C3AED ~ #A855F7)**; dourado só em raros/lendários.
- Sem texto além de "rx"/números pedidos. Sem marcas reais nem escudos oficiais (Nike, CBF etc.).
- Raridade visível no acabamento: Comum = simples/fosco · Raro = detalhes · Épico = brilho/efeito · Lendário = brilho forte, partículas, dourado.

### Prompt base (troque o trecho entre colchetes)
> Single game accessory icon: [DESCRIÇÃO], anime cel-shaded illustration, thin dark outline, black and neon purple color palette, 3/4 view facing right, centered, isolated on transparent background, no text, no character, high detail, 512x512

Para **fundos**:
> Anime cel-shaded background scene: [DESCRIÇÃO], soft depth of field, no characters, empty space in the center-bottom for a mascot, purple accent lighting, square 1024x1024

Para **Corpo/Pés por espécie** (o mais difícil — use a imagem original do pet como referência/img2img):
> Same exact character and pose as the reference image, now wearing [DESCRIÇÃO]. Keep everything else identical. Then output ONLY the clothing item on transparent background, same canvas size and position.

O jeito mais confiável: gere o pet vestido (img2img com a ilustração original) e **apague o pet** num editor, deixando só a peça na mesma posição do canvas. Assim ela encaixa sem ajuste.

### Nomes de arquivo
- Ícone/arte única: `<id>.webp` → ex.: `store-coroa-diamante.webp`
- Por espécie: `<id>__<espécie>.webp`, espécies: `guepardo`, `lebre`, `cavalo`, `falcao`, `galgo`, `tartaruga`
  → ex.: `store-asas-fenix__cavalo.webp`

### Como funciona no app
- Cabeça e Pescoço: 1 arte serve pra todos; o app posiciona por espécie (`PET_ANCHORS` em `src/lib/pet.ts`).
- Fundo: cobre o quadro atrás do pet.
- Corpo e Pés: só aparecem **vestidos** com a arte da espécie; sem ela, o ícone aparece na loja e um selo no canto do pet.
- Item sem arte continua com emoji — dá pra entregar aos poucos.

### Ordem sugerida
1. 12 de conquista (todo usuário vê) · 2. Lendários · 3. Épicos · 4. Fundos · 5. Resto.

## Cabeça (21 itens)

| Arquivo | Nome | Raridade | Descrição |
|---|---|---|---|
| `acc-5k.webp` | Boné 5K | Conquista | boné esportivo preto com aba curva e '5K' em roxo neon na frente |
| `acc-1hora.webp` | Viseira cronometrada | Conquista | viseira esportiva preta com um pequeno cronômetro digital na aba marcando 1:00:00 |
| `acc-sub10k.webp` | Óculos de velocidade | Conquista | óculos esportivos espelhados envolventes com reflexo roxo |
| `acc-1ano.webp` | Coroa do ano | Conquista | coroa dourada com pedras roxas e o número 1 no centro |
| `store-cartola.webp` | Cartola clássica | Comum | cartola preta clássica com faixa roxa |
| `store-oculos.webp` | Óculos escuros | Comum | óculos escuros estilo aviador, lentes pretas |
| `store-bandana.webp` | Bandana de treino | Comum | bandana de corrida preta com estampa paisley roxa, amarrada |
| `store-faixa.webp` | Faixa de suor | Comum | faixa de testa atoalhada preta com logo 'rx' roxo |
| `store-gorro.webp` | Gorro de inverno | Comum | gorro de lã preto com pompom roxo |
| `store-chapeu-sol.webp` | Chapéu de sol | Comum | chapéu de palha de aba larga com fita roxa |
| `store-capacete.webp` | Capacete de ciclista | Comum | capacete de ciclismo aerodinâmico preto com frisos roxos |
| `store-fone.webp` | Fone de corrida | Raro | fone de ouvido esportivo over-ear preto com detalhes roxos neon |
| `store-chapeu-cowboy.webp` | Chapéu de cowboy | Raro | chapéu de cowboy de couro marrom escuro com faixa roxa |
| `store-tiara-flores.webp` | Tiara de flores | Raro | tiara de flores do campo lilás, brancas e roxas |
| `store-chapeu-festa.webp` | Chapéu de festa | Raro | chapéu cônico de festa roxo com bolinhas e pompom dourado |
| `store-chapeu-mago.webp` | Chapéu de mago | Épico | chapéu de mago pontudo roxo escuro com estrelas e luas douradas |
| `store-aureola.webp` | Auréola | Épico | auréola dourada brilhante flutuando |
| `store-capacete-astronauta.webp` | Capacete de astronauta | Épico | capacete de astronauta com viseira espelhada roxa (aberto atrás, só o capacete) |
| `store-chifres-neon.webp` | Chifres neon | Épico | par de chifres pequenos em roxo neon brilhante |
| `store-coroa-diamante.webp` | Coroa de diamante | Lendário | coroa de platina coberta de diamantes com brilho, gema roxa central |
| `store-coroa-louros.webp` | Coroa de louros olímpica | Lendário | coroa de louros dourada olímpica, folhas metálicas brilhantes |

## Pescoço (18 itens)

| Arquivo | Nome | Raridade | Descrição |
|---|---|---|---|
| `acc-primeira-corrida.webp` | Lenço de estreia | Conquista | lenço triangular roxo amarrado, com o número 1 bordado em branco |
| `acc-streak3.webp` | Coleira de fogo | Conquista | coleira preta com chamas laranja/roxas saindo dela |
| `acc-100treinos.webp` | Medalha de veterano | Conquista | medalha de bronze escuro com fita roxa e o número 100 gravado |
| `store-cachecol.webp` | Cachecol | Comum | cachecol de lã listrado preto e roxo, pontas penduradas |
| `store-laco.webp` | Laço | Comum | laço de fita roxo brilhante |
| `store-apito.webp` | Apito de treinador | Comum | apito de treinador prateado num cordão roxo |
| `store-gravata.webp` | Gravata | Comum | gravata preta com listras diagonais roxas |
| `store-numero-peito.webp` | Número de peito | Comum | número de peito de corrida branco com '42' em preto e alfinetes |
| `store-colar-perolas.webp` | Colar de pérolas | Comum | colar de pérolas brancas brilhantes |
| `store-cronometro.webp` | Cronômetro de pescoço | Raro | cronômetro analógico prateado pendurado num cordão |
| `store-sino.webp` | Sininho | Raro | sininho dourado numa coleira de couro roxa |
| `store-colar-trevo.webp` | Colar de trevo | Raro | colar com pingente de trevo de quatro folhas verde esmeralda |
| `store-medalha-bronze.webp` | Medalha de bronze | Raro | medalha de bronze com fita listrada roxa e branca |
| `store-medalha-prata.webp` | Medalha de prata | Épico | medalha de prata polida com fita roxa e branca |
| `store-colar-raio.webp` | Colar relâmpago | Épico | colar com pingente de raio em roxo neon, brilhando |
| `store-amuleto-lua.webp` | Amuleto lunar | Épico | amuleto de lua crescente prateada com pedra roxa, corrente fina |
| `store-medalha-ouro.webp` | Medalha de ouro | Lendário | medalha de ouro grande e brilhante com fita roxa, raios de luz |
| `store-capa-heroi.webp` | Capa de herói | Lendário | capa de super-herói roxa esvoaçante presa por broche dourado com 'rx' |

## Corpo (19 itens)

Épico e Lendário: **6 arquivos por item**, um vestido em cada pet (`<id>__<espécie>.webp`). Comum e Raro: só o ícone (`<id>.webp`).

| Arquivo | Nome | Raridade | Descrição |
|---|---|---|---|
| `store-regata.webp` | Regata de treino | Comum | regata de corrida preta com recortes roxos e 'rx' no peito |
| `store-camiseta-prova.webp` | Camiseta de prova | Comum | camiseta de prova branca com número e logo de maratona |
| `store-corta-vento.webp` | Corta-vento | Comum | jaqueta corta-vento leve roxa com zíper preto |
| `store-colete-refletivo.webp` | Colete refletivo | Comum | colete refletivo amarelo-limão com faixas prateadas |
| `store-pochete.webp` | Pochete de hidratação | Comum | pochete de corrida preta com garrafinha de água |
| `store-mochila.webp` | Mochila de trail | Comum | mochila de trail compacta preta com detalhes roxos |
| `store-capa-chuva.webp` | Capa de chuva | Comum | capa de chuva transparente roxa com capuz |
| `store-moletom.webp` | Moletom do clube | Raro | moletom preto com capuz e 'RUNNEX' em roxo |
| `store-colete-hidratacao.webp` | Colete de hidratação | Raro | colete de hidratação com duas garrafas flexíveis na frente |
| `store-kimono.webp` | Kimono | Raro | kimono branco de artes marciais com faixa roxa |
| `store-havaiana.webp` | Camisa havaiana | Raro | camisa havaiana roxa com estampa de hibiscos e folhas |
| `store-uniforme-futebol.webp` | Camisa do Brasil | Raro | camisa amarela da seleção estilo Brasil com gola verde (sem escudo oficial) |
| `store-asas-anjo.webp` + 6× `store-asas-anjo__<espécie>.webp` | Asas de anjo | Épico | par de asas de anjo brancas emplumadas presas às costas |
| `store-armadura.webp` + 6× `store-armadura__<espécie>.webp` | Armadura medieval | Épico | armadura medieval prateada (peitoral e ombreiras) com detalhes roxos |
| `store-traje-espacial.webp` + 6× `store-traje-espacial__<espécie>.webp` | Traje espacial | Épico | traje espacial branco com painéis roxos e emblema 'rx' |
| `store-jaqueta-neon.webp` + 6× `store-jaqueta-neon__<espécie>.webp` | Jaqueta neon | Épico | jaqueta bomber preta com linhas roxas neon brilhantes |
| `store-smoking.webp` + 6× `store-smoking__<espécie>.webp` | Smoking de gala | Épico | smoking preto com gravata-borboleta roxa |
| `store-asas-fenix.webp` + 6× `store-asas-fenix__<espécie>.webp` | Asas de fênix | Lendário | asas de fênix em chamas laranja, douradas e roxas |
| `store-armadura-ouro.webp` + 6× `store-armadura-ouro__<espécie>.webp` | Armadura dourada | Lendário | armadura dourada reluzente com gravuras e capa curta roxa |

## Pés (14 itens)

Épico e Lendário: **6 arquivos por item**, um vestido em cada pet (`<id>__<espécie>.webp`). Comum e Raro: só o ícone (`<id>.webp`).

| Arquivo | Nome | Raridade | Descrição |
|---|---|---|---|
| `store-tenis-basico.webp` | Tênis básico | Comum | tênis de corrida preto simples com sola branca |
| `store-meias-listradas.webp` | Meias listradas | Comum | meias altas listradas roxo e preto |
| `store-chinelo.webp` | Chinelo de recuperação | Comum | chinelo de recuperação preto acolchoado |
| `store-galochas.webp` | Galochas | Comum | galochas de borracha roxas brilhantes |
| `store-caneleira.webp` | Caneleira de compressão | Comum | meias de compressão pretas até o joelho com faixas roxas |
| `store-sapatilha-pista.webp` | Sapatilha de pista | Raro | sapatilha de pista com cravos, branca e roxa |
| `store-tenis-trail.webp` | Tênis de trail | Raro | tênis de trail robusto com cravos, cinza e laranja |
| `store-patins.webp` | Patins | Raro | patins quad roxos com rodas neon |
| `store-botas-neve.webp` | Botas de neve | Raro | botas de neve felpudas brancas e roxas |
| `store-tenis-carbono.webp` + 6× `store-tenis-carbono__<espécie>.webp` | Tênis de placa de carbono | Épico | tênis de corrida de elite com solado alto e placa de carbono visível, branco e roxo |
| `store-botas-foguete.webp` + 6× `store-botas-foguete__<espécie>.webp` | Botas-foguete | Épico | botas metálicas com propulsores soltando fogo azul |
| `store-tenis-led.webp` + 6× `store-tenis-led__<espécie>.webp` | Tênis de LED | Épico | tênis com solado de LED roxo brilhante |
| `store-sandalias-aladas.webp` + 6× `store-sandalias-aladas__<espécie>.webp` | Sandálias aladas | Lendário | sandálias douradas com pequenas asas nos tornozelos (estilo Hermes) |
| `store-tenis-ouro.webp` + 6× `store-tenis-ouro__<espécie>.webp` | Tênis de ouro | Lendário | tênis de corrida inteiramente dourado com brilho |

## Fundo (21 itens)

| Arquivo | Nome | Raridade | Descrição |
|---|---|---|---|
| `acc-25km.webp` | Paisagem 25K | Conquista | estrada de terra serpenteando entre colinas verdes ao pôr do sol, placa '25 KM' |
| `acc-250km.webp` | Cenário montanhas | Conquista | cordilheira de montanhas nevadas com trilha de corrida subindo, céu limpo |
| `acc-metabatida.webp` | Bandeira de chegada | Conquista | linha de chegada com bandeira quadriculada e faixa 'META' rompida, confete |
| `acc-amanheceres.webp` | Amanhecer dourado | Conquista | sol nascendo dourado sobre o horizonte da cidade, céu laranja e rosa |
| `acc-noites.webp` | Céu noturno | Conquista | céu noturno roxo escuro cheio de estrelas e lua crescente |
| `store-skyline.webp` | Skyline noturno | Comum | skyline de cidade grande à noite, prédios com janelas acesas em roxo e azul |
| `store-arcoiris.webp` | Arco-íris | Comum | arco-íris vibrante sobre céu azul com nuvens fofas |
| `store-parque.webp` | Parque da cidade | Comum | parque urbano com pista de corrida, árvores e lago, dia ensolarado |
| `store-praia.webp` | Orla da praia | Comum | calçadão de praia com coqueiros e mar azul, manhã |
| `store-pista.webp` | Pista de atletismo | Comum | pista de atletismo vermelha com raias brancas e arquibancada |
| `store-chuva.webp` | Treino na chuva | Comum | rua molhada com chuva caindo e poças refletindo luzes |
| `store-trilha.webp` | Trilha na floresta | Raro | trilha estreita em floresta densa com raios de sol entre as árvores |
| `store-deserto.webp` | Deserto ao entardecer | Raro | dunas de areia ao entardecer, céu laranja e roxo |
| `store-neve.webp` | Corrida na neve | Raro | paisagem nevada com pinheiros e neve caindo |
| `store-cerejeiras.webp` | Cerejeiras em flor | Raro | caminho com cerejeiras em flor, pétalas rosas caindo |
| `store-vulcao.webp` | Vulcão | Épico | vulcão em erupção ao fundo com lava brilhando, céu escuro |
| `store-aurora.webp` | Aurora boreal | Épico | aurora boreal verde e roxa sobre lago congelado |
| `store-fogos.webp` | Fogos de artifício | Épico | céu noturno com fogos de artifício roxos, dourados e azuis |
| `store-oceano.webp` | Fundo do oceano | Épico | fundo do mar com corais, raios de luz e bolhas |
| `store-espaco.webp` | Corrida no espaço | Lendário | espaço sideral com planetas com anéis, nebulosa roxa e estrelas |
| `store-podio.webp` | Pódio olímpico | Lendário | pódio olímpico com o 1º lugar iluminado, confete dourado e holofotes |