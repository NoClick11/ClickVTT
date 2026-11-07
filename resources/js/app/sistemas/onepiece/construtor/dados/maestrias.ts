/**
 * Maestrias: especializações que o Estilo de Combate libera nos níveis 9, 13 e 17 ("Traço de Maestria"). O personagem aprende
 * UMA Maestria (se cumprir o atributo mínimo e o requisito adicional) e, a cada um desses níveis, escolhe um dos 3 traços dela,
 * em qualquer ordem. Arquivo PURO (sem Vue). Cada traço vira uma característica (`builder: 'maestria'`).
 *
 * Os requisitos adicionais (Haki, espécie, treinamento, ser capitão...) dependem de coisas que a ficha ainda não guarda
 * (ou da palavra do Narrador): o jogador os confirma na hora de escolher.
 */
import type { AtributoId } from '../../regras.ts';
import type { TracoDados } from './tipos.ts';

export interface Maestria {
    id: string;
    nome: string;
    /** Basta UM destes atributos atingir `minimo`. */
    atributos: AtributoId[];
    minimo: number;
    adicional?: string;
    tracos: TracoDados[];
}

export const NIVEIS_DE_MAESTRIA = [9, 13, 17];

const t = (id: string, nome: string, descricao: string, extra: Partial<TracoDados> = {}): TracoDados => ({ id, nome, descricao, ...extra });
const longo = (max: number) => ({ max, descanso: 'longo' as const });
const curto = (max: number) => ({ max, descanso: 'curto' as const });

export const MAESTRIAS: Maestria[] = [
    {
        id: 'arqueiro',
        nome: 'Arqueiro',
        atributos: ['des', 'pre'],
        minimo: 16,
        tracos: [
            t(
                'ataque-triplo',
                'Ataque Triplo',
                'Em uma jogada de ataque (comum) à distância com arco, ataque até 3 criaturas ao mesmo tempo (uma flecha cada) dentro de um cone de 15 m à frente, usando o mesmo resultado da jogada para todos os alvos.',
                { etiquetas: ['Arco: até 3 alvos em cone de 15 m'] },
            ),
            t(
                'focus-fire',
                'Focus Fire',
                'Por 1 minuto, com uma ação bônus, todos os seus ataques à distância com arco acertam automaticamente qualquer alvo visível dentro do alcance máximo do arco. Volta após um descanso longo.',
                { tipo: 'ativa', acao: 'bonus', usos: longo(1) },
            ),
            t(
                'powershot',
                'Powershot',
                'Seus ataques (comum ou Técnicas) à distância com arco ignoram cobertura total e qualquer outra cobertura. Uma vez por turno, ao acertar com uma flecha, escolha: arrastar a criatura por até 18 m em direção aleatória ou causar 2 dados de dano adicionais.',
                { etiquetas: ['Arco: ignora qualquer cobertura'] },
            ),
        ],
    },
    {
        id: 'ambicao-suprema',
        nome: 'Ambição Suprema',
        atributos: ['pre', 'von'],
        minimo: 15,
        adicional: 'Aptidão em Haki do Rei',
        tracos: [
            t(
                'liberacao-magnifica',
                'Liberação Magnífica',
                'Com uma ação bônus, libera uma aura (raio de 18 m, até 1 minuto) que impede criaturas hostis de usar Técnicas, Manifestações de Poder ou Aspectos Inatos de uma Akuma no Mi e interrompe os ativos; você sofre as mesmas penalidades se tiver uma Akuma no Mi. Toda criatura hostil é afetada por "Soberania do Rei" ao entrar na aura (ou ela entrar no espaço dela), com Salvaguarda em desvantagem. Volta após um descanso curto ou longo.',
                { tipo: 'ativa', acao: 'bonus', usos: curto(1) },
            ),
            t(
                'emissao-deifica',
                'Emissão Deífica',
                'O alcance de "Emissão de Autoridade" se expande em 1 km por Ponto de Ambição investido no Haki da Observação; para achar a criatura fora da visão, Teste de Vontade (Haki) CD 15. A criatura sofre 1d8 de dano Verdadeiro por nível seu e fica "Paralisado" até o fim do próximo turno dela (volta após descanso curto ou longo). Além disso, a CD de "Soberania do Rei" aumenta +3 e afeta criaturas com qualquer Vontade e invulneráveis a "Amedrontado".',
                { usos: curto(1) },
            ),
            t(
                'voz-soberana',
                'Voz Soberana',
                'Proficiência em Haki e a Singularidade "Voz de Todas as Coisas" (se não tiver). A cada nível par seu (antes ou depois desta escolha), +3 Pontos de Ambição só para Talentos do Haki do Rei. Telepatia a até 100 m (uma frase curta, mesmo inconsciente). 3 usos; voltam após descanso curto ou longo; um uso pode ativar "Soberania do Rei" inconsciente.',
                { usos: curto(3) },
            ),
        ],
    },
    {
        id: 'armamento-maximo',
        nome: 'Armamento Máximo',
        atributos: ['for', 'von'],
        minimo: 15,
        adicional: 'Aptidão em Haki do Armamento',
        tracos: [
            t(
                'all-might',
                'All Might',
                'Proficiência em Haki e Sobrenatural; +3 Pontos de Ambição por nível par, só para Talentos do Haki do Armamento. Todo dano recebido é reduzido pelo maior entre seus modificadores de Força e Vontade e você é invulnerável a dano de queda. Com a reação, reduza qualquer dano recebido a 0 antes de saber o valor (volta após descanso curto ou longo).',
                { usos: curto(1), acao: 'reacao', etiquetas: ['Dano recebido −(FOR ou VON); imune a queda'] },
            ),
            t(
                'alcance-galactico',
                'Alcance Galáctico',
                'Dados de Poder (proficiência + mod. de Vontade; voltam no descanso longo) aumentam em 1 os dados de dano de Técnicas. Em Técnica instantânea de alcance diferente de toque/pessoal, gaste 1 para ampliar o dano para um cone de 60 a 120 m (Salvaguarda de Destreza em desvantagem; sem cobertura não há dano; o dado vira d8; alvos únicos passam a atingir todos na área). Ou, com ação bônus e 1 Dado de Poder, se lance até 18 m com um objeto Enorme ou menor.',
                { usos: { porProf: true, descanso: 'longo' } },
            ),
            t(
                'forca-lendaria',
                'Força Lendária',
                'A Forma Avançada de "Endurecimento Ofensivo" do Haki do Armamento causa 1d10 (1d12 com "Corpo Armadurado" ativo). Ao acertar uma criatura, use uma ação poderosa para infligir 3d8 de dano Verdadeiro adicional; ela sofre 3d8 de dano Psíquico no início de cada turno até o fim do encontro. Volta após descanso curto ou longo.',
                { usos: curto(1), acao: 'poderosa' },
            ),
        ],
    },
    {
        id: 'barbaro',
        nome: 'Bárbaro',
        atributos: ['for'],
        minimo: 16,
        tracos: [
            t(
                'devorador-de-montanhas',
                'Devorador de Montanhas',
                'Ignora as propriedades "Pesada" e "Duas Mãos". Empunhando duas armas com elas: Força Ecoante (metade do dano de um ataque (comum) vai para um cone de 9 m; Salvaguarda de Destreza, dobrado contra estruturas) e Obliteração (alcance das Técnicas instantâneas até 60 m; em Fúria, role o dano duas vezes e fique com o maior).',
                { etiquetas: ['Ignora Pesada e Duas Mãos'] },
            ),
            t(
                'furia',
                'Fúria',
                'Por 1 minuto: sem efeitos negativos (exceto "Enfraquecido" e "Inconsciente") e sucesso automático em Salvaguardas de FOR, DES e CON; resistência a todo dano exceto Psíquico e Verdadeiro; ações, reações e movimento não podem ser reduzidos ou impedidos. Só em risco ou combate (termina após 2 rodadas sem isso). Volta após descanso longo.',
                { tipo: 'ativa', usos: longo(1) },
            ),
            t(
                'ira',
                'Ira',
                'Com uma ação bônus, escolha: usar a "Fúria" de novo; recuperar metade dos PV máximos e PP e encerrar toda Exaustão; ou +8d10 de dano em um ataque (comum), depois de saber o resultado. Volta após descanso curto ou longo.',
                { usos: curto(1), acao: 'bonus' },
            ),
        ],
    },
    {
        id: 'capitao-implacavel',
        nome: 'Capitão Implacável',
        atributos: ['pre', 'von'],
        minimo: 15,
        adicional: 'Ser ou ter sido Capitão de uma tripulação',
        tracos: [
            t(
                'confianca-merecida',
                'Confiança Merecida',
                'Tripulantes em Ataque Combinado com você causam 1 dado de dano adicional por participante no alvo e pagam metade dos PP (arredondado para cima). Se acertar, todos recebem "Empoderado" por até 1 minuto; se falhar, não conta como participação e ninguém perde PP.',
            ),
            t(
                'nakama',
                'Nakama',
                'Em um encontro, com pelo menos um tripulante consciente e na ordem de turnos (em risco, como poucos PV a 6 m de uma criatura hostil e no seu campo de visão), seus PV não caem abaixo de 1 (outros efeitos, como Danos Brutais e Golpes Graves, valem normalmente).',
            ),
            t(
                'desigualdade-soberana',
                'Desigualdade Soberana',
                'Proficiência em Haki e Sorte e a Singularidade "Ambição do Rei" (se não tiver). No início de um combate contra outro Capitão com Haki do Rei, no "Choque Entre Haki do Rei", quem perder o Teste Resistido por 8 ou mais perde metade dos PV (arredondado para baixo).',
            ),
        ],
    },
    {
        id: 'deus-do-fogo',
        nome: 'Deus do Fogo',
        atributos: ['con', 'von'],
        minimo: 15,
        adicional: 'Lunariano (ou seus mestiços)',
        tracos: [
            t(
                'corpo-forjado-ignicao',
                'Corpo Forjado: Ignição',
                'Com uma ação bônus o orbe de fogo se extingue e você fica mais veloz (não vale junto de "Labareda"): 1 ataque adicional por rodada com a ação "Atacar"; deslocamento 15 m; dano de Fogo ignora resistências (metade contra invulnerabilidade, sem redução nem PV temporários); pode trocar dados de Técnicas para Fogo (mantendo 1 do tipo original); vantagem no 1º ataque (comum) do turno. Dura quanto quiser.',
                { tipo: 'ativa', acao: 'bonus', efeitos: [{ alvo: 'movimento.normal', modo: 'min', valor: 150 }] },
            ),
            t(
                'corpo-forjado-labareda',
                'Corpo Forjado: Labareda',
                'Com uma ação bônus o orbe se intensifica (não vale junto de "Ignição"): no máx. 1 ataque (comum) por turno e nada de ações poderosas; invulnerável a todo dano exceto Trovejante, Psíquico e Verdadeiro e resistente a tudo exceto Verdadeiro; sem "Heat"; no máx. 6 m de deslocamento por rodada. Dura quanto quiser.',
                { tipo: 'ativa', acao: 'bonus' },
            ),
            t(
                'fogo-inato',
                'Fogo Inato',
                'Uma vez por turno, ao causar dano de Fogo, escolha um novo alvo a até 12 m e faça um ataque (comum) à distância: se acertar, causa metade do dano de Fogo original. Se o original atingiu várias criaturas, use o maior dano e some +2 por outra criatura afetada.',
            ),
        ],
    },
    {
        id: 'estilingueiro',
        nome: 'Estilingueiro',
        atributos: ['des', 'sab'],
        minimo: 15,
        adicional: 'Equipamento Engenhado Kabuto',
        tracos: [
            t(
                'atirador-imprevisivel',
                'Atirador Imprevisível',
                'Uma vez por turno, num ataque (comum) à distância com kabuto, aplique ao alvo, sem Salvaguarda, uma condição: "Atordoado", "Cego", "Enfurecido", "Impedido", "Incapacitado", "Letárgico", "Queimado" ou "Sangramento", até o fim do próximo turno dele. Usos = proficiência; voltam no descanso longo.',
                { usos: { porProf: true, descanso: 'longo' } },
            ),
            t(
                'mira-elastica',
                'Mira Elástica',
                'Uma vez por turno, em ataque (comum) à distância com kabuto, o dano da munição vira 6d4; retire dados para +3 no ataque cada (mínimo 1d4). Em todos os ataques (comum) com kabuto, +2 de dano a cada 4,5 m de distância do alvo (até +20).',
            ),
            t(
                'forcar-bravura',
                'Forçar Bravura',
                'Uma vez por encontro, após acertar ao menos um ataque (comum ou Técnicas), ative sem ação: recebe 10 Pontos de Bravura (PB), gastos só no seu turno: 2 PB = 4d10 PV temporários até o fim do encontro; 3 PB = recupera 6d10 PV; 5 PB = uma ação (ou ação poderosa, só Auxiliar ou Combate de 3º grau ou menos) adicional na rodada. Fica ativa até o fim do encontro; +2 PB por acerto crítico (máx. 12).',
                { usos: curto(1) },
            ),
        ],
    },
    {
        id: 'hasshoken',
        nome: 'Hasshoken',
        atributos: ['for', 'des'],
        minimo: 16,
        tracos: [
            t(
                'golpe-ressoante',
                'Golpe Ressoante',
                'Ao fazer um ataque (comum) corpo a corpo, toda criatura a até 1,5 m sofre 5 de dano Trovejante. Alternativamente, com uma ação bônus, +10 de dano Trovejante e "Caído" se falhar na Salvaguarda de Constituição (usos = proficiência; voltam após descanso curto ou longo).',
                { usos: { porProf: true, descanso: 'curto' } },
            ),
            t(
                'kiryu-kirikugi',
                'Kiryu Kirikugi',
                'Por 1 minuto, recebe todos os benefícios do Efeito Ofensivo "Power Up" (Cap. 6), exceto o aumento de tamanho. Até 3 usos, só um por encontro; voltam após descanso longo.',
                { usos: longo(3) },
            ),
            t(
                'danca-dos-8-impactos',
                'Dança dos 8 Impactos',
                'Hashogeki: com uma ação bônus sua CR vira 30 e cai 1 ao fim de cada turno seu até o valor normal (volta após descanso longo). Impacto Puro: ataques (comum) corpo a corpo causam 1d12 de dano Verdadeiro. Resistência Vibrante: resistência a Contundente; invulnerável a Trovejante e às condições "Atordoado" e "Estremecido". Vibrações Destruidoras: dano Verdadeiro/Trovejante dobrado contra estruturas e objetos.',
                { acao: 'bonus', usos: longo(1), etiquetas: ['Resistência a Contundente; imune a Trovejante'] },
            ),
        ],
    },
    {
        id: 'imaculado',
        nome: 'Imaculado',
        atributos: ['con', 'von'],
        minimo: 16,
        tracos: [
            t(
                'corpo-espirituoso',
                'Corpo Espirituoso',
                'Proficiência em Haki, Sobrenatural e Sorte. Se não usar Akuma no Mi, +5 Pontos de Ambição por nível par seu (antes ou depois desta escolha).',
            ),
            t(
                'energia-impetuosa',
                'Energia Impetuosa',
                'Sem Akuma no Mi, atividades que custam PP (características e Técnicas) custam 2 PP a menos (mínimo 1). Ao adquirir qualquer característica desta Maestria, seus PP totais aumentam em 5 (mesmo que ainda não a tenha escolhido).',
                { efeitos: [{ alvo: 'pp.max', modo: 'soma', valor: 5 }] },
            ),
            t(
                'estrategias-do-imaculado',
                'Estratégias do Imaculado',
                'Você recebe a Técnica "Noryoku Hunter" (ou cria uma nova de até 5º grau, com aprovação do Narrador) e seus PP máximos aumentam em proficiência +4.',
                {
                    efeitos: [{ alvo: 'pp.max', modo: 'soma', valor: '@prof+4' }],
                    tecnicas: [
                        {
                            nome: 'Noryoku Hunter',
                            origem: 'Maestria Imaculado: 3º Grau',
                            custo: 6,
                            alcance: 'Toque ou arma',
                            efeito: '6d10 Contundente, Cortante ou Perfurante',
                            rolagem: '6d10',
                            tipoDano: 'contundente',
                            acao: 'poderosa',
                            descricao:
                                'Jogada de ataque (Técnicas) que atinge o alvo de forma inesperada: a criatura atingida não pode realizar Ação Poderosa nem atividade que consuma PP (Técnicas e características) até o fim do próximo turno dela. Ataque combinado: possível.',
                        },
                    ],
                },
            ),
        ],
    },
    {
        id: 'kung-fu',
        nome: 'Kung Fu',
        atributos: ['des', 'sab'],
        minimo: 16,
        tracos: [
            t(
                'dominio-dos-cem-punhos',
                'Domínio dos Cem Punhos',
                'No início de cada turno seu, 1 ataque (comum) corpo a corpo adicional por criatura hostil a até 3 m, usados com a ação "Atacar" até o fim do turno; sem outras características; dano 1d12 + 6 Contundente, sem dano adicional. Com uma ação bônus, assuma uma posição punitiva por até 1 minuto: para cada ataque contra você, faça um ataque assim em resposta (volta após descanso curto ou longo).',
                { usos: curto(1), acao: 'bonus' },
            ),
            t(
                'seja-como-a-agua',
                'Seja Como a Água',
                'Por até 1 minuto, com uma ação bônus, fica imune a dano de qualquer fonte (inclusive Verdadeiro), mas não pode atacar nem causar dano. Pode encerrar sem ação. Cada vez que evitar dano assim, recupera 2 PP. Volta após descanso curto ou longo.',
                { tipo: 'ativa', acao: 'bonus', usos: curto(1) },
            ),
            t(
                'wire-fu',
                'Wire Fu',
                'Com mais da metade dos PV e sem estar impedido de se mover: deslocamento de voo 12 m, invulnerabilidade a dano de queda e deslocamento 18 m (prevalece o maior).',
                {
                    efeitos: [
                        { alvo: 'movimento.voo', modo: 'min', valor: 120 },
                        { alvo: 'movimento.normal', modo: 'min', valor: 180 },
                    ],
                    etiquetas: ['Só com mais da metade dos PV'],
                },
            ),
        ],
    },
    {
        id: 'lamina-cega',
        nome: 'Lâmina Cega',
        atributos: ['des', 'von'],
        minimo: 15,
        adicional: 'Aptidão em Haki da Observação',
        tracos: [
            t(
                'percepcao-verdadeira',
                'Percepção Verdadeira',
                'Sem enxergar (olhos fechados ou impossibilitado): percepção às cegas em 15 m sem penalidades por não ver, percebe mentiras e tem proficiência em Haki; sucesso automático em testes de audição, vantagem em Salvaguardas contra armadilhas e efeitos invisíveis, imune a "Surpreso"; empunhando arma cortante, ao receber um ataque (comum), +3 na CR até o início do próximo turno, sem reação (3 usos; voltam no descanso longo).',
                { usos: longo(3) },
            ),
            t(
                'aptidao-sensorial',
                'Aptidão Sensorial',
                'Seus ataques (comum ou Técnicas) com arma cortante ignoram resistência a dano Cortante. Escolha 2 auras da "Aura Bestial" do estilo Espadachim; no próximo nível de personagem, mais 2.',
            ),
            t(
                'corte-suave',
                'Corte Suave',
                'Em cada encontro, escolha uma criatura já ferida por você com dano Cortante: ela sofre 1d6 no fim do turno dela até o fim do encontro ou cair a 0 PV; o dano aumenta +1d6 a cada aplicação. Se tiver sofrido um crítico seu, sofre o dobro desses dados. Se ela cair a 0, escolha outra (uma vez por encontro).',
            ),
        ],
    },
    {
        id: 'olhos-de-gaviao',
        nome: 'Olhos de Gavião',
        atributos: ['for', 'des'],
        minimo: 16,
        tracos: [
            t(
                'finesse-suprema',
                'Finesse Suprema',
                'Ao realizar uma Técnica: escolha quais criaturas no alcance são afetadas; em Técnica instantânea de alcance diferente de toque/pessoal, amplie o dano para um cone de 90 m (Salvaguardas em desvantagem; sem cobertura não há dano); ao afetar várias criaturas, concentre o dano: para cada hostil que escolher não afetar, +1 dado nas restantes (máx. 3).',
            ),
            t(
                'olhar-perfurante',
                'Olhar Perfurante',
                'Com mais da metade dos PV e nenhum nível de Exaustão, toda criatura hostil a até 6 m fica impedida de usar reações.',
            ),
            t(
                'visao-perseguidora',
                'Visão Perseguidora',
                'Quando você falhar em um ataque (comum ou Técnicas), a criatura que desviou perde 3 PP; na primeira vez em cada criatura por encontro, perde também PP igual à metade do ND dela (arredondado para baixo).',
            ),
        ],
    },
    {
        id: 'patife',
        nome: 'Patife',
        atributos: ['sab', 'pre'],
        minimo: 16,
        tracos: [
            t(
                'malandragem',
                'Malandragem',
                'Ao errar um ataque (comum ou Técnicas), falhar em Salvaguarda ou sofrer dano, ganha 1 Ponto de Malandragem (PM), até o fim do encontro (máx. = proficiência). 3 PM: reação para encerrar o turno de uma criatura (3 vezes por encontro). 1 PM: +1 dado no próximo ataque (comum) que acertar (até 5). 4 PM: redirecione o dano e efeitos de uma Técnica de 4º grau ou menos que só tenha você como alvo para quem a executou ou outra criatura hostil a até 6 m.',
            ),
            t(
                'carta-na-manga',
                'Carta na Manga',
                'Qualquer coisa (carta, pedra, botão, dente) serve em ataque (comum) corpo a corpo, com "Acuidade" e "Arremesso" (9 m); o dano vira 1d12 + 6 (tipo a critério do Narrador). A cada 2 ataques assim, o 3º causa dano de crítico.',
            ),
            t(
                'twist-the-knife',
                'Twist the Knife',
                'Com uma ação, saque um objeto ou arma e perfure em um ataque (comum); como parte do ataque, quebre-o no corpo: "Sangramento" especial por até 1 minuto com dano 7d10 e ambas as CDs 21. Com kairoseki de até 3 cm, a parte fica alojada até a condição acabar.',
                { acao: 'padrao' },
            ),
        ],
    },
    {
        id: 'profeta',
        nome: 'Profeta',
        atributos: ['pre', 'von'],
        minimo: 15,
        adicional: 'Aptidão em Haki da Observação',
        tracos: [
            t(
                'mente-espirituosa',
                'Mente Espirituosa',
                'Proficiência em Haki e Sobrenatural; +3 Pontos de Ambição por nível par seu (antes ou depois), só para Talentos do Haki da Observação.',
            ),
            t(
                'batalha-premeditada',
                'Batalha Premeditada',
                'Usando "Perceber Presença" ou "Antevisão", uma vez por rodada, sem ações nem reações: CR +5 até o início do próximo turno; 1 ataque (comum) adicional; negar um dano antes de saber o valor; impedir uma criatura a 1,5 m de atacar; ou impedir que ela se levante de "Caído". 1 uso, +1 por 10 Pontos de Ambição no Haki da Observação; voltam após descanso longo.',
                { usos: longo(1) },
            ),
            t(
                'visao-mistica',
                'Visão Mística',
                'Com objetos ligados ao destino, preveja acontecimentos futuros de pessoas ou lugares (volta após descanso longo). "Vidente" passa a usar os valores fixos 1, 12 e 20, aplicáveis também em ataques (comum ou Técnicas); na forma dominada, voltam no descanso curto.',
                { usos: longo(1) },
            ),
        ],
    },
    {
        id: 'rei-do-inferno',
        nome: 'Rei do Inferno',
        atributos: ['con', 'von'],
        minimo: 15,
        adicional: 'Aptidão em Haki do Rei',
        tracos: [
            t(
                'estado-infernal',
                'Estado Infernal',
                'Por 1 minuto, aura de chamas: Ondas do Inferno (ataques (comum) que errarem ainda acertam, com dano −5); Natureza Sinistra (ataques (comum) causam dano Verdadeiro); Canalizar o Abismo (Técnica de Combate instantânea soma dados de dano Verdadeiro iguais ao grau). 3 usos; voltam após descanso longo.',
                { tipo: 'ativa', usos: longo(3) },
            ),
            t(
                'aura-abissal',
                'Aura Abissal',
                'Com uma ação bônus, aprimora "Presença Esmagadora" (Haki do Rei): área de 9 m e dano 6d6 Psíquico, por até 1 minuto. Toda criatura hostil é afetada por "Soberania do Rei" ao entrar na aura (ou ela no espaço dela), com Salvaguarda em desvantagem.',
                { acao: 'bonus' },
            ),
            t(
                'de-volta-do-inferno',
                'De Volta do Inferno',
                'Ao morrer pelas mãos de uma criatura hostil, escolha: voltar com metade dos PV máximos e PP e com "Estado Infernal" ativo (sem gastar uso); ou voltar 6 horas depois, com PV máximos +nível. Só de novo após 7 noites inteiras.',
                { usos: longo(1) },
            ),
        ],
    },
    {
        id: 'retalhador',
        nome: 'Retalhador',
        atributos: ['for', 'des'],
        minimo: 15,
        adicional: 'Treinamento "Ceifador"',
        tracos: [
            t(
                'killer-instinct',
                'Killer Instinct',
                'Empunhando uma foice, contra criaturas com menos da metade dos PV máximos: sabe a localização exata a até 60 m; +6 m de deslocamento na direção dela; +1 dado de dano nos ataques (comum).',
            ),
            t(
                'ceifeiro-macabro',
                'Ceifeiro Macabro',
                'Empunhando uma foice: +2 na CR; falhas críticas de ataques (comum) à distância contra você são redirecionadas a uma criatura hostil a até 6 m como acerto crítico; quem atacar você a até 3 m sofre 2d6 Cortante.',
                { tipo: 'ativa', efeitos: [{ alvo: 'ca', modo: 'soma', valor: 2 }] },
            ),
            t(
                'balanco-da-morte',
                'Balanço da Morte',
                'Com uma ação bônus, corte em cone de 15 m: criaturas hostis com menos da metade dos PV máximos fazem Salvaguarda de Vontade ou têm a cabeça arrancada (imunes: invulneráveis a Cortante, sem cabeça ou grandes demais). As demais na área fazem Salvaguarda de Destreza: 6d10 Psíquico, metade se passarem. Volta após descanso curto ou longo.',
                { acao: 'bonus', usos: curto(1) },
            ),
        ],
    },
    {
        id: 'ryusoken',
        nome: 'Ryusoken',
        atributos: ['for', 'sab'],
        minimo: 15,
        adicional: 'Aptidão em Haki do Armamento',
        tracos: [
            t(
                'destruicao-de-nucleo',
                'Destruição de Núcleo',
                'Técnica de Combate contra estruturas, sem afetar criaturas: custa metade dos PP (arredondado para baixo) e causa dados de dano adicionais iguais ao dobro do grau; alcance dobrado (exceto toque e pessoal).',
            ),
            t(
                'garra-de-dragao',
                'Garra de Dragão',
                'Quando uma criatura Grande ou menor a até 1,5 m faz um ataque (comum ou Técnicas), use a reação para um ataque (comum) contra ela, sem dano: se sua jogada superar a dela, você evita o dano. Com 15 ou mais no d20 contra um ataque desarmado, 2d10 Contundente nela; contra uma arma, você a destrói (a critério do Narrador). A 1ª vez por rodada não gasta a reação.',
                { acao: 'reacao' },
            ),
            t(
                'lanca-e-escudo',
                'Lança e Escudo',
                'Ataques (comum) desarmados causam 1d12 e seus PV máximos aumentam em 10 × proficiência. Por 1 minuto, Haki do Armamento intensificado: Tetsu no Tsume (ação bônus: quebra objeto solto ou área de 6 m de raio e 50 cm, exceto kairoseki); Corpo de Ferro (resistência a tudo exceto Psíquico e Verdadeiro; seu dano Contundente não é reduzido); Dragon Grip (1×/encontro: 6d10 Contundente e sem reações nem ações bônus até passar em Constituição CD 21). Volta após descanso curto ou longo.',
                { efeitos: [{ alvo: 'pv.max', modo: 'soma', valor: '10*@prof' }], usos: curto(1) },
            ),
        ],
    },
    {
        id: 'soberano',
        nome: 'Soberano',
        atributos: ['for', 'von'],
        minimo: 15,
        adicional: 'Aptidão em Haki do Rei',
        tracos: [
            t(
                'rei-do-mundo',
                'Rei do Mundo',
                'Ao sair com vitória absoluta (a critério do Narrador) de conflitos com forças notáveis (Marinha, Governo Mundial, grandes piratas), ganha 1 Ponto de Soberano; com eles o Narrador altera a seu favor um acontecimento recente (ele pode recusar o absurdo). Máx. de pontos = traços desta Maestria escolhidos.',
            ),
            t(
                'devoto-de-davy-jones',
                'Devoto de Davy Jones',
                'Em encontro ou disputa, quando você ou um aliado falhar em Teste de Atributo ou Salvaguarda, a jogada pode ser refeita, até 3 vezes por teste. Cada vez, você sofre 2d10 Psíquico, que reduz seus PV máximos até o fim de um descanso curto ou longo.',
            ),
            t(
                'eclipse',
                'Eclipse',
                'Seus ataques corpo a corpo parecem disparos de canhão: Ambição Gotejante (soma seu mod. de Vontade ao dano (comum ou Técnicas)); Pandemonium (ataques (comum) podem causar Contundente com as propriedades do Verdadeiro, sem redução nem PV temporários); Poder Estrondoso (ataques (comum) corpo a corpo atingem criaturas a até 9 m; na 1ª por rodada, empurra 3 m e ela escolhe 2d8 de dano adicional ou desvantagem na próxima Salvaguarda).',
            ),
        ],
    },
    {
        id: 'sulong',
        nome: 'Sulong',
        atributos: ['con', 'von'],
        minimo: 15,
        adicional: 'Mink (ou seus mestiços) com o treinamento "Leão da Lua"',
        tracos: [
            t(
                'amado-pela-lua',
                'Amado pela Lua',
                'Força a transformação Sulong sem lua cheia, por até 5 minutos, com os mesmos benefícios. Só de novo após 7 noites inteiras.',
                { usos: longo(1) },
            ),
            t(
                'voltagem-maxima',
                'Voltagem Máxima',
                'Seu dano Elétrico ignora resistências (metade contra invulnerabilidade), sem redução nem PV temporários, e causa no mínimo metade do máximo dos dados. Criaturas que sofreram dano Elétrico seu no encontro e falharem em ataque (comum), Teste de Atributo ou Salvaguarda sofrem 5d6 Elétrico (uma vez por rodada cada).',
            ),
            t(
                'corpo-carregado',
                'Corpo Carregado',
                'Troque dados de dano das Técnicas para Elétrico (mantendo 1 do tipo original). Ao usar Técnica de dano Elétrico, 10 PV temporários por grau até o fim do próximo turno (+30 na forma Sulong).',
            ),
        ],
    },
    {
        id: 'sumo',
        nome: 'Sumô',
        atributos: ['for', 'von'],
        minimo: 16,
        tracos: [
            t(
                'oni-muso',
                'Oni Muso',
                'Salvaguardas e Testes para evitar ser movido contra a vontade, ficar "Atordoado" ou ser derrubado têm vantagem; antes de rolar, pode optar por sucesso automático (usos = proficiência; voltam após descanso curto ou longo). Ou, com ação bônus e 1 uso, pise firme: 30 PV temporários até o fim do encontro e 6 m ao redor com Salvaguarda de Destreza (6d6 Trovejante, metade se passar).',
                { usos: { porProf: true, descanso: 'curto' } },
            ),
            t(
                'retsu-harite',
                'Retsu Harite',
                'Com uma ação bônus, role 1d10: é a quantidade de ataques corpo a corpo desarmados adicionais (cada um 1d12 + 6 Contundente). O último recebe dados de dano iguais a 10 menos o d10, empurra 9 m e a criatura não usa ações poderosas até o fim do próximo turno. 3 usos; voltam após descanso curto ou longo.',
                { usos: curto(3), acao: 'bonus' },
            ),
            t(
                'jigoku-dohyo',
                'Jigoku Dohyo',
                'Círculo mental de 3 m: criaturas dentro fazem ataques (comum) corpo a corpo contra você com desvantagem; dano de fontes fora do círculo é reduzido em 15 (mínimo 1).',
            ),
        ],
    },
];

export const maestriaPorId = (id: string | null | undefined): Maestria | undefined => MAESTRIAS.find((m) => m.id === id);

/** A Maestria pode ser aprendida? Atributo mínimo (basta um dos atributos) e, se houver, o requisito adicional confirmado. */
export function problemasDaMaestria(m: Maestria, atributos: Record<AtributoId, number>, confirmouAdicional: boolean): string[] {
    const p: string[] = [];
    if (!m.atributos.some((a) => (atributos[a] ?? 0) >= m.minimo))
        p.push(`${m.nome}: exige ${m.atributos.map((a) => a.toUpperCase()).join(' ou ')} ${m.minimo}.`);
    if (m.adicional && !confirmouAdicional) p.push(`${m.nome}: confirme o requisito adicional (${m.adicional}).`);

    return p;
}
