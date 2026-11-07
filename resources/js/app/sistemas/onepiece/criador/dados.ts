// Criador de Técnicas (cap. 6 "Akuma no Mi" e cap. 10 "Técnicas"): tabelas de grau, efeitos, condições e Manifestações de Poder.
// Dados puros (sem Vue), espelhados em `app/Sistemas/OnePiece/dados/criador.json` (gerado deste arquivo e conferido por teste).

export type TipoDeTecnica = 'combate' | 'auxiliar' | 'mp';
export type FormaDeAlcance = 'pessoal' | 'toque' | 'linha' | 'esfera' | 'cone';
export type Acao = 'poderosa' | 'bonus' | 'reacao';

export interface GrauDeTecnica {
    grau: number;
    /** Nível mínimo de personagem para aprender. */
    nivel: number;
    /** Exige estágio: usuário avançado (4º e 5º) ou desperto (6º e 7º). */
    exige: '' | 'avancado' | 'desperto';
    pp: number;
    /** Dados de dano máximos (dobro do grau). */
    dados: number;
    esfera: number;
    cone: number;
    linha: number;
}

/** 6.6 – Criando Técnicas de Combate. */
export const GRAUS: GrauDeTecnica[] = [
    { grau: 1, nivel: 1, exige: '', pp: 2, dados: 2, esfera: 3, cone: 12, linha: 9 },
    { grau: 2, nivel: 3, exige: '', pp: 4, dados: 4, esfera: 4.5, cone: 15, linha: 15 },
    { grau: 3, nivel: 6, exige: '', pp: 6, dados: 6, esfera: 6, cone: 18, linha: 21 },
    { grau: 4, nivel: 9, exige: 'avancado', pp: 8, dados: 8, esfera: 7.5, cone: 21, linha: 27 },
    { grau: 5, nivel: 12, exige: 'avancado', pp: 10, dados: 10, esfera: 9, cone: 24, linha: 33 },
    { grau: 6, nivel: 16, exige: 'desperto', pp: 12, dados: 12, esfera: 10.5, cone: 27, linha: 39 },
    { grau: 7, nivel: 20, exige: 'desperto', pp: 14, dados: 14, esfera: 12, cone: 30, linha: 45 },
];

/** 6.7 – Técnicas Auxiliares (comum: níveis 1, 6 e 12; desperta: 16 e 20). */
export const AUXILIAR = {
    niveis: [1, 6, 12],
    niveisDesperta: [16, 20],
    pp: 10,
    ppDesperta: 15,
    esfera: 6,
    cone: 18,
    linha: 21,
    esferaDesperta: 9,
    coneDesperta: 24,
    linhaDesperta: 33,
    reducaoMax: 6,
};

/** Manifestações de Poder (6.9): pontos virtuais por requisito de ativação. */
export const PONTOS_VIRTUAIS = {
    base: 6,
    limiteDosEfeitos: 12,
    ativacao: [
        { id: 'passiva', nome: 'Passiva', ajuste: -3 },
        { id: 'inacao', nome: 'Inação', ajuste: -1 },
        { id: 'bonus', nome: 'Ação Bônus', ajuste: 2 },
        { id: 'reacao', nome: 'Reação', ajuste: 2 },
        { id: 'poderosa', nome: 'Ação Poderosa', ajuste: 3 },
    ],
    /** Para o alcance e os custos que dependem do grau, a MP usa o 2º grau. */
    grauPadrao: 2,
};

/** Tipos de usuário Logia/Paramecia (6.11): o que cada um recebe por nível. */
export interface PlanoDeUsuario {
    simples: boolean;
    despertado: boolean;
    manifestacoes: number;
    /** Níveis em que recebe uma Técnica de Combate de cada grau. */
    graus: Record<number, number>;
    /** Níveis em que recebe uma Técnica Auxiliar. */
    auxiliares: number[];
}

/**
 * `simples`/`avancado` + despertado ou não (a ficha guarda `akuma.usuario` e `akuma.despertada`). Zoan: Comum e Ancestral só
 * recebem Técnicas pelos Points (nenhuma pelo nível); a Mítica recebe as de combate no 1º, 3º, 6º, 9º e 12º (6º e 7º grau
 * só despertas), Auxiliares no 6º e 12º e 1 MP (2 despertas).
 */
export function planoDeUsuario(
    usuario: 'simples' | 'avancado',
    despertado: boolean,
    zoan: '' | 'comum' | 'ancestral' | 'mitica' = '',
): PlanoDeUsuario {
    if (zoan === 'comum' || zoan === 'ancestral') {
        return { simples: true, despertado, manifestacoes: 0, graus: {}, auxiliares: [] };
    }
    if (zoan === 'mitica') {
        const graus: Record<number, number> = { 1: 1, 2: 3, 3: 6, 4: 9, 5: 12 };
        if (despertado) {
            graus[6] = 16;
            graus[7] = 20;
        }

        return { simples: true, despertado, manifestacoes: despertado ? 2 : 1, graus, auxiliares: [6, 12] };
    }
    const avancado = usuario === 'avancado';
    const graus: Record<number, number> = { 1: 1, 2: 3, 3: 6 };
    if (avancado) {
        graus[4] = 9;
        graus[5] = 12;
    }
    if (despertado) {
        graus[6] = 16;
        graus[7] = 20;
    }
    const auxiliares = avancado ? [1, 6, 12] : [6];
    if (despertado) {
        auxiliares.push(16, 20);
    }
    return { simples: !avancado, despertado, manifestacoes: avancado ? (despertado ? 3 : 2) : 1, graus, auxiliares };
}

/** Tipos de dano com custo na regra opcional "Alterar o tipo de dano" (6.5). */
export const CUSTO_TIPO_DE_DANO: Record<string, 'zero' | 'um' | 'meio_ate2' | 'verdadeiro'> = {
    contundente: 'zero',
    cortante: 'zero',
    perfurante: 'zero',
    acido: 'um',
    eletrico: 'um',
    fogo: 'um',
    frio: 'um',
    veneno: 'um',
    psiquico: 'meio_ate2',
    energia: 'meio_ate2',
    trovejante: 'meio_ate2',
    verdadeiro: 'verdadeiro',
};

/** Condições (cap. 10): custo em PP em Técnicas de Akuma no Mi. `Enfraquecido` não pode ser reproduzido. */
export const CONDICOES_DE_TECNICA: { id: string; nome: string; custo: number }[] = [
    { id: 'agarrado', nome: 'Agarrado', custo: 1 },
    { id: 'amedrontado', nome: 'Amedrontado', custo: 1 },
    { id: 'atordoado', nome: 'Atordoado', custo: 6 },
    { id: 'bebado', nome: 'Bêbado', custo: 1 },
    { id: 'caido', nome: 'Caído', custo: 1 },
    { id: 'cego', nome: 'Cego', custo: 1 },
    { id: 'empoderado', nome: 'Empoderado', custo: 3 },
    { id: 'enfeiticado', nome: 'Enfeitiçado', custo: 2 },
    { id: 'enfurecido', nome: 'Enfurecido', custo: 1 },
    { id: 'envenenado', nome: 'Envenenado', custo: 1 },
    { id: 'estremecido', nome: 'Estremecido', custo: 2 },
    { id: 'impedido', nome: 'Impedido', custo: 2 },
    { id: 'incapacitado', nome: 'Incapacitado', custo: 4 },
    { id: 'inconsciente', nome: 'Inconsciente', custo: 8 },
    { id: 'invisivel', nome: 'Invisível', custo: 5 },
    { id: 'letargico', nome: 'Letárgico', custo: 2 },
    { id: 'paralisado', nome: 'Paralisado', custo: 8 },
    { id: 'queimado', nome: 'Queimado', custo: 1 },
    { id: 'sangramento', nome: 'Sangramento', custo: 1 },
    { id: 'sonolento', nome: 'Sonolento', custo: 1 },
    { id: 'sufocado', nome: 'Sufocado', custo: 1 },
    { id: 'surdo', nome: 'Surdo', custo: 1 },
];

export const MAX_CONDICOES = 3;

/** Como o custo base de um efeito depende do grau da Técnica. */
export type DependeDoGrau = '' | 'grau' | 'meio_cima' | 'meio_cima_sem1' | 'meio_baixo';

export interface OpcaoDeEfeito {
    id: string;
    rotulo: string;
    /** Custo em PP (negativo nas reduções). */
    custo: number;
}

export interface ParametroDeEfeito {
    id: string;
    rotulo: string;
    tipo: 'num' | 'opcao' | 'marca';
    min?: number;
    max?: number;
    /** `num`: PP por unidade (negativo nas reduções), dividido por `divisor` (para baixo). */
    custoPorUnidade?: number;
    divisor?: number;
    /** `marca`: PP quando marcado. */
    custo?: number;
    opcoes?: OpcaoDeEfeito[];
}

export interface EfeitoDeTecnica {
    id: string;
    nome: string;
    grupo: 'controle' | 'ofensivo' | 'suporte' | 'reducao';
    /** Resumo do efeito e da exigência (texto do livro, condensado). */
    texto: string;
    exigencia: string;
    /** Custo fixo (ou, nas reduções, o valor negativo). */
    base: number;
    grau: DependeDoGrau;
    /** Sobrescreve a base nas Técnicas Auxiliares. */
    baseAuxiliar?: number;
    params?: ParametroDeEfeito[];
    /** Custo adicional por "Em Duração Prolongada" (para o 1º minuto); `null` = não se aplica / já incluso. */
    prolongada: number | null;
    /** Só em Técnicas de Combate ou só em Auxiliares. */
    apenas?: 'combate' | 'auxiliar';
    /** Pode entrar numa Manifestação de Poder. */
    mp: boolean;
    /** Grau máximo / mínimo da Técnica. */
    grauMax?: number;
    grauMin?: number;
    /** Ação em que a Técnica deve ser executada. */
    acao?: Acao[];
    /** Exige uma Técnica com jogada de ataque / com área / com Salvaguarda de dano. */
    requer?: ('ataque' | 'area' | 'linha' | 'salvaguarda' | 'duracao_minuto' | 'haki' | 'dano')[];
    /** Efeitos incompatíveis com este. */
    naoCom?: string[];
}

const efeito = (e: EfeitoDeTecnica): EfeitoDeTecnica => e;

export const EFEITOS: EfeitoDeTecnica[] = [
    // ---- Controle
    efeito({
        id: 'condicao',
        nome: 'Adicionar Condição',
        grupo: 'controle',
        texto: 'Impõe até 3 condições a uma criatura (exigem Salvaguarda). Custo = PP de cada condição (cap. 10).',
        exigencia: 'Nenhuma.',
        base: 0,
        grau: '',
        prolongada: null,
        mp: true,
    }),
    efeito({
        id: 'empurrao',
        nome: 'Adicionar Empurrão',
        grupo: 'controle',
        texto: 'Empurra criatura de tamanho até Grande se falhar na Salvaguarda; +1d8 Contundente por PP gasto se bater em objeto (máx. 3d8).',
        exigencia: 'Nenhuma.',
        base: 0,
        grau: '',
        params: [{ id: 'metros', rotulo: 'Empurrão (m)', tipo: 'num', min: 3, max: 30, custoPorUnidade: 1, divisor: 3 }],
        prolongada: null,
        mp: true,
    }),
    efeito({
        id: 'vantagem',
        nome: 'Adicionar Vantagem/Desvantagem',
        grupo: 'controle',
        texto: 'Vantagem ou desvantagem (uma só) na próxima jogada de ataque, Teste de Atributo ou Salvaguarda da criatura.',
        exigencia: 'Nenhuma.',
        base: 0,
        grau: 'meio_cima',
        baseAuxiliar: 4,
        prolongada: 2,
        mp: true,
    }),
    efeito({
        id: 'alcance',
        nome: 'Aumentar Alcance',
        grupo: 'controle',
        texto: 'Aumenta o alcance de uma jogada de ataque (Técnicas) à distância.',
        exigencia: 'Alcance em Linha com jogada de ataque (Técnicas).',
        base: 0,
        grau: '',
        params: [{ id: 'metros', rotulo: 'Metros adicionais', tipo: 'num', min: 6, max: 60, custoPorUnidade: 1, divisor: 6 }],
        prolongada: null,
        mp: true,
        requer: ['linha', 'ataque'],
    }),
    efeito({
        id: 'area',
        nome: 'Aumentar Área',
        grupo: 'controle',
        texto: 'Aumenta a área (Cone, Esfera, Cilindro ou Linha). Em Linha, pode aumentar a largura (2 PP por 1,5 m).',
        exigencia: 'Técnica que afete uma área.',
        base: 0,
        grau: '',
        params: [
            { id: 'metros', rotulo: 'Metros adicionais', tipo: 'num', min: 0, max: 60, custoPorUnidade: 1, divisor: 3 },
            { id: 'largura', rotulo: 'Largura adicional da Linha (passos de 1,5 m)', tipo: 'num', min: 0, max: 10, custoPorUnidade: 2 },
        ],
        prolongada: null,
        mp: true,
        requer: ['area'],
    }),
    efeito({
        id: 'condicao-area',
        nome: 'Condição/Efeito em Área',
        grupo: 'controle',
        texto: 'Impõe a mesma condição em todas as criaturas da área (quem falhar no dano faz outra Salvaguarda contra a condição).',
        exigencia: 'Técnica que afete uma área.',
        base: 0,
        grau: 'meio_cima_sem1',
        params: [{ id: 'grauRef', rotulo: 'Grau de referência (Auxiliar/área modificada)', tipo: 'num', min: 0, max: 7 }],
        prolongada: 1,
        mp: true,
        requer: ['area'],
    }),
    efeito({
        id: 'cirurgico',
        nome: 'Controle Cirúrgico',
        grupo: 'controle',
        texto: 'Protege um número de aliados igual ao seu mod. de Destreza (mín. 1) dentro da área de dano/condição.',
        exigencia: 'Técnica que obrigue outras criaturas a uma Salvaguarda para evitar dano ou condição.',
        base: 1,
        grau: '',
        prolongada: 1,
        mp: true,
        requer: ['salvaguarda'],
    }),
    efeito({
        id: 'power-up',
        nome: 'Power Up',
        grupo: 'controle',
        texto: 'Forma de combate por até 1 minuto. Só pode ser usada de novo após descanso curto ou longo.',
        exigencia: 'Ao final, só pode ser usada de novo após um descanso curto ou longo.',
        base: 3,
        grau: '',
        params: [
            { id: 'desv', rotulo: 'Criaturas têm desvantagem em Salvaguardas contra suas Técnicas (2 PP)', tipo: 'marca', custo: 2 },
            { id: 'tamanho', rotulo: 'Categoria de tamanho +1, até Enorme (1 PP)', tipo: 'marca', custo: 1 },
            { id: 'dados', rotulo: '5 dados de dano extra em Técnicas instantâneas, limitado ao grau (3 PP)', tipo: 'marca', custo: 3 },
            { id: 'pv', rotulo: 'PV só caem após 10 × nível de dano (4 PP)', tipo: 'marca', custo: 4 },
        ],
        prolongada: null,
        mp: true,
    }),
    efeito({
        id: 'dominada',
        nome: 'Técnica Dominada',
        grupo: 'controle',
        texto: 'Permite alterar o custo de PP a cada uso.',
        exigencia: 'Técnica que cause dano, redução de dano, cura ou PV temporários.',
        base: 1,
        grau: '',
        prolongada: null,
        mp: false,
    }),
    efeito({
        id: 'lacaio',
        nome: 'Criar Lacaio',
        grupo: 'controle',
        texto: 'Cria um lacaio por até 1 minuto (CR 15, 50 PV, 9 m, ataque 1d12+5). Melhorias com PP, até 15 PP no total.',
        exigencia: 'Nenhuma.',
        base: 7,
        grau: '',
        params: [
            { id: 'cr', rotulo: 'CR adicional (máx. +3)', tipo: 'num', min: 0, max: 3, custoPorUnidade: 2 },
            { id: 'pv', rotulo: 'PV adicionais (+10 cada, máx. +100)', tipo: 'num', min: 0, max: 10, custoPorUnidade: 1 },
            { id: 'desloc', rotulo: 'Deslocamento (+3 m cada, máx. 15 m)', tipo: 'num', min: 0, max: 2, custoPorUnidade: 1 },
            { id: 'ataque', rotulo: 'Dados de ataque 1d12 (máx. 3d12)', tipo: 'num', min: 0, max: 2, custoPorUnidade: 1 },
        ],
        prolongada: null,
        mp: true,
    }),
    efeito({
        id: 'rapida',
        nome: 'Técnica Rápida',
        grupo: 'controle',
        texto: 'Permite executar a Técnica como Ação Bônus ou Reação, à escolha na criação.',
        exigencia: 'Técnica de 4º grau ou menor.',
        base: 0,
        grau: 'grau',
        prolongada: null,
        mp: false,
        grauMax: 4,
        acao: ['bonus', 'reacao'],
    }),
    // ---- Ofensivo
    efeito({
        id: 'acerto-automatico',
        nome: 'Acerto Automático',
        grupo: 'ofensivo',
        texto: 'Acerta automaticamente, sem jogar dados (não há acerto crítico).',
        exigencia: 'Técnica de Combate com jogada de ataque (Técnicas).',
        base: 0,
        grau: 'grau',
        prolongada: null,
        mp: false,
        apenas: 'combate',
        requer: ['ataque'],
    }),
    efeito({
        id: 'critico',
        nome: 'Adicionar Crítico',
        grupo: 'ofensivo',
        texto: 'Aumenta a margem de acerto crítico.',
        exigencia: 'Técnica com jogada de ataque (Técnicas).',
        base: 0,
        grau: '',
        params: [
            {
                id: 'margem',
                rotulo: 'Margem',
                tipo: 'opcao',
                opcoes: [
                    { id: '19', rotulo: '19–20', custo: 1 },
                    { id: '18', rotulo: '18–20', custo: 2 },
                ],
            },
        ],
        prolongada: 1,
        mp: false,
        requer: ['ataque'],
    }),
    efeito({
        id: 'cerco',
        nome: 'Ataque de Cerco',
        grupo: 'ofensivo',
        texto: 'Dobra o resultado do dano em objetos e estruturas (não em objetos vestidos ou carregados).',
        exigencia: 'Nenhuma.',
        base: 2,
        grau: '',
        prolongada: 1,
        mp: true,
    }),
    efeito({
        id: 'multiplos',
        nome: 'Ataques Múltiplos',
        grupo: 'ofensivo',
        texto: '+2 jogadas de ataque (comum) até o final do turno.',
        exigencia: 'Duração até o final do seu turno e Ação Bônus.',
        base: 6,
        grau: '',
        prolongada: null,
        mp: false,
        acao: ['bonus'],
    }),
    efeito({
        id: 'acerto',
        nome: 'Aumentar Acerto',
        grupo: 'ofensivo',
        texto: 'Aumenta a jogada de ataque (Técnicas) em +1 por PP (até +3).',
        exigencia: 'Técnica com jogada de ataque (Técnicas).',
        base: 0,
        grau: '',
        params: [{ id: 'bonus', rotulo: 'Bônus (+1 por PP, máx. +3)', tipo: 'num', min: 1, max: 3, custoPorUnidade: 1 }],
        prolongada: 2,
        mp: false,
        requer: ['ataque'],
    }),
    efeito({
        id: 'aumentar-dano',
        nome: 'Aumentar Dano',
        grupo: 'ofensivo',
        texto: '+3 na jogada de dano de jogadas de ataque (comum) por 1 minuto, em corpo a corpo, à distância ou ambos.',
        exigencia: 'Exige Concentração (redução já inclusa) e Ação Bônus.',
        base: 3,
        grau: '',
        prolongada: null,
        mp: false,
        acao: ['bonus'],
    }),
    efeito({
        id: 'arma',
        nome: 'Criar Arma',
        grupo: 'ofensivo',
        texto:
            'Cria uma arma (propriedades de uma arma do cap. 8) por até 1 minuto, com proficiência; dano 2d8 a 4d8 sem modificador. ' +
            'Ao final de cada turno custa 2 PP ou a arma se desfaz.',
        exigencia: 'A Técnica não causa dano diretamente; exige Concentração (redução já inclusa) e Ação Bônus.',
        base: 0,
        grau: '',
        params: [
            {
                id: 'dano',
                rotulo: 'Dano da arma',
                tipo: 'opcao',
                opcoes: [
                    { id: '2d8', rotulo: '2d8', custo: 1 },
                    { id: '3d8', rotulo: '3d8', custo: 2 },
                    { id: '4d8', rotulo: '4d8', custo: 3 },
                ],
            },
        ],
        prolongada: null,
        mp: true,
        acao: ['bonus'],
    }),
    efeito({
        id: 'dano-adicional',
        nome: 'Dano Adicional',
        grupo: 'ofensivo',
        texto: 'Usada junto de outra Técnica instantânea, acrescenta dados de dano (limitado ao grau da Técnica usada).',
        exigencia: 'A Técnica não causa dano diretamente; apenas adiciona dano a outras jogadas.',
        base: 0,
        grau: '',
        params: [{ id: 'dados', rotulo: 'Dados adicionais (máx. 5)', tipo: 'num', min: 1, max: 5, custoPorUnidade: 1 }],
        prolongada: null,
        mp: false,
        apenas: 'auxiliar',
    }),
    efeito({
        id: 'dano-continuo',
        nome: 'Dano Contínuo',
        grupo: 'ofensivo',
        texto: 'Continua causando dano (uma vez por turno por criatura); máximo de dados por turno = grau. Duração máx. 1 minuto.',
        exigencia: 'Técnica de Combate que cause dano em área ou em um único alvo.',
        base: 1,
        grau: 'meio_cima',
        params: [
            { id: 'dados', rotulo: 'Dados de dano por turno (1 PP cada)', tipo: 'num', min: 1, max: 7, custoPorUnidade: 1 },
            { id: 'fixa', rotulo: 'Área fixa sem emanação ou alvo único com Salvaguarda (−2 PP)', tipo: 'marca', custo: -2 },
        ],
        prolongada: null,
        mp: false,
        apenas: 'combate',
        requer: ['dano'],
    }),
    efeito({
        id: 'insistente',
        nome: 'Dano Insistente',
        grupo: 'ofensivo',
        texto: 'Causa no mínimo metade do dano em todas as criaturas atingidas, mesmo com características contra dano.',
        exigencia: 'Dano em área fixa com Salvaguarda para metade do dano.',
        base: 0,
        grau: 'meio_cima',
        prolongada: 1,
        mp: false,
        requer: ['area', 'salvaguarda'],
    }),
    // ---- Suporte
    efeito({
        id: 'cura',
        nome: 'Adicionar Cura',
        grupo: 'suporte',
        texto: 'Cura PV: 1d10 por PP em uma criatura ou 1d6 por PP em mais de uma (área).',
        exigencia: 'Não ser Técnica de 1º grau.',
        base: 0,
        grau: '',
        params: [
            { id: 'dados', rotulo: 'Dados de cura (1 PP cada)', tipo: 'num', min: 1, max: 14, custoPorUnidade: 1 },
            { id: 'area', rotulo: 'Em mais de uma criatura (1d6 por PP)', tipo: 'marca', custo: 0 },
        ],
        prolongada: null,
        mp: false,
        grauMin: 2,
    }),
    efeito({
        id: 'pv-temp',
        nome: 'Adicionar Pontos de Vida Temporários',
        grupo: 'suporte',
        texto: 'Cria PV temporários: 1d10 por PP em uma criatura ou 1d4 por PP em mais de uma.',
        exigencia: 'Nenhuma.',
        base: 0,
        grau: '',
        params: [
            { id: 'dados', rotulo: 'Dados (1 PP cada)', tipo: 'num', min: 1, max: 14, custoPorUnidade: 1 },
            { id: 'area', rotulo: 'Em mais de uma criatura (1d4 por PP)', tipo: 'marca', custo: 0 },
        ],
        prolongada: 2,
        mp: true,
    }),
    efeito({
        id: 'voo',
        nome: 'Adicionar Voo',
        grupo: 'suporte',
        texto: 'Concede deslocamento de voo (9 m por 2 PP, +1 PP a cada 3 m; máx. 15 m).',
        exigencia: 'Nenhuma.',
        base: 0,
        grau: '',
        params: [
            {
                id: 'metros',
                rotulo: 'Voo',
                tipo: 'opcao',
                opcoes: [
                    { id: '9', rotulo: '9 m', custo: 2 },
                    { id: '12', rotulo: '12 m', custo: 3 },
                    { id: '15', rotulo: '15 m', custo: 4 },
                ],
            },
        ],
        prolongada: 1,
        mp: true,
    }),
    efeito({
        id: 'cr',
        nome: 'Aumentar Classe de Resistência',
        grupo: 'suporte',
        texto: 'Aumenta a CR de uma criatura em +1 por PP (até +3).',
        exigencia: 'Nenhuma (em MP, só com Ação Poderosa).',
        base: 0,
        grau: '',
        params: [{ id: 'bonus', rotulo: 'Bônus na CR', tipo: 'num', min: 1, max: 3, custoPorUnidade: 1 }],
        prolongada: 3,
        mp: true,
    }),
    efeito({
        id: 'movimento',
        nome: 'Aumentar Movimento',
        grupo: 'suporte',
        texto: 'Aumenta o deslocamento normal de uma criatura em 3 m (1 PP) ou 6 m (2 PP).',
        exigencia: 'Nenhuma.',
        base: 0,
        grau: '',
        params: [
            {
                id: 'metros',
                rotulo: 'Aumento',
                tipo: 'opcao',
                opcoes: [
                    { id: '3', rotulo: '+3 m', custo: 1 },
                    { id: '6', rotulo: '+6 m', custo: 2 },
                ],
            },
        ],
        prolongada: 1,
        mp: true,
    }),
    efeito({
        id: 'contencao-coletiva',
        nome: 'Contenção de Dano (Coletivo)',
        grupo: 'suporte',
        texto: 'Reserva de redução de dano para você e as criaturas atrás de você em um cone de 12 m: 1d8 por PP (máx. 15 dados).',
        exigencia: 'Uso de reação e duração até o início do seu próximo turno.',
        base: 0,
        grau: '',
        params: [{ id: 'dados', rotulo: 'Dados de 1d8', tipo: 'num', min: 1, max: 15, custoPorUnidade: 1 }],
        prolongada: null,
        mp: true,
        acao: ['reacao'],
    }),
    efeito({
        id: 'contencao-individual',
        nome: 'Contenção de Dano (Individual)',
        grupo: 'suporte',
        texto: 'Reserva de redução de dano para você ou outra criatura no alcance: 2d8 por PP (máx. 30 dados).',
        exigencia: 'Uso de reação e duração até o início do seu próximo turno (ou final do próximo da criatura).',
        base: 0,
        grau: '',
        params: [{ id: 'pares', rotulo: 'Blocos de 2d8 (1 PP cada)', tipo: 'num', min: 1, max: 15, custoPorUnidade: 1 }],
        prolongada: null,
        mp: true,
        acao: ['reacao'],
    }),
    efeito({
        id: 'reducao-movimento',
        nome: 'Redução de Movimento',
        grupo: 'suporte',
        texto: 'Reduz o deslocamento normal de uma criatura à metade (1 PP) ou a 0 (2 PP).',
        exigencia: 'Nenhuma.',
        base: 0,
        grau: '',
        params: [
            {
                id: 'nivel',
                rotulo: 'Redução',
                tipo: 'opcao',
                opcoes: [
                    { id: 'metade', rotulo: 'Pela metade', custo: 1 },
                    { id: 'zero', rotulo: 'A 0', custo: 2 },
                ],
            },
        ],
        prolongada: 1,
        mp: true,
    }),
    // ---- Redução no custo
    efeito({
        id: 'concentracao',
        nome: 'Concentração Crucial',
        grupo: 'reducao',
        texto: 'A Técnica exige Concentração e termina se você a perder. −2 PP no 1º minuto e −1 PP em cada minuto seguinte.',
        exigencia: 'Técnica com duração de 1 minuto ou mais.',
        base: 0,
        grau: '',
        params: [{ id: 'minutos', rotulo: 'Duração (minutos)', tipo: 'num', min: 1, max: 10 }],
        prolongada: null,
        mp: true,
        requer: ['duracao_minuto'],
    }),
    efeito({
        id: 'colateral',
        nome: 'Efeito Colateral',
        grupo: 'reducao',
        texto: 'A Técnica causa dano ou efeitos prejudiciais a você. Efeitos gerais: redução = PP do efeito (máx. 4); dano: 1 PP por 5 de dano (máx. 4); juntos até 8.',
        exigencia: 'Nenhuma.',
        base: 0,
        grau: '',
        params: [
            { id: 'geral', rotulo: 'PP do efeito geral recebido (máx. 4)', tipo: 'num', min: 0, max: 4, custoPorUnidade: -1 },
            { id: 'dano', rotulo: 'Dano recebido (1 PP de redução por 5; máx. 20)', tipo: 'num', min: 0, max: 20, custoPorUnidade: -1, divisor: 5 },
        ],
        prolongada: null,
        mp: true,
    }),
    efeito({
        id: 'reduzir-area',
        nome: 'Reduzir Área',
        grupo: 'reducao',
        texto: 'Diminui o alcance máximo: −1 PP por 6 m de raio (9 m em Cone), máx. −3 PP. O alcance não pode ser alterado de outra forma.',
        exigencia: 'Técnica que afete uma área.',
        base: 0,
        grau: '',
        params: [{ id: 'passos', rotulo: 'Reduções (1 PP cada, máx. 3)', tipo: 'num', min: 1, max: 3, custoPorUnidade: -1 }],
        prolongada: null,
        mp: true,
        requer: ['area'],
        naoCom: ['area', 'alcance'],
    }),
    efeito({
        id: 'requisito-limitador',
        nome: 'Requisito Limitador',
        grupo: 'reducao',
        texto: 'Exige um requisito adicional relevante (não simples). O Narrador decide entre −1 e −5 PP.',
        exigencia: 'Nenhuma.',
        base: 0,
        grau: '',
        params: [{ id: 'reducao', rotulo: 'Redução (−1 a −5, a critério do Narrador)', tipo: 'num', min: 1, max: 5, custoPorUnidade: -1 }],
        prolongada: null,
        mp: true,
    }),
    efeito({
        id: 'debilitante',
        nome: 'Técnica Debilitante',
        grupo: 'reducao',
        texto: 'Após o término, você não pode gastar PP voluntariamente por um tempo. −3 PP por minuto (máx. 2 minutos).',
        exigencia: 'Nenhuma.',
        base: 0,
        grau: '',
        params: [{ id: 'minutos', rotulo: 'Minutos sem gastar PP (máx. 2)', tipo: 'num', min: 1, max: 2, custoPorUnidade: -3 }],
        prolongada: null,
        mp: true,
    }),
    efeito({
        id: 'demorada',
        nome: 'Técnica Demorada',
        grupo: 'reducao',
        texto: 'A Técnica passa a exigir uma Ação Poderosa. −3 PP.',
        exigencia: 'Técnicas Auxiliares.',
        base: -3,
        grau: '',
        prolongada: null,
        mp: false,
        apenas: 'auxiliar',
    }),
    efeito({
        id: 'dependente',
        nome: 'Técnica Dependente',
        grupo: 'reducao',
        texto: 'Só pode ser usada consumindo os efeitos ou mantendo ativa outra Técnica (ou MP). Redução = metade dos PP dela (mín. 1, máx. 3).',
        exigencia: 'Uma Técnica fixa, ativa, como requisito.',
        base: 0,
        grau: '',
        params: [{ id: 'pp', rotulo: 'PP da Técnica exigida', tipo: 'num', min: 0, max: 15 }],
        prolongada: null,
        mp: true,
    }),
    efeito({
        id: 'devoradora',
        nome: 'Técnica Devoradora',
        grupo: 'reducao',
        texto: 'Depois da Técnica, você fica 10 minutos sem poder usar nenhuma forma de Haki. −3 PP.',
        exigencia: 'Técnica que tenha qualquer tipo de Haki como requisito.',
        base: -3,
        grau: '',
        prolongada: null,
        mp: true,
        requer: ['haki'],
    }),
    efeito({
        id: 'exaustiva',
        nome: 'Técnica Exaustiva',
        grupo: 'reducao',
        texto: 'Ao final, você recebe Níveis de Exaustão (ou só os efeitos por 1 hora). −4 PP por Nível de Exaustão.',
        exigencia: 'Nenhuma.',
        base: 0,
        grau: '',
        params: [{ id: 'niveis', rotulo: 'Níveis de Exaustão', tipo: 'num', min: 1, max: 5, custoPorUnidade: -4 }],
        prolongada: null,
        mp: true,
    }),
    efeito({
        id: 'indomavel',
        nome: 'Técnica Indomável',
        grupo: 'reducao',
        texto: 'Em múltiplos alvos o dado vira d8 e quem passar no teste não sofre dano. Redução = grau da Técnica.',
        exigencia: 'Técnica que exija Salvaguarda para metade ou todo o dano.',
        base: 0,
        grau: 'grau',
        prolongada: null,
        mp: false,
        requer: ['salvaguarda', 'area'],
    }),
    efeito({
        id: 'nao-ofensiva',
        nome: 'Técnica Não Ofensiva',
        grupo: 'reducao',
        texto: 'A Técnica não pode causar dano (nem direta nem indiretamente). −2 PP em Combate ou −1 PP em Auxiliar.',
        exigencia: 'Técnica que não pode causar dano.',
        base: -2,
        grau: '',
        baseAuxiliar: -1,
        prolongada: null,
        mp: true,
    }),
];

/** Efeitos que, quando escolhidos, impedem dano direto (o campo de dados de dano fica zerado). */
export const EFEITOS_SEM_DANO = ['nao-ofensiva', 'dano-adicional'];

/** Modificações padronizadas (6.5). */
export const MODIFICACOES = {
    aperfeicoadaGrausAcima: 2,
    aperfeicoadaGrauMax: 5,
};

export function efeitoPorId(id: string): EfeitoDeTecnica | undefined {
    return EFEITOS.find((e) => e.id === id);
}
