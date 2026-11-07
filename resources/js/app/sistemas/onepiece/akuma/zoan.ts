// Zoan (cap. 6.12 e 6.13): Traços Comuns, Específicos e Ancestrais, Predador, Points e Estágio Desperto.
import type { EfeitoBruto } from '../../../nucleo/efeitos/efeitos.ts';
import type { TracoDados } from '../construtor/dados/tipos.ts';
import { PERICIAS, type Tecnica } from '../regras.ts';

const t = (id: string, nome: string, descricao: string, extra: Partial<TracoDados> = {}): TracoDados => ({ id, nome, descricao, ...extra });

export const TRACOS_COMUNS: TracoDados[] = [
    t(
        'andar-no-gelo',
        'Andar no Gelo',
        'Quando na forma animal ou híbrida, você pode se mover e escalar superfícies congeladas sem precisar realizar um Teste de Atributo. Além disso, terreno difícil composto por gelo ou neve não custa deslocamento extra para você.',
    ),
    t('audicao-agucada', 'Audição Aguçada', 'Em qualquer forma, você tem vantagem em Testes de Vontade (Percepção) relacionados à audição.'),
    t(
        'camuflagem',
        'Camuflagem',
        'Quando na forma animal ou híbrida, você tem vantagem em Testes de Destreza (Furtividade), relacionados à sua pele ou pelugem, para se esconder, se ficar sem se mexer.',
    ),
    t('corpo-minusculo', 'Corpo Minúsculo', 'Quando na forma animal, você recebe vantagem nas Salvaguardas e Testes de Atributo de Destreza.'),
    t(
        'couro-farpado',
        'Couro Farpado',
        'Quando na forma animal ou híbrida, no começo de cada um dos seus turnos, você causa 1d10 de dano perfurante a qualquer criatura que esteja te agarrando.',
    ),
    t(
        'cuspir-veneno',
        'Cuspir Veneno',
        'Quando na forma animal ou híbrida, você pode fazer uma jogada de ataque (comum) à distância com alcance de até 9 metros em Linha contra uma criatura. Caso acerte, essa criatura deve ser bem-sucedida em uma Salvaguarda de Constituição (CD igual ao das Técnicas) para não receber 3d8 de dano de Veneno.',
    ),
    t(
        'deslocamento-animal',
        'Deslocamento Animal',
        'Quando na forma híbrida, seu deslocamento se torna 15 metros (prevalece o maior, caso tenha). Quando na forma animal, você recebe 18 metros de deslocamento (apenas para usuários de Akuma no Mi).',
    ),
    t(
        'ecolocalizacao',
        'Ecolocalização',
        'Quando na forma animal ou híbrida, você pode perceber seus arredores sem depender de visão dentro de um raio de 9 metros. Você não pode se beneficiar desta característica enquanto estiver com a condição "Surdo".',
    ),
    t(
        'escalada-aracnidea',
        'Escalada Aracnídea',
        'Quando na forma animal ou híbrida, você recebe deslocamento de escalada igual à metade do seu deslocamento normal e pode andar se prendendo em paredes e tetos, sem precisar realizar um Teste de Atributo.',
    ),
    t(
        'escalador',
        'Escalador',
        'Quando na forma animal ou híbrida, você recebe deslocamento de escalada igual ao seu deslocamento normal, sem precisar realizar um Teste de Atributo.',
    ),
    t(
        'escavador',
        'Escavador',
        'Quando na sua forma animal ou híbrida, usando uma ação, você pode escavar através de rocha sólida com metade do seu deslocamento e deixa um túnel de 1,5 metro de raio para trás.',
    ),
    t(
        'especialidade-animal',
        'Especialidade Animal',
        'Quando na forma animal ou híbrida, você recebe o dobro do seu Bônus de Proficiência em uma perícia que você já seja proficiente. Escolha entre Acrobacia, Atletismo, Furtividade, Intimidação e Sobrevivência. Este traço pode ser escolhido até 2 vezes por personagem.',
    ),
    t('faro-agucado', 'Faro Aguçado', 'Em qualquer forma, você tem vantagem em Testes de Vontade (Percepção) relacionados ao olfato.'),
    t(
        'habilidade-animal',
        'Habilidade Animal',
        'Quando na forma animal ou híbrida, você recebe proficiência em uma Perícia. Você pode escolher entre Acrobacia, Atletismo, Furtividade, Intimidação e Sobrevivência.',
    ),
    t(
        'inflar',
        'Inflar',
        'Quando na forma animal ou híbrida, com uma ação bônus, você consegue aumentar uma categoria de tamanho e todas as criaturas que estejam a até 1,5 metro de você devem fazer uma Salvaguarda de Força CD 14, sendo lançadas por 6 metros e recebendo o estado "Caído", se falharem no teste, ou empurradas por 3 metros, se passarem.',
        { acao: 'bonus' },
    ),
    t(
        'luz-propria',
        'Luz Própria',
        'Quando na forma animal ou híbrida, você consegue criar luz de uma parte do seu corpo, iluminando uma esfera com raio de 6 metros com luz plena e mais 3 metros como penumbra.',
    ),
    t(
        'multiplos-membros',
        'Múltiplos Membros (2 extras ou mais)',
        'Quando estiver na forma animal ou híbrida, você pode usar uma ação bônus para realizar uma única jogada de ataque (comum). Para isso, durante esse mesmo turno, você não pode ter usado nem usar posteriormente a ação "atacar". Alternativamente, essa ação bônus pode ser usada para "Usar um Objeto" ou "Guardar e Sacar" uma quantidade de armas igual à quantidade de membros extras.',
        { acao: 'bonus' },
    ),
    t('pele-escorregadia', 'Pele Escorregadia', 'Quando na forma animal ou híbrida, qualquer criatura que tente te agarrar recebe desvantagem.'),
    t(
        'percepcao-as-cegas',
        'Percepção às Cegas',
        'Quando na forma animal ou híbrida, você pode perceber seus arredores sem depender de visão dentro de um raio de 6 metros.',
    ),
    t(
        'prender-a-respiracao',
        'Prender a Respiração',
        'Em qualquer forma, você consegue prender a respiração por até 1 hora, mantendo-a mesmo ao receber danos.',
    ),
    t(
        'soltar-tinta',
        'Soltar Tinta',
        'Quando na forma animal ou híbrida, você pode usar uma ação para soltar sua tinta em um cone de 6 metros; toda criatura dentro da área, que utilize seus olhos para enxergar, deve fazer uma Salvaguarda de Destreza CD 14 para não receber a condição "Cego" até que use uma ação para limpar a tinta ou seja coberta com água corrente.',
    ),
    t('visao-agucada', 'Visão Aguçada', 'Em qualquer forma, você tem vantagem em Testes de Vontade (Percepção) relacionados à visão.'),
    t(
        'visao-noturna',
        'Visão Noturna',
        'Em qualquer forma, você pode ver na escuridão em um raio de 18 metros. Pode ver na penumbra como se estivesse sob luz plena e na escuridão como se estivesse na penumbra. Você não consegue discernir cores na escuridão, apenas tons de cinza.',
    ),
    t(
        'voo',
        'Voo',
        'Quando na forma híbrida, você recebe 9 metros de voo e pode usar todo ou parte desse movimento para voar. Quando na forma animal, seu deslocamento de voo se torna 15 metros (apenas para usuários de Akuma no Mi).',
    ),
];

/** Traços que podem ser escolhidos mais de uma vez (até N vezes). */
export const TRACOS_REPETIVEIS: Record<string, number> = { 'especialidade-animal': 2, 'corpo-resistente': 2 };

export interface GrupoDeTracosEspecificos {
    id: string;
    nome: string;
    tracos: TracoDados[];
}

export const TRACOS_ESPECIFICOS: GrupoDeTracosEspecificos[] = [
    {
        id: 'voadores',
        nome: 'Animais Voadores',
        tracos: [
            t(
                'ataque-de-mergulho',
                'Ataque de Mergulho',
                'Quando na forma animal ou híbrida, se você estiver voando e mergulhar, pelo menos 6 metros, em linha reta e atingir um alvo com uma jogada de ataque (comum) corpo a corpo, causa 3d6 de dano extra ao alvo.',
            ),
            t('planar', 'Planar', 'Quando na forma animal ou híbrida, desde que não esteja com suas asas presas, você não recebe dano de queda.'),
            t(
                'sobrevoo',
                'Sobrevoo',
                'Quando na forma animal ou híbrida, você não provoca uma reação ou a característica "Ataque de Oportunidade" quando realiza um voo para fora do alcance de um inimigo.',
            ),
        ],
    },
    {
        id: 'quadrupedes',
        nome: 'Animais Quadrúpedes',
        tracos: [
            t(
                'agarrar-com-a-cauda',
                'Agarrar com a Cauda',
                'Quando na forma híbrida, usando uma ação bônus, você pode usar sua cauda para tentar agarrar uma criatura com uma jogada de ataque (comum) corpo a corpo desarmado. Caso acerte, em vez de causar dano, o alvo fica agarrado. Enquanto a criatura estiver agarrada, você tem vantagem nas suas jogadas de ataque (comum) corpo a corpo contra ela, não podendo usar esta característica em mais de uma criatura ao mesmo tempo.',
                { acao: 'bonus' },
            ),
            t(
                'bote',
                'Bote',
                'Quando na forma animal, desde que tenha percorrido no mínimo 6 metros, você pode substituir o seu primeiro ataque normal desarmado corpo a corpo, para desferir uma mordida que causa 2d6 de dano Perfurante e o alvo deve ser bem-sucedido em uma Salvaguarda de Força para não ser derrubado.',
            ),
            t(
                'postura-animal',
                'Postura Animal',
                'Quando na forma animal, ao ter que fazer uma Salvaguarda para não receber a condição "Caído", você recebe vantagem na jogada.',
            ),
        ],
    },
    {
        id: 'robustos',
        nome: 'Animais Robustos',
        tracos: [
            t(
                'cabeca-dura',
                'Cabeça Dura',
                'Quando na forma animal ou híbrida, ao ter que fazer uma Salvaguarda para não receber a condição "Atordoado", você recebe vantagem na jogada.',
            ),
            t(
                'corpo-inerte',
                'Corpo Inerte',
                'Quando na forma animal ou híbrida, ao ter que fazer uma Salvaguarda para não ser empurrado, você recebe vantagem na jogada.',
            ),
            t(
                'duro-de-matar',
                'Duro de Matar',
                'Quando você cair a 0 Pontos de Vida, mas não morrer, esta característica é ativada. Você permanece com 0 PV até o turno da criatura que causou o dano ser completamente encerrado; nesse momento, recupera 1 PV. Não pode ser usada de novo até concluir um descanso longo. Ferimentos e dores continuam sendo considerados normalmente.',
                { usos: { max: 1, descanso: 'longo' } },
            ),
            t(
                'poder-de-tracao',
                'Poder de Tração',
                'Quando na forma animal, você recebe vantagem em Testes de Atributo e Salvaguardas de Força. Além disso, dobra o valor base da sua capacidade de carga.',
            ),
        ],
    },
    {
        id: 'outros',
        nome: 'Outros Tipos',
        tracos: [
            t(
                'casco-protetor',
                'Casco Protetor',
                'Quando na forma animal ou híbrida, você recebe +2 na CR normal enquanto mantém o casco e pode usar sua reação para entrar totalmente no casco e receber +5 na CR normal. Enquanto dentro do casco, você fica incapacitado e com deslocamento 0. Você só pode usar uma ação para sair do casco.',
            ),
            t(
                'chifre-garra',
                'Chifre/Garra',
                'Quando na forma animal ou híbrida, uma vez por turno, você pode usar uma ação bônus para trocar o tipo de dano de uma jogada de ataque (comum) corpo a corpo desarmado para "Perfurante" ou "Cortante" e adicionar 1d6 de dano extra ao ataque.',
                { acao: 'bonus' },
            ),
            t(
                'regeneracao',
                'Regeneração',
                'Em qualquer forma, você recupera 1d6 PV + seu modificador de Constituição, no início de cada um dos seus turnos, se estiver consciente e possuir pelo menos 1 PV, podendo regenerar ossos, pedaços de órgãos e recuperar partes do corpo em alguns dias. Recupera no máximo 3 vezes o seu nível + 10 PV; não pode ser usada de novo até o término de um descanso longo.',
                { usos: { formula: '3*@nivel+10', descanso: 'longo' } },
            ),
            t(
                'corpo-resistente',
                'Corpo Resistente',
                'Quando na forma animal ou híbrida, você recebe resistência a um tipo de dano, por exemplo veneno, fogo, frio, cortante etc. Este traço pode ser escolhido até 2 vezes por personagem.',
            ),
            t(
                'sanguinario',
                'Sanguinário',
                'Em qualquer forma, você pode usar uma ação bônus para impor sobre você mesmo a condição "Enfurecido", escolhendo um alvo que tenha te ferido ou te ofendido de alguma forma no último minuto. Não pode ser usada de novo até o término de um descanso longo.',
                { acao: 'bonus', usos: { max: 1, descanso: 'longo' } },
            ),
            t(
                'saude-animal',
                'Saúde Animal',
                'Em qualquer forma, você pode escolher recuperar todos os Dados de Vida ao terminar um descanso longo. Não pode ser usada de novo até o término de 1+1d4 descansos longos.',
            ),
            t(
                'surto-de-adrenalina',
                'Surto de Adrenalina',
                'Em qualquer forma, uma vez durante um encontro, você pode se concentrar por 1 turno, sem usar sua ação, ação poderosa ou deslocamento, e recuperar 2d6 PP, que são perdidos ao final da batalha, caso não usados. Até 3 vezes; recupera todos os usos em um descanso longo.',
                {
                    usos: { max: 3, descanso: 'longo' },
                    acoes: [{ rotulo: 'Recuperar 2d6 PP', tipo: 'recuperar', recurso: 'pp', rolagem: '2d6', usa: true }],
                },
            ),
            t(
                'resistencia-animal',
                'Resistência Animal',
                'Quando na forma animal ou híbrida, você recebe proficiência em um tipo de Salvaguarda. Você pode escolher entre Força, Destreza ou Constituição.',
            ),
        ],
    },
];

export const TRACOS_ANCESTRAIS: TracoDados[] = [
    t(
        'animal-grande',
        'Animal Grande',
        'Quando na forma animal, a sua categoria de tamanho se torna Grande, seu alcance aumenta em 1,5 metro e você recebe desvantagem em Testes de Atributo de Destreza (Furtividade).',
    ),
    t('criatura-robusta', 'Criatura Robusta', 'Em qualquer forma, o seu valor máximo de Pontos de Vida aumenta em 20.', {
        efeitos: [{ alvo: 'pv.max', modo: 'soma', valor: 20 }],
    }),
    t(
        'investida-atropeladora',
        'Investida Atropeladora',
        'Quando na forma animal ou híbrida, se você correr, pelo menos, 6 metros em linha reta até uma criatura e então atingi-la com uma jogada de ataque (comum) corpo a corpo, o alvo deve ser bem-sucedido em uma Salvaguarda de Força, ou cairá no chão. Se o alvo for derrubado, você pode realizar outro ataque corpo a corpo, como parte do deslocamento.',
    ),
    t(
        'monstro-de-cerco',
        'Monstro de Cerco',
        'Quando na forma animal, suas jogadas de ataque (comum) corpo a corpo causam o dobro do dano a objetos e estruturas.',
    ),
    t(
        'pele-resistente',
        'Pele Resistente',
        'Quando na forma animal ou híbrida, você recebe resistência em um tipo de dano à sua escolha entre Contundente, Cortante ou Perfurante.',
    ),
    t(
        'recuperacao-acelerada',
        'Recuperação Acelerada',
        'Em qualquer forma, quando você cair a 0 Pontos de Vida e não morrer, após 30 minutos, você pode recobrar a consciência usando todos os seus Dados de Vida disponíveis e mais 3 adicionais, para recuperar seus Pontos de Vida.',
    ),
];

export const PREDADOR: TracoDados = t(
    'predador',
    'Predador',
    'Quando estiver na forma animal ou híbrida, uma vez por turno, ao causar dano, você pode recuperar uma quantidade de Pontos de Vida igual ao dano causado e 1 Ponto de Poder. Por meio desta característica você recupera, no máximo, 3 vezes o seu nível de personagem em PV e metade do seu nível (para baixo) em PP. Ao atingir esses limites, não pode se beneficiar novamente até concluir um descanso longo.',
);

/** Formas do usuário Zoan. */
export const FORMAS_ZOAN =
    'Todos mudam entre as formas original, animal e híbrida, uma vez por turno sem ação ou, alternativamente, com uma ação bônus para mudar de novo no mesmo turno. Forma Original: o estado normal (a maioria dos benefícios da Zoan é interrompida, exceto os que valem em qualquer forma). Forma Híbrida: combinação da animal com a original, representada pelos Points. Forma Animal: apenas as características e habilidades inatas do animal (indistinguível de um animal comum).';

export const tracoPorId = (lista: TracoDados[], id: string): TracoDados | undefined => lista.find((x) => x.id === id);
export const todosOsEspecificos = (): TracoDados[] => TRACOS_ESPECIFICOS.flatMap((g) => g.tracos);

/** Quantos traços cada tipo de Zoan escolhe (6.12 e 6.13). */
export function limitesDeTracos(zoan: 'comum' | 'ancestral' | 'mitica', predador: boolean, desperto: boolean) {
    if (zoan === 'mitica') {
        return { comuns: 2, especificos: 2, ancestrais: 1, extra: desperto ? 1 : 0, troca: 0 };
    }

    return { comuns: 3, especificos: predador ? 3 : 5, ancestrais: zoan === 'ancestral' ? 1 : 0, extra: 0, troca: zoan === 'ancestral' ? 3 : 0 };
}

// --- Points ------------------------------------------------------------------------------------------------------

/** Criação de Points: nível, PP virtuais máximos nos Traços Realçados e PP máximos na Técnica. */
export const CRIACAO_DE_POINTS: { ponto: number; nivel: number; tracos: number; tecnica: number }[] = [
    { ponto: 1, nivel: 1, tracos: 0, tecnica: 2 },
    { ponto: 2, nivel: 3, tracos: 4, tecnica: 4 },
    { ponto: 3, nivel: 6, tracos: 6, tecnica: 6 },
    { ponto: 4, nivel: 9, tracos: 8, tecnica: 8 },
    { ponto: 5, nivel: 12, tracos: 10, tecnica: 10 },
];

/** Dano desarmado do Arm Point (Força Animal). */
export const FORCA_ANIMAL: { de: number; ate: number; dado: string }[] = [
    { de: 1, ate: 5, dado: '1d6' },
    { de: 6, ate: 10, dado: '1d8' },
    { de: 11, ate: 15, dado: '1d10' },
    { de: 16, ate: 20, dado: '1d12' },
];

/** PV do Heavy Point (Físico Animalesco), do 1º ao 20º nível. */
export const FISICO_ANIMALESCO: number[] = [42, 64, 86, 103, 120, 142, 164, 186, 203, 220, 242, 264, 286, 303, 320, 342, 364, 386, 403, 420];

export interface ModeloDePoint {
    id: string;
    nome: string;
    nota: string;
    tracos: TracoDados[];
    /** Técnica do Point e o grau dela (o nível mínimo vem da tabela de graus). */
    tecnica?: { grau: number; dados: Omit<Tecnica, 'builder' | 'origem' | 'criador'> };
}

const tec = (
    grau: number,
    nome: string,
    custo: number,
    alcance: string,
    efeito: string,
    descricao: string,
    rolagem = '',
    tipoDano?: string,
    acao: Tecnica['acao'] = 'poderosa',
) => ({
    grau,
    dados: { nome, custo, alcance, efeito, descricao, rolagem, ...(tipoDano ? { tipoDano } : {}), acao },
});

/**
 * A tabela do Físico Animalesco em fórmula: 42 no 1º nível, +22 por nível, exceto +17 nos níveis terminados em 4 e 0 (4º, 5º,
 * 9º, 10º, 14º, 15º, 19º, 20º). Confere com `FISICO_ANIMALESCO` (teste).
 */
export const FORMULA_FISICO_ANIMALESCO = '42+22*(@nivel-1)-5*(floor((@nivel+1)/5)+floor(@nivel/5))';

export const MODELOS_DE_POINT: ModeloDePoint[] = [
    {
        id: 'arm-point',
        nome: 'Arm Point',
        nota: 'Qualquer usuário de Zoan. Altera a forma dos membros superiores ou inferiores, aumentando os músculos e dando maior força física.',
        tracos: [
            ...FORCA_ANIMAL.map(({ de, ate, dado }) =>
                t(
                    `forca-animal-${de}`,
                    `Força Animal (Arm Point): ${dado}`,
                    `Quando na forma híbrida, sua força cresce e seus ataques corpo a corpo desarmados são substituídos pela tabela "Força Animal": ${dado} de dano do ${de}º ao ${ate}º nível (1d6, 1d8, 1d10 e 1d12 a cada 5 níveis). O dano pode ser Contundente, cortante ou perfurante, de acordo com o animal e o tipo de ataque. Use o botão de dano abaixo no lugar do dano desarmado normal.`,
                    {
                        nivelMin: de,
                        nivelMax: ate,
                        acoes: [
                            {
                                rotulo: `Dano desarmado (Força Animal ${dado})`,
                                tipo: 'rolar',
                                rolagem: `${dado}+@dano.desarmado`,
                                passo: 'desarmado',
                            },
                        ],
                    },
                ),
            ),
        ],
        tecnica: tec(
            1,
            'Arm Point: Heavy Gong',
            2,
            'Toque',
            '2d10 Contundente',
            'Você aumenta a força dos seus braços para realizar uma poderosa jogada de ataque (Técnicas) corpo a corpo contra uma criatura. Ataque Combinado possível.',
            '2d10',
            'Contundente',
        ),
    },
    {
        id: 'brain-point',
        nome: 'Brain Point',
        nota: 'Exclusivo para animais com grande inteligência: altera a forma física para melhorar a capacidade cognitiva.',
        tracos: [],
        tecnica: tec(
            4,
            'Brain Point: Scope',
            7,
            'Pessoal',
            'Vantagem e crítico 18-20',
            'Analisando uma criatura inimiga, você percebe seus pontos fracos e os explora ao máximo, até que o inimigo reverta a situação. Enquanto a Técnica durar (até 1 minuto), todas as suas jogadas de ataque (comum) contra uma criatura escolhida recebem vantagem e têm a margem de acerto crítico alterada para 18-20. Alternativamente: concede vantagem à jogada de ataque (Técnicas) de uma única Técnica e margem crítica 18-20, gastando apenas metade dos PP. Ataque Combinado possível.',
        ),
    },
    {
        id: 'claw-point',
        nome: 'Claw Point',
        nota: 'Exclusivo para animais com garra ou algo semelhante.',
        tracos: [
            t(
                'climbing-spikes',
                'Climbing Spikes (Claw Point)',
                'Quando na forma híbrida, você recebe movimento de escalada igual ao seu deslocamento normal, podendo se manter preso à parede sem precisar de nenhuma ação e recebe vantagem em Salvaguardas para se manter preso a uma parede.',
            ),
        ],
        tecnica: tec(
            5,
            'Claw Point: Savage Attack',
            10,
            'Toque',
            '9d10 Cortante + Sangramento',
            'Você realiza uma jogada de ataque (Técnicas) corpo a corpo feroz contra uma criatura, rasgando seu corpo. A criatura atingida deve ser bem-sucedida em uma Salvaguarda de Constituição ou receberá a condição "Sangramento". Ataque Combinado impossível.',
            '9d10',
            'Cortante',
        ),
    },
    {
        id: 'guard-point',
        nome: 'Guard Point',
        nota: 'Exclusivo para animais com pelugem: aumenta em quantidade e tamanho os pelos, para mais proteção.',
        tracos: [],
        tecnica: tec(
            2,
            'Guard Point: Heavy Guard',
            4,
            'Pessoal',
            'CR +1 e −4d8 de dano',
            'Em qualquer forma, ao receber danos, você pode usar sua reação para aumentar sua CR em +1 e diminuir o dano sofrido até o fim da duração da Técnica (até o início do seu próximo turno) em 4d8. <Heavy Defense> No 12º nível, usando sua reação, você pode usá-la como Técnica de 5º Grau: CR +3 e −8d8 de dano, custa 10 PP.',
            '',
            undefined,
            'reacao',
        ),
    },
    {
        id: 'heavy-point',
        nome: 'Heavy Point',
        nota: 'Exclusivo para animais de médio e grande porte: grande crescimento da massa corporal, estatura e peso.',
        tracos: [
            t(
                'fisico-animalesco',
                'Físico Animalesco (Heavy Point)',
                'Em qualquer forma, o corpo é modificado permanentemente: os PV ganhos pelo Estilo de Combate (modificador de Constituição incluso) e pela Espécie são substituídos pelos da tabela "Físico Animalesco" (outras características que somam PV continuam somando), independentemente da forma ou Point em uso: 1º 42, 2º 64, 3º 86, 4º 103, 5º 120, 6º 142, 7º 164, 8º 186, 9º 203, 10º 220, 11º 242, 12º 264, 13º 286, 14º 303, 15º 320, 16º 342, 17º 364, 18º 386, 19º 403, 20º 420. Automático: o PV máximo base passa a ser o da tabela do seu nível.',
                { efeitos: [{ alvo: 'pv.max', modo: 'base', valor: FORMULA_FISICO_ANIMALESCO }] },
            ),
        ],
    },
    {
        id: 'horn-point',
        nome: 'Horn Point',
        nota: 'Exclusivo para animais com chifre ou algo semelhante.',
        tracos: [
            t(
                'colonnade',
                'Colonnade (Horn Point)',
                'Quando na forma híbrida, ao usar seus chifres para atacar, o alcance de sua jogada de ataque (comum) corpo a corpo desarmado aumenta em 1,5 metro.',
            ),
        ],
        tecnica: tec(
            4,
            'Horn Point: Big Horn',
            8,
            'Toque',
            '7d10 Perfurante + Caído',
            'Você usa seus poderosos chifres, que aumentam de tamanho, para realizar uma jogada de ataque (Técnicas) corpo a corpo. A criatura atingida deve ser bem-sucedida em uma Salvaguarda de Força ou receberá a condição "Caído". Ataque Combinado impossível.',
            '7d10',
            'Perfurante',
        ),
    },
    {
        id: 'jump-point',
        nome: 'Jump Point',
        nota: 'Exclusivo para animais com grande poder nas pernas e nos saltos.',
        tracos: [
            t(
                'speed-jump',
                'Speed Jump (Jump Point)',
                'Quando na forma híbrida, você salta até 9 metros em distância e 6 metros de altura, sem sofrer dano de queda por essa altura (caso não esteja incapacitado ou preso).',
            ),
        ],
        tecnica: tec(
            1,
            'Jump Point: Strong Leg',
            2,
            'Pessoal',
            'Sem redução de deslocamento',
            'Enquanto a Técnica durar (até o início do seu próximo turno), o usuário não recebe redução de deslocamento por nenhum motivo.',
            '',
            undefined,
            'bonus',
        ),
    },
    {
        id: 'kung-fu-point',
        nome: 'Kung Fu Point',
        nota: 'Qualquer usuário de Zoan: uma criatura com movimentos ágeis e coordenados, perfeitos para artes marciais.',
        tracos: [
            t(
                'passo-da-garca',
                'Passo da Garça (Kung Fu Point)',
                'Seu movimento não provoca reações de nenhum tipo, mesmo as que ignorem esse tipo de característica como "Ataque de Oportunidade Superior".',
            ),
            t(
                'golpe-do-tigre',
                'Golpe do Tigre (Kung Fu Point)',
                'A jogada de dano da sua jogada de ataque (comum) desarmado se torna 1d8 + seu modificador de Destreza (prevalece o maior, se tiver).',
            ),
            t(
                'estilo-da-cobra',
                'Estilo da Cobra (Kung Fu Point)',
                'Durante um combate e apenas uma vez por rodada, você pode usar uma ação adicional, apenas para "Atacar" (um ataque corpo a corpo desarmado), "Disparada" ou "Esquivar". Até 3 vezes; recupera todos os usos em um descanso longo.',
                { usos: { max: 3, descanso: 'longo' } },
            ),
        ],
    },
    {
        id: 'light-point',
        nome: 'Light Point',
        nota: 'Exclusivo para animais de pequeno porte: reduz o tamanho ou transforma o corpo para facilitar o movimento.',
        tracos: [
            t(
                'agilidade-animal',
                'Agilidade Animal (Light Point)',
                'Em qualquer forma, desde que não esteja "Agarrado" ou "Impedido", sua CR recebe +1 (+2 no 8º nível e +3 no 14º). Não é possível ultrapassar 21 de CR com esta característica.',
                {
                    efeitos: [{ alvo: 'ca', modo: 'soma', valor: '1+min(1,floor(@nivel/8))+min(1,floor(@nivel/14))' }],
                },
            ),
            t('reflexos-animalescos', 'Reflexos Animalescos (Light Point)', 'Em qualquer forma, você recebe vantagem em Salvaguardas de Destreza.'),
        ],
    },
    {
        id: 'poison-point',
        nome: 'Poison Point',
        nota: 'Exclusivo para animais que expelem, injetam ou usam veneno.',
        tracos: [
            t(
                'corpo-imune',
                'Corpo Imune (Poison Point)',
                'Quando na forma híbrida, você recebe Invulnerabilidade a dano de Veneno e à condição "Envenenado".',
            ),
        ],
        tecnica: tec(
            3,
            'Poison Point: Poison Sting',
            6,
            'Toque',
            'Envenenado (até 1 minuto)',
            'Realiza uma jogada de ataque (Técnicas) corpo a corpo que causa a condição "Envenenado", reduzindo o movimento da criatura atingida pela metade e causando desvantagem em todas as jogadas de ataque (comum) dela, enquanto a Técnica durar (até 1 minuto). No final de cada turno dela, a criatura pode fazer uma Salvaguarda de Constituição para encerrar todos os efeitos. Ataque Combinado impossível.',
        ),
    },
    {
        id: 'scale-point',
        nome: 'Scale Point',
        nota: 'Exclusivo para animais que possuem escama ou algo semelhante.',
        tracos: [
            t(
                'dragon-lance',
                'Dragon Lance (Scale Point)',
                'Quando na forma híbrida, com uma ação bônus, você faz uma única jogada de ataque (comum) à distância com escamas que saem do corpo como projéteis: alvo único, 1d12 + modificador de Destreza de dano Perfurante, alcance de até 15 metros em linha.',
                { acao: 'bonus' },
            ),
        ],
        tecnica: tec(
            4,
            'Scale Point: Dragon Armor',
            8,
            'Pessoal',
            'Resistência a quase todo dano',
            'Fazendo suas escamas crescerem, você cria uma armadura de escamas. Enquanto a Técnica durar (até 1 minuto), você recebe resistência contra todos os tipos de dano, com exceção de Trovejante, Psíquico e Verdadeiro.',
            '',
            undefined,
            'bonus',
        ),
    },
    {
        id: 'tail-point',
        nome: 'Tail Point',
        nota: 'Exclusivo para animais que possuem uma cauda ou algo semelhante.',
        tracos: [
            t(
                'cauda-selvagem',
                'Cauda Selvagem (Tail Point)',
                'Quando na forma híbrida, com uma ação bônus, você faz uma única jogada de ataque (comum) corpo a corpo desarmado com sua cauda. Todos a 1,5 metro de você recebem o mesmo ataque, mas sofrem apenas o dano desarmado, sem o modificador de atributo, sem efeitos ou dados adicionais, mesmo de acertos críticos.',
                { acao: 'bonus' },
            ),
        ],
        tecnica: tec(
            3,
            'Tail Point: Tail Whip',
            6,
            'Toque',
            '3d10 Contundente + empurrão',
            'Com um movimento rápido da cauda, você executa um golpe com grande força em uma jogada de ataque (Técnicas) corpo a corpo. O impacto empurra a criatura Grande ou menor para um espaço desocupado a até 9 metros, caso ela não passe em uma Salvaguarda de Força; se bater em objeto ou estrutura com mais de 1,5 m de raio, recebe 3d8 de dano extra. Ataque Combinado possível.',
            '3d10',
            'Contundente',
        ),
    },
    {
        id: 'wing-point',
        nome: 'Wing Point',
        nota: 'Exclusivo para animais que possuem asas ou algo semelhante.',
        tracos: [
            t(
                'controle-alado',
                'Controle Alado (Wing Point)',
                'Quando na forma híbrida, o usuário mantém todos os braços ao mesmo tempo que cria e usa suas asas. Você recebe vantagem na sua primeira jogada de ataque (comum) em cada turno, desde que esteja voando.',
            ),
        ],
        tecnica: tec(
            2,
            'Wing Point: Razor Wind',
            4,
            'Cone de 15 m',
            '4d6 Cortante (área)',
            'Você balança suas asas contra seus inimigos e cria uma onda de vento cortante. Toda criatura dentro da área deve fazer uma Salvaguarda de Destreza; sofre todo o dano se falhar ou metade se obtiver sucesso. Ataque Combinado possível.',
            '4d6',
            'Cortante',
        ),
    },
];

export const modeloDePointPorId = (id: string): ModeloDePoint | undefined => MODELOS_DE_POINT.find((m) => m.id === id);

// --- Despertar (Zoan Comum/Ancestral e Mítica) -------------------------------------------------------------------------

/** "Valor 30 para Testes de Atributo e Salvaguardas": o modificador desses testes sobe até +10 (não mexe em ataque, CR nem dano). */
export function efeitosDeAtributo30(atributos: string[]): EfeitoBruto[] {
    const soma = (alvo: string, atr: string): EfeitoBruto => ({ alvo, modo: 'soma', valor: `max(0,10-@mod.${atr})` });

    return atributos.flatMap((atr) => [
        soma(`salv.${atr}`, atr),
        soma(`teste.${atr}`, atr),
        ...PERICIAS.filter((p) => p.atributo === atr).map((p) => soma(`pericia.${p.id}`, atr)),
    ]);
}

export const DESPERTAR_ZOAN: TracoDados[] = [
    t(
        'liberacao-cansativa-zoan',
        'Liberação Cansativa',
        'No Estágio Desperto, 1 PP é consumido ao final de cada turno (sempre ao menos 1 PP, mesmo que entre e saia antes do fim do turno). Ao chegar a 0 PP, o estágio se encerra.',
    ),
    t(
        'explosao-de-poder-zoan',
        'Explosão de Poder',
        'No Estágio Desperto, você pode escolher recuperar 10 Pontos de Poder. Não pode ser usada de novo até o término de um descanso longo.',
        { usos: { max: 1, descanso: 'longo' }, acoes: [{ rotulo: 'Recuperar 10 PP', tipo: 'recuperar', recurso: 'pp', rolagem: '10', usa: true }] },
    ),
    t(
        'impeto-desperto-zoan',
        'Ímpeto Desperto',
        'No Estágio Desperto, ao usar uma Técnica de Combate da sua Akuma no Mi que cause dano diretamente contra uma criatura e tenha como requisito uma "Ação Poderosa", você pode fazer uma jogada de ataque (comum) contra o alvo, como parte da mesma ação poderosa. Até 3 vezes; recupera todos os usos em um descanso longo (não acumula com o "Ímpeto Antecipado" do Haki da Observação).',
        { usos: { max: 3, descanso: 'longo' } },
    ),
    t(
        'auge-fisico',
        'Auge Físico',
        'No Estágio Desperto, seus valores de Força, Destreza e Constituição passam a ser 30 para fins de Testes de Atributo e Salvaguardas. Além disso, você se beneficia de características que exijam estar na forma animal ou híbrida. Ligue o interruptor ao entrar no estágio: o modificador de teste, de salvaguarda e das perícias desses atributos passa a ser o de 30 (+10).',
        { tipo: 'ativa', efeitos: efeitosDeAtributo30(['for', 'des', 'con']) },
    ),
    t(
        'recuperacao-monstruosa',
        'Recuperação Monstruosa',
        'No Estágio Desperto, sempre que cair a 0 PV e não morrer, role 1d20: com 10 ou mais você recupera metade dos PV totais (para baixo). A cada sucesso o valor mínimo necessário nas próximas rolagens aumenta em 1 e o custo em PP da "Liberação Cansativa" aumenta em 1, cumulativamente, até o término de um descanso longo.',
    ),
];

/** Só Zoan Comum/Ancestral: a Força Bestial (a Mítica ganha MP extra, Efeito Variável e Novo Patamar). */
export const FORCA_BESTIAL: TracoDados = t(
    'forca-bestial',
    'Força Bestial',
    'No Estágio Desperto, o seu ataque corpo a corpo desarmado se torna 3d6 de dano Contundente. Use o botão de dano no lugar do dano desarmado normal.',
    { acoes: [{ rotulo: 'Dano desarmado (Força Bestial 3d6)', tipo: 'rolar', rolagem: '3d6+@dano.desarmado', passo: 'desarmado' }] },
);

export const DESPERTAR_MITICA: TracoDados[] = [
    t(
        'manifestacao-extra-zoan',
        'Manifestação de Poder Extra',
        'Durante o estágio desperto, o usuário se beneficia de uma segunda Manifestação de Poder criada pelo jogador.',
    ),
    t(
        'efeito-variavel-zoan',
        'Efeito Variável',
        'Ao entrar no Estágio Desperto, escolha um dos efeitos do "Despertar Aprimorador" ou do "Despertar Transmutador" (Logia e Paramecia). Pode escolher um novo efeito após um descanso curto ou longo.',
    ),
    t(
        'novo-patamar-zoan',
        'Novo Patamar',
        'No Estágio Desperto você recebe e pode executar Técnicas de 6º e 7º grau (ou escolher um Point qualquer), respectivamente nos níveis 16 e 20, além de um Traço Específico ou Ancestral extra.',
    ),
];

export const MANTER_A_CONSCIENCIA: TracoDados = t(
    'manter-a-consciencia',
    'Manter a Consciência (Despertar Zoan)',
    'Ao despertar, faça uma Salvaguarda de Presença ou Vontade CD 23. Sucesso: Domínio do Despertar (controle total, sem repetir o teste). Falha (sem tirar 1): você entra no Estágio Desperto, perde a consciência e ataca qualquer criatura que veja por 1 hora, mesmo sem PP; depois o estágio se encerra. Ao falhar 3 vezes ou tirar 1 no dado, o personagem se torna uma besta irracional controlada pelo Narrador.',
);
