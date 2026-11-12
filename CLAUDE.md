# ClickVTT — instruções para agentes

VTT (mesa virtual) em Laravel + Inertia + Vue 3 (TypeScript) + PixiJS. Responda ao usuário em **português do Brasil**.
O foco atual é o sistema **One Piece** (`one-piece`), derivado do D&D 5e.

## Estrutura

- Servidor: `app/Sistemas/OnePiece/` (regras, dados JSON, `OnePiece::conferirFicha` etc.), `app/Nucleo/` (combate, rolagem, efeitos).
- Cliente: `resources/js/app/` — `pages/Jogo.vue` (tela da mesa), `engine/` (mapa em Pixi), `components/`, `nucleo/` (genérico, não importa sistema), `sistemas/onepiece/` (módulo do sistema; o núcleo só o acessa pelo registro/`ModuloSistema`).
- Regras duplicadas em PHP e TS precisam ficar em paridade (ao testar, rode apenas o teste específico do que mexeu em `tests/paridade/`, nunca a suíte toda).

## Como trabalhar

- **O usuário testa tudo sozinho: não abra navegador para testar.** Valide com `npx vue-tsc --noEmit` (filtre por `resources/js/app`; os erros de `types`/`vue/tsx` são do ambiente) e com um build de verificação.
- **Nunca rode todos os testes:** se precisar rodar testes, rode estritamente o que você mexeu (ex.: arquivo específico em `node --test tests/paridade/...` ou filtro específico no PHPUnit), jamais a suíte inteira.
- `public/build` e `storage/framework/testing` não são graváveis: faça o build em outra pasta (`npx vite build --outDir <pasta temporária> --emptyOutDir`) e rode o ESLint apontando só para arquivos específicos.
- Formate com `npx prettier --write <arquivos alterados>` (nunca em `resources/` inteiro: reformata arquivos que você não tocou).
- Não faça commit sem o usuário pedir.
- Ao mexer no One Piece, **mantenha o layout da ficha de D&D** (o usuário rejeitou layouts novos de ficha).

## Escopo de automação (regra do usuário, vale para todo estilo/técnica novos)

1. Automatizar **apenas dano e gasto de PP** (rolar/aplicar dano das Técnicas e descontar PP). Salvaguardas e áreas já feitas continuam, mas não ampliar. O resto (condições, efeitos, estados, bônus, gatilhos) o usuário faz manualmente.
2. Reações com gatilho automático: **só as defensivas** (reduzem o dano recebido ou curam o próprio personagem). Outras reações viram texto na ficha.
3. Sem travas de ação nos turnos (padrão/bônus/poderosa, ataques por turno, limites por rodada). **Única trava real:** criatura não se move fora do seu turno.
4. Não criar marcas "preparado", rastreio de duração, condições novas só para lembrar regra, nem contadores de ação. Se a regra pedir algo fora disso, deixe para a mesa e diga isso.

## Sistema One Piece

- Atributos FOR/DES/CON/SAB/PRE/VON; 19 perícias mais o Ofício (só via profissão); sem testes contra a morte nem magias.
- Pontos de Poder (PP): 4 por nível (5 com certas características), voltam no descanso longo e são gastos por técnicas. Dinheiro em Belly.
- Estilos, Habilidades Básicas, Maestrias, Haki, Treinamentos, Antecedentes, Profissões, Criador de Técnicas, Akuma/Zoan e Singularidades têm dados em TS com espelho PHP + JSON gerado do TS (regenere o JSON ao mudar os dados do TS).
- Progressão: o jogador não edita o XP; "Subir de nível" só com XP máximo do nível **e** o switch do mestre ligado (travado no servidor, `OnePiece::conferirFicha`). Descansos só travam na interface. O mestre nunca é barrado. Switches `descanso_curto`, `descanso_longo`, `subir_nivel` ficam em `mesas`.

## NPCs

- NPC = `Personagem` sem jogadores, com o bloco `ficha.npc`. Campos comuns derivados por `camposDoNpc` (`sistemas/onepiece/npcs/ficha.ts`); tela de uma tela só em `npcs/FichaDeNpc.vue`; catálogo de 36 NPCs em `npcs/catalogo.ts` (só leitura; ao adicionar vira cópia editável).
- Arrastar o modelo para o mapa cria uma **cópia por token** (nome "Pirata 1", PV/PP/usos próprios); a cópia some com o último token.
- Mira: tecla **T** (ou ferramenta Mirar) trava o alvo; todo ataque vai contra ele e rola contra a CA.
- NPC com 0 de vida: o token fica esmaecido com X vermelho e caveira (só o mestre vê, pois só ele recebe a ficha do NPC).

## Navios (cap. 13 e 14)

- Navio = `Personagem` sem jogadores com o bloco `ficha.navio`; PV em `ficha.pv` (PV paralelos = `pv.temp`), tesouro em `ficha.belly`, carga em `ficha.inventario`. A ficha vai para **todos** os jogadores (`Personagem::ehNavio`, `canaisDaFicha`).
- Jogadores não "controlam" o navio: tudo passa por `POST navios/{id}/acao` (`NavioService::operar`), que valida, debita e move no servidor. PV, ajustes e concluir obra são do mestre.
- Dados em `sistemas/onepiece/navios/dados.ts`, regras em `regras.ts`, espelho em `app/Sistemas/OnePiece/Navios.php`. Ao mudar dados ou regras: `node tests/paridade/gerar-navios.mjs` (regenera `navios.json` e os casos de paridade).
- Obra: peça com `pronto_dia` ainda não vale; o calendário (`TempoController` → `NavioService::aoAvancarTempo`) conclui obras e consertos, cobra as despesas semanais, faz o auto-reparo e recarrega as baterias.
- Escopo: só construção, PV/CR/BR, velocidade, tripulação/efetivo, despesas, carga e tesouro. Combate naval, manobras, colisão, correnteza e submarinos ficam fora.

## Interação no mapa

- **Um clique** num token o torna o personagem **ativo** (chat, rolagens e barra de atalhos passam a ser dele); **duplo clique** abre a ficha. Vale para mestre (NPCs e os que controla) e jogadores (os deles).

## Barra de atalhos (embaixo do mapa, `components/BarraAtalhos.vue`)

- Estilo da hotbar do Foundry: slots quadrados pequenos e escuros, número no canto (1–9 e 0 nos botões diretos), ícone **monocromático preto e branco** (espada = corpo a corpo, arco = distância, mira = arma de fogo), nome minúsculo. Minimalista, sem cores/emojis e sem abas/páginas.
- **Só os Ataques são botões diretos.** Técnicas, Salvaguardas, Perícias e Testes são slots com setinha que abrem para cima um painel de **cartõezinhos em grade** (nunca lista vertical), para caber 10–20 técnicas. Técnica mostra só o nome (sem dano).
- Arma por munição: o clique abre uma janelinha com as munições do inventário (`itens/pilhas.ts`), não a ficha.
- NPC: tudo vem da ficha (ataques, técnicas, salvaguardas, perícias, testes). Jogador: ataques com arma, técnicas que ele **fixou** (pino ao lado do "Usar" em `ListaTecnicas.vue`, salvo em localStorage por mesa e personagem), salvaguardas, perícias e testes.
- As técnicas do jogador são executadas por uma ficha invisível do personagem ativo (`FichaOnePiece` com `executor`), para reaproveitar a lógica de custo, área e munição.
- Contrato do sistema: `ModuloSistema.atalhos(ctx)` em `nucleo/sistemas/tipos.ts`.

## Preferências de interface

- Layout de painéis laterais: nada de scroll na barra lateral de ferramentas; quando as ferramentas não cabem, quebram em colunas (grade, com linha fina entre elas e o fundo acompanhando).
- Diálogos longos (ex.: configurações da página) devem rolar dentro da tela.
- Antes de refazer um layout "à moda do Foundry", pesquise como o Foundry faz e copie o visual; adapte só o que o sistema pede (técnicas).
