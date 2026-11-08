/**
 * Habilidades Básicas (HB): características de combate que acompanham qualquer Estilo de Combate. O jogador escolhe uma
 * no 1º, 2º e 3º nível (nunca a mesma duas vezes) e recebe mais uma, a Inata, do estilo. Arquivo PURO (sem Vue).
 *
 * Cada HB vira uma ou mais características marcadas com `hb: <id>`; os degraus por nível usam `nivelMin`/`nivelMax`.
 * O que o motor modela é automático (CA, CD, PV, passos de dado, margem de crítico, botões de recuperar/rolar/deslocar);
 * o resto fica em descrição + etiquetas.
 */
import type { AtributoId } from '../../regras.ts';
import type { TracoDados } from './tipos.ts';

/** O que o gerador precisa saber do personagem (atributo primário do estilo e a arma favorita). */
export interface ContextoHB {
    primario: AtributoId;
    /** Opção escolhida (Prodígio: `corpo`|`distancia`; Quebrador: ver `OPCOES_QUEBRADOR`). */
    opcoes: string[];
}

export interface HabilidadeBasica {
    id: string;
    nome: string;
    resumo: string;
    /** Pede uma escolha ao jogador (Prodígio do Combate, Quebrador de Regras). */
    escolha?: 'prodigio' | 'quebrador' | 'aprimoramento';
    /** As características que a HB dá neste contexto (cada uma com seus degraus de nível). */
    tracos: (ctx: ContextoHB) => TracoDados[];
}

const ATRIBUTOS_DO_APRIMORAMENTO: { id: AtributoId; nome: string }[] = [
    { id: 'for', nome: 'Força' },
    { id: 'des', nome: 'Destreza' },
    { id: 'con', nome: 'Constituição' },
    { id: 'sab', nome: 'Sabedoria' },
    { id: 'pre', nome: 'Presença' },
    { id: 'von', nome: 'Vontade' },
];
/** Aprimoramento de Atributo: +2 em um atributo (`ava:for`) ou +1 em dois (`ava:for+des`). */
export const OPCOES_APRIMORAMENTO: { id: string; nome: string; descricao: string }[] = [
    ...ATRIBUTOS_DO_APRIMORAMENTO.map((a) => ({ id: `ava:${a.id}`, nome: `+2 em ${a.nome}`, descricao: '' })),
    ...ATRIBUTOS_DO_APRIMORAMENTO.flatMap((a, i) =>
        ATRIBUTOS_DO_APRIMORAMENTO.slice(i + 1).map((b) => ({ id: `ava:${a.id}+${b.id}`, nome: `+1 em ${a.nome} e ${b.nome}`, descricao: '' })),
    ),
];
/** Os aumentos de uma opção do Aprimoramento de Atributo (`ava:for` = +2; `ava:for+des` = +1 em cada); null se não for válida. */
export function aumentosDoAprimoramento(opcao: string | null | undefined): { atributo: AtributoId; valor: number }[] | null {
    if (!opcao || !OPCOES_APRIMORAMENTO.some((o) => o.id === opcao)) return null;
    const ids = opcao.slice(4).split('+') as AtributoId[];

    return ids.map((atributo) => ({ atributo, valor: ids.length === 1 ? 2 : 1 }));
}

/** Opções do Quebrador de Regras (a segunda escolha vem no 6º nível). */
export const OPCOES_QUEBRADOR: { id: string; nome: string; descricao: string }[] = [
    { id: 'vitalidade', nome: 'Vitalidade Exuberante', descricao: 'O dado de vida sobe um passo (d8 → d10 → d12); no d12, +1 PV por nível.' },
    { id: 'forca-desarmado', nome: 'Força Magnífica (desarmado)', descricao: 'Ataques (comum) corpo a corpo desarmados sobem um passo de dado.' },
    {
        id: 'forca-arma',
        nome: 'Força Magnífica (arma corpo a corpo)',
        descricao: 'Ataques (comum) com a arma corpo a corpo escolhida sobem um passo de dado.',
    },
    ...(['for', 'des', 'con', 'sab', 'pre', 'von'] as const).map((a) => ({
        id: `inato-${a}`,
        nome: `Aprimoramento Inato (${a.toUpperCase()})`,
        descricao: `+1 permanente em ${a.toUpperCase()}.`,
    })),
];

const ate = (n: number) => ({ nivelMax: n });
const desde = (n: number) => ({ nivelMin: n });
const hb = (id: string, t: Omit<TracoDados, 'hb'>): TracoDados => ({ ...t, hb: id });

const BASICAS: HabilidadeBasica[] = [
    {
        id: 'aprimoramento-de-atributo',
        nome: 'Aprimoramento de Atributo',
        escolha: 'aprimoramento',
        resumo: '+2 em um atributo ou +1 em dois (nunca acima de 20 por ela).',
        tracos: ({ opcoes }) =>
            opcoes.flatMap((op, i): TracoDados[] => {
                const aumentos = aumentosDoAprimoramento(op);
                if (!aumentos) return [];
                const nomes = aumentos.map((a) => `${a.valor > 1 ? '+' + a.valor : '+1'} ${a.atributo.toUpperCase()}`).join(' e ');

                return [
                    hb('aprimoramento-de-atributo', {
                        id: `aprimoramento-${i}-${op}`,
                        nome: `Aprimoramento de Atributo: ${nomes}`,
                        descricao: `Você aumenta permanentemente ${nomes} (os valores já foram somados aos atributos; nunca acima de 20 por esta habilidade).`,
                    }),
                ];
            }),
    },
    {
        id: 'concentracao-inabalavel',
        nome: 'Concentração Inabalável',
        resumo: 'Sucesso automático no 1º teste de concentração; vantagem a partir do 5º; CD limitada a 25 no 10º.',
        tracos: () => [
            hb('concentracao-inabalavel', {
                id: 'concentracao-inabalavel',
                nome: 'Concentração Inabalável',
                usos: { max: 1, descanso: 'longo' },
                descricao:
                    'Sucesso automático em uma Salvaguarda para manter a concentração, no primeiro teste. No segundo teste você recebe +2 de bônus. Só volta após um descanso longo. A partir do 5º nível você sempre tem vantagem em testes para manter a concentração. No 10º nível, a CD da Salvaguarda para manter a concentração não passa de 25.',
                efeitos: [{ alvo: 'concentracao', modo: 'vantagem' }],
                etiquetas: ['Concentração: 1º teste automático (descanso longo)', 'Vantagem para concentrar (5º+)'],
                nivelMin: 1,
            }),
        ],
    },
    {
        id: 'corpo-de-guerreiro',
        nome: 'Corpo de Guerreiro',
        resumo: 'Ataque desarmado que cresce com o nível e Defesa Aprimorada sem armadura (CR 10 + atributo primário + CON limitada).',
        tracos: ({ primario }) => {
            const dado = (n: string, min: number, max: number | null): TracoDados =>
                hb('corpo-de-guerreiro', {
                    id: `ataque-aprimorado-${n}`,
                    nome: 'Corpo de Guerreiro: Ataque Aprimorado',
                    descricao: `Seu ataque (comum) desarmado corpo a corpo causa ${n} de dano (tabela "Ataque Desarmado" por nível).`,
                    nivelMin: min,
                    ...(max ? ate(max) : {}),
                    acoes: [
                        {
                            rotulo: 'Ataque desarmado',
                            tipo: 'rolar',
                            rolagem: '1d20+@ataque.desarmado',
                            vantagemAlvo: 'ataque.desarmado',
                            acao: 'padrao',
                        },
                        { rotulo: `Dano (${n})`, tipo: 'rolar', rolagem: `${n}+@dano.desarmado`, passo: 'desarmado' },
                    ],
                });

            return [
                dado('1d4', 1, 5),
                dado('1d6', 6, 10),
                dado('1d8', 11, 15),
                dado('1d10', 16, null),
                hb('corpo-de-guerreiro', {
                    id: 'defesa-aprimorada',
                    nome: 'Corpo de Guerreiro: Defesa Aprimorada',
                    descricao:
                        'Sem armadura, proteção ou outra HB defensiva, sua CR é 10 + modificador do atributo primário (mínimo +1), mais o modificador de Constituição, limitado a metade do seu nível (arredondada para baixo; +1 no 1º nível). Vale só com o estilo do 1º nível, no Multiestilo. Com armadura, a CR da armadura prevalece se for maior.',
                    efeitos: [{ alvo: 'ca', modo: 'base', valor: `10+max(1,@mod.${primario})+min(@mod.con,max(1,floor(@nivel/2)))` }],
                    etiquetas: ['CR sem armadura: 10 + atributo primário + CON (limite ½ nível)'],
                }),
            ];
        },
    },
    {
        id: 'defesa-ofensiva',
        nome: 'Defesa Ofensiva',
        resumo: 'CR usa o atributo primário no lugar da DES; Em Guarda e Aparar com a arma favorita.',
        tracos: ({ primario }) => [
            hb('defesa-ofensiva', {
                id: 'defesa-ofensiva',
                nome: 'Defesa Ofensiva',
                descricao:
                    'Ao definir sua CR, você pode trocar o modificador de Destreza pelo do atributo primário do estilo. Empunhando a arma favorita (e sem outra HB defensiva) você tem: Em Guarda (+metade da proficiência na CR, arredondada para baixo); Guarda Aprimorada (+1 na CR no 5º nível, +2 no 13º). Ligue "Em Guarda" enquanto empunha a arma favorita.',
                efeitos: [{ alvo: 'ca', modo: 'base', valor: `10+@mod.${primario}` }],
            }),
            hb('defesa-ofensiva', {
                id: 'em-guarda',
                nome: 'Defesa Ofensiva: Em Guarda',
                tipo: 'ativa',
                descricao: 'Empunhando a arma favorita: +metade da proficiência na CR (+1 a partir do 5º nível, +2 a partir do 13º).',
                efeitos: [{ alvo: 'ca', modo: 'soma', valor: 'floor(@prof/2)+min(1,floor(@nivel/5))+min(1,floor(@nivel/13))' }],
            }),
            hb('defesa-ofensiva', {
                id: 'aparar',
                nome: 'Defesa Ofensiva: Aparar',
                descricao:
                    'Ao ser alvo de uma jogada de ataque (comum ou Técnicas), use sua reação para que, até o início do seu próximo turno, o bônus de "Em Guarda" seja igual à proficiência inteira em vez de metade. Você precisa ver o atacante.',
                acao: 'reacao',
                reacao: { gatilho: 'ataque_declarado', alcance: 'si', defesa: '@prof-floor(@prof/2)', categoria: 'reacao' },
            }),
            hb('defesa-ofensiva', {
                id: 'aparar-aprimorado',
                nome: 'Defesa Ofensiva: Aparar Aprimorado',
                ...desde(7),
                usos: { max: 3, descanso: 'curto' },
                descricao:
                    'Você pode se beneficiar de "Aparar" sem gastar a reação, uma vez por rodada, até 3 vezes. Todos os usos voltam após um descanso curto ou longo.',
                acao: 'livre',
                reacao: { gatilho: 'ataque_declarado', alcance: 'si', defesa: '@prof-floor(@prof/2)', categoria: 'livre' },
            }),
        ],
    },
    {
        id: 'dificuldade-inefavel',
        nome: 'Dificuldade Inefável',
        resumo: '+metade da proficiência nas CDs; +2 no 6º nível e +3 no 9º.',
        tracos: () => [
            hb('dificuldade-inefavel', {
                id: 'dificuldade-inefavel',
                nome: 'Dificuldade Inefável',
                descricao:
                    'Quando uma Técnica ou característica sua impõe uma Salvaguarda, você soma mais metade do Bônus de Proficiência (arredondada para baixo) à CD. No 6º nível a CD recebe +2; no 9º, +3.',
                efeitos: [{ alvo: 'cd', modo: 'soma', valor: 'floor(@prof/2)+2*min(1,floor(@nivel/6))+min(1,floor(@nivel/9))' }],
            }),
        ],
    },
    {
        id: 'gerenciamento-de-energia',
        nome: 'Gerenciamento de Energia',
        resumo: 'Recupera 1d8 + proficiência em PP (3d8 e 2 usos no 10º).',
        tracos: () => [
            hb('gerenciamento-de-energia', {
                id: 'gerenciamento-1',
                nome: 'Gerenciamento de Energia',
                ...ate(9),
                usos: { max: 1, descanso: 'longo' },
                descricao: 'Com uma ação bônus, recupere 1d8 PP + seu bônus de proficiência. Volta após um descanso longo.',
                acoes: [{ rotulo: 'Recuperar PP', tipo: 'recuperar', recurso: 'pp', rolagem: '1d8+@prof', acao: 'bonus', usa: true }],
            }),
            hb('gerenciamento-de-energia', {
                id: 'gerenciamento-10',
                nome: 'Gerenciamento de Energia',
                ...desde(10),
                usos: { max: 2, descanso: 'longo' },
                descricao:
                    'Com uma ação bônus, recupere 3d8 PP + seu bônus de proficiência, até 2 vezes. Todos os usos voltam após um descanso longo.',
                acoes: [{ rotulo: 'Recuperar PP', tipo: 'recuperar', recurso: 'pp', rolagem: '3d8+@prof', acao: 'bonus', usa: true }],
            }),
        ],
    },
    {
        id: 'mente-e-corpo',
        nome: 'Mente e Corpo',
        resumo: 'Ignora os 5 primeiros níveis de Exaustão por 10 minutos (3 usos).',
        tracos: () => [
            hb('mente-e-corpo', {
                id: 'mente-e-corpo',
                nome: 'Mente e Corpo',
                tipo: 'ativa',
                acao: 'bonus',
                usos: { max: 3, descanso: 'longo' },
                descricao:
                    'Com uma ação bônus, você não sofre os efeitos dos 5 primeiros Níveis de Exaustão por até 10 minutos. 3 usos; todos voltam após um descanso longo.',
                etiquetas: ['Ignora os 5 primeiros níveis de Exaustão (10 min)'],
            }),
        ],
    },
    {
        id: 'mira-treinada',
        nome: 'Mira Treinada',
        resumo: 'Dano à distância sobe um passo; crítico atinge um segundo alvo; no máximo 1 ataque corpo a corpo por rodada.',
        tracos: () => [
            hb('mira-treinada', {
                id: 'mira-treinada',
                nome: 'Mira Treinada',
                descricao:
                    'Suas jogadas de ataque (comum) à distância têm o dano aumentado em um passo (1 → 1d4 → 1d6 → 1d8 → 1d10 → 1d12 → 2d6 opcional). Em acerto crítico o projétil ricocheteia e atinge automaticamente uma criatura adicional à sua escolha a até 9 m do alvo original, causando metade do dano. Você não pode fazer mais de uma jogada de ataque (comum) corpo a corpo por rodada.',
                efeitos: [{ alvo: 'passo.distancia', modo: 'min', valor: 1 }],
                etiquetas: ['Crítico: ricochete em outro alvo (½ dano)', 'Máx. 1 ataque corpo a corpo por rodada'],
            }),
        ],
    },
    {
        id: 'perito-em-tecnicas',
        nome: 'Perito em Técnicas',
        resumo: 'Técnicas sem PP quando nada é afetado; +modificador no dano (5º); dados das Técnicas sobem um passo (10º).',
        tracos: () => [
            hb('perito-em-tecnicas', {
                id: 'perito-1',
                nome: 'Perito em Técnicas',
                usos: { porProf: true, descanso: 'longo' },
                descricao:
                    '1º nível: quando nenhuma criatura, ambiente, estrutura ou objeto for afetado pela execução de uma Técnica sua, você pode escolher não perder PP. Usos = bônus de proficiência; voltam após um descanso longo.',
            }),
            hb('perito-em-tecnicas', {
                id: 'perito-5',
                nome: 'Perito em Técnicas: Modificador no Dano',
                ...desde(5),
                descricao:
                    '5º nível: Técnicas de duração instantânea somam às rolagens de dano/cura o mesmo modificador de atributo do ataque (Técnicas) ou da CD da própria Técnica. Em Técnicas de mais de um alvo, o modificador é pela metade (arredondado para baixo).',
                etiquetas: ['Técnicas instantâneas: + modificador de atributo no dano/cura'],
            }),
            hb('perito-em-tecnicas', {
                id: 'perito-10',
                nome: 'Perito em Técnicas: Dados Aprimorados',
                ...desde(10),
                descricao:
                    '10º nível: os dados das Técnicas aumentam em um passo (1 → 1d4 → 1d6 → 1d8 → 1d10 → 1d12). Não se acumula com outras características de mesmo efeito.',
                efeitos: [{ alvo: 'passo.tecnica', modo: 'min', valor: 1 }],
            }),
        ],
    },
    {
        id: 'preparacao-para-a-batalha',
        nome: 'Preparação para a Batalha',
        resumo: 'Por 1 minuto: dano mínimo de metade do máximo e 3 dados adicionais nas Técnicas.',
        tracos: () => [
            hb('preparacao-para-a-batalha', {
                id: 'preparacao-para-a-batalha',
                nome: 'Preparação para a Batalha',
                tipo: 'ativa',
                acao: 'bonus',
                usos: { max: 1, descanso: 'longo' },
                descricao:
                    'Com uma ação bônus e um pequeno ritual (bandana, cigarro, mangas arregaçadas), por 1 minuto suas jogadas de ataque (comum ou Técnicas) não podem causar menos que a metade do dano máximo possível. Ao executar Técnicas, você pode lançar 3 dados adicionais (dobrados em crítico) que só ajudam a alcançar o máximo possível do dano/cura original. Volta após um descanso longo.',
                etiquetas: ['Dano mínimo = ½ do máximo', 'Técnicas: +3 dados (até o máximo)'],
            }),
        ],
    },
    {
        id: 'primeiros-socorros',
        nome: 'Primeiros Socorros',
        resumo: 'Cura 10 PV por nível, 4d10 PV temporários e encerra condições; 1× por criatura por descanso longo.',
        tracos: () => [
            hb('primeiros-socorros', {
                id: 'primeiros-socorros',
                nome: 'Primeiros Socorros',
                descricao:
                    'Com uma ação bônus, trate uma criatura que perdeu mais da metade dos PV totais: ela recupera 10 PV por nível seu e recebe 4d10 PV temporários até o próximo descanso longo; Envenenado, Letárgico, Queimado e Sangramento terminam. Se perder todos esses PV temporários antes do descanso, sofre dano igual ao valor recebido (o mesmo se forem trocados por PV de outra fonte). Consome 1 kit de primeiros socorros; cada criatura só se beneficia uma vez por descanso longo. Alternativamente, encerre só as condições, quantas vezes quiser. Mire a criatura (ou a si) antes.',
                acoes: [
                    { rotulo: 'Socorrer (alvo mirado)', tipo: 'socorrer', acao: 'bonus', alvo: 'mirado' },
                    { rotulo: 'Só encerrar condições', tipo: 'socorrer', acao: 'bonus', alvo: 'mirado', soCondicoes: true },
                ],
            }),
        ],
    },
    {
        id: 'prodigio-do-combate',
        nome: 'Prodígio do Combate',
        escolha: 'prodigio',
        resumo: 'Ataque de Oportunidade, Crítico Marcial 19-20 (corpo a corpo ou à distância) e Reverter Superioridade.',
        tracos: ({ opcoes }) => {
            const tipo = opcoes.find((o) => o === 'corpo' || o === 'distancia') ?? 'corpo';

            return [
                hb('prodigio-do-combate', {
                    id: 'ataque-de-oportunidade',
                    nome: 'Prodígio do Combate: Ataque de Oportunidade',
                    acao: 'reacao',
                    descricao:
                        'Com sua reação, faça uma jogada de ataque (comum) corpo a corpo contra uma criatura que você veja se mover voluntariamente para fora do seu alcance.',
                    etiquetas: ['Reação: ataque (comum) corpo a corpo contra quem sai do alcance'],
                }),
                hb('prodigio-do-combate', {
                    id: 'critico-marcial',
                    nome: `Prodígio do Combate: Crítico Marcial (${tipo === 'corpo' ? 'corpo a corpo' : 'à distância'})`,
                    descricao: 'Suas jogadas de ataque (comum) da categoria escolhida têm margem de acerto crítico 19-20.',
                    efeitos: [{ alvo: `margem.${tipo}`, modo: 'max', valor: 19 }],
                }),
                hb('prodigio-do-combate', {
                    id: 'reverter-superioridade',
                    nome: 'Prodígio do Combate: Reverter Superioridade',
                    descricao:
                        'Acertos críticos de criaturas com CR maior que a sua causam dano normal em você. Quando você acerta um crítico em criatura com CR superior à sua, ela não pode realizar reações até o fim do próximo turno dela.',
                    etiquetas: ['Críticos de CR maior causam dano normal em você'],
                }),
            ];
        },
    },
    {
        id: 'quebrador-de-regras',
        nome: 'Quebrador de Regras',
        escolha: 'quebrador',
        resumo: 'Uma característica excepcional (Vitalidade, Força Magnífica ou Aprimoramento Inato); outra no 6º nível.',
        tracos: ({ opcoes }) =>
            opcoes.flatMap((op, i): TracoDados[] => {
                const nivel = i === 0 ? {} : desde(6);
                const nome = OPCOES_QUEBRADOR.find((o) => o.id === op)?.nome ?? op;
                const base = { id: `quebrador-${op}`, nome: `Quebrador de Regras: ${nome}`, ...nivel };
                if (op === 'vitalidade')
                    return [
                        hb('quebrador-de-regras', {
                            ...base,
                            descricao:
                                'O dado de vida dos seus Estilos de Combate aumenta um passo (d8 → d10 → d12). Se já tiver d12, +1 PV a cada novo nível. (O dado é ajustado pelo assistente.)',
                        }),
                    ];
                if (op === 'forca-desarmado' || op === 'forca-arma')
                    return [
                        hb('quebrador-de-regras', {
                            ...base,
                            descricao:
                                'Suas jogadas de ataque (comum) corpo a corpo desarmado ou com uma arma corpo a corpo à sua escolha sobem um passo de dado.',
                            efeitos: [{ alvo: op === 'forca-desarmado' ? 'passo.desarmado' : 'passo.corpo', modo: 'min', valor: 1 }],
                        }),
                    ];
                const atr = op.replace('inato-', '');

                return [
                    hb('quebrador-de-regras', {
                        ...base,
                        descricao: `+1 permanente em ${atr.toUpperCase()}, somado direto ao atributo (nunca acima de 20 por esta característica).`,
                    }),
                ];
            }),
    },
    {
        id: 'recuo-estrategico',
        nome: 'Recuo Estratégico',
        resumo: 'Ação bônus: recua o dobro do deslocamento sem provocar reações; Técnica de até 3º grau pela metade do PP no turno seguinte.',
        tracos: () => [
            hb('recuo-estrategico', {
                id: 'recuo-estrategico',
                nome: 'Recuo Estratégico',
                usos: { max: 3, descanso: 'longo' },
                descricao:
                    'Com uma criatura hostil a 1,5 m, use uma ação bônus e recue até o dobro do deslocamento normal, desde que não tenha feito ataque (comum ou Técnicas) nem causado dano no turno, ficando impedido de causar dano após o recuo. Não provoca reações. No próximo turno você executa uma Técnica de Combate de 3º grau ou menor por metade do custo em PP (sem consumo se causar menos da metade do dano possível ou nenhum efeito). 3 usos; voltam após um descanso longo.',
                acoes: [{ rotulo: 'Recuar (2× deslocamento)', tipo: 'deslocar', fator: 2, acao: 'bonus', usa: true }],
                etiquetas: ['Próximo turno: Técnica até 3º grau por metade do PP'],
            }),
        ],
    },
    {
        id: 'reflexo-afiado',
        nome: 'Reflexo Afiado',
        resumo: 'Disparada ou Esconder como ação bônus.',
        tracos: () => [
            hb('reflexo-afiado', {
                id: 'reflexo-afiado',
                nome: 'Reflexo Afiado',
                descricao: 'No seu turno, você pode fazer "Disparada" ou "Esconder" como Ação Bônus.',
                acoes: [
                    { rotulo: 'Disparada', tipo: 'deslocar', fator: 1, acao: 'bonus' },
                    { rotulo: 'Esconder', tipo: 'gastar', acao: 'bonus' },
                ],
            }),
        ],
    },
    {
        id: 'retomar-o-folego',
        nome: 'Retomar o Fôlego',
        resumo: 'Recupera 2d10 + CON em PV (6d10 no 12º), 3 usos.',
        tracos: () => [
            hb('retomar-o-folego', {
                id: 'retomar-2d10',
                nome: 'Retomar o Fôlego',
                ...ate(11),
                usos: { max: 3, descanso: 'longo' },
                descricao:
                    'No seu turno, use uma ação bônus para recuperar 2d10 + modificador de Constituição em PV. 3 usos; voltam após um descanso longo.',
                acoes: [{ rotulo: 'Recuperar PV', tipo: 'recuperar', recurso: 'pv', rolagem: '2d10+@mod.con', acao: 'bonus', usa: true }],
            }),
            hb('retomar-o-folego', {
                id: 'retomar-6d10',
                nome: 'Retomar o Fôlego',
                ...desde(12),
                usos: { max: 3, descanso: 'longo' },
                descricao:
                    'No seu turno, use uma ação bônus para recuperar 6d10 + modificador de Constituição em PV. 3 usos; voltam após um descanso longo.',
                acoes: [{ rotulo: 'Recuperar PV', tipo: 'recuperar', recurso: 'pv', rolagem: '6d10+@mod.con', acao: 'bonus', usa: true }],
            }),
        ],
    },
    {
        id: 'robusto',
        nome: 'Robusto',
        resumo: 'PV máximos +3 por nível (e +3 a cada nível novo).',
        tracos: () => [
            hb('robusto', {
                id: 'robusto',
                nome: 'Robusto',
                descricao: 'Seu máximo de PV aumenta em 3 vezes o seu nível ao adquirir esta HB e em mais 3 a cada nível depois.',
                efeitos: [{ alvo: 'pv.max', modo: 'soma', valor: '3*@nivel' }],
            }),
        ],
    },
    {
        id: 'sortudo',
        nome: 'Sortudo',
        resumo: 'Rola de novo um ataque (comum), perícia ou salvaguarda, qualquer resultado; 3 usos.',
        tracos: () => [
            hb('sortudo', {
                id: 'sortudo',
                nome: 'Sortudo',
                usos: { max: 3, descanso: 'longo' },
                descricao:
                    'Você pode rolar novamente uma jogada de ataque (comum), Perícia ou Salvaguarda que você ou uma criatura inimiga tenha feito, escolhendo qualquer um dos resultados. 3 usos; voltam após um descanso longo.',
                acoes: [{ rotulo: 'Rolar novamente (d20)', tipo: 'rolar', rolagem: '1d20', usa: true, acao: 'livre' }],
            }),
        ],
    },
    {
        id: 'superando-limites',
        nome: 'Superando Limites',
        resumo: 'Ao começar um encontro com 0 PP, recupera nível + ½ proficiência em PP.',
        tracos: () => [
            hb('superando-limites', {
                id: 'superando-limites',
                nome: 'Superando Limites',
                usos: { max: 1, descanso: 'longo' },
                descricao:
                    'Ao iniciar um encontro com 0 PP, você recupera PP igual ao seu nível + metade do bônus de proficiência (arredondada para baixo). Volta após um descanso longo. Alternativamente, ao usar as regras de sobrecarga das Técnicas de Combate, sem passar de 3 Níveis de Exaustão, use esta característica para não sofrer a exaustão.',
                acoes: [
                    { rotulo: 'Recuperar PP (0 PP)', tipo: 'recuperar', recurso: 'pp', rolagem: '{@nivel+floor(@prof/2)}', usa: true, acao: 'livre' },
                ],
            }),
        ],
    },
    {
        id: 'superioridade-absoluta',
        nome: 'Superioridade Absoluta',
        resumo: 'Ao aplicar dano, se sobram PV ≤ seu nível, o alvo cai a 0; cada abate soma +5 (máx. +15) até o fim do encontro.',
        tracos: () => [
            hb('superioridade-absoluta', {
                id: 'superioridade-absoluta',
                nome: 'Superioridade Absoluta',
                descricao:
                    'Ao término do cálculo de dano de uma jogada de ataque (comum ou Técnicas) ou Salvaguarda imposta por você, se os PV restantes forem iguais ou menores que o seu nível, a criatura recebe o dano necessário para chegar a 0. Quando derrotar uma criatura assim, some +5 ao seu nível para esse limite (máximo +15) até o fim do encontro. (Automático ao aplicar o dano pelo chat.)',
                etiquetas: ['PV restantes ≤ nível: alvo cai a 0'],
            }),
        ],
    },
];

export const HABILIDADES_BASICAS: HabilidadeBasica[] = BASICAS;
export const hbPorId = (id: string | null | undefined): HabilidadeBasica | undefined => BASICAS.find((h) => h.id === id);
