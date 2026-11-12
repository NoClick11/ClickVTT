/**
 * Navios (cap. 14) e tripulação (cap. 13): tabelas do livro. Arquivo PURO (sem Vue): o Node o executa nos testes e o JSON
 * `app/Sistemas/OnePiece/dados/navios.json` é gerado daqui (`DADOS_DOS_NAVIOS`) e conferido por `tests/paridade/navios.test.mjs`.
 *
 * Só construção, PV, CR, velocidade, tripulação e despesas. Combate naval, manobras, colisão e correnteza ficam com a mesa.
 */

export type TamanhoId = 'pequeno' | 'medio' | 'grande' | 'enorme' | 'colossal';

export interface Tamanho {
    id: TamanhoId;
    nome: string;
    /** Posição na escala (Pequeno = 0): requisitos "Grande ou maior" e o auto-reparo do Klabautermann. */
    ordem: number;
    dimensao: string;
    deques: number;
    comodos: number;
    tripulantes: number;
    canhoes: number;
    pv: number;
    /** Desaceleração por peso, em nós. */
    peso: number;
    mastros: number;
    pecasMadeira: number;
    pecasFortificacao: number;
    diasConstrucao: number;
    diasFortificacao: number;
    kairoseki: { pecas: number; dias: number; adicional: number };
    /** Efetivo por função (13.3): [mínimo, necessário]. */
    efetivo: { navegacao: [number, number]; limpeza: [number, number]; vigilancia: [number, number] };
}

const tam = (
    id: TamanhoId,
    nome: string,
    ordem: number,
    dimensao: string,
    n: [deques: number, comodos: number, tripulantes: number, canhoes: number, pv: number, peso: number, mastros: number],
    obra: [madeira: number, fortificacao: number, dias: number, diasFortificacao: number],
    kairoseki: [pecas: number, dias: number, adicional: number],
    efetivo: [[number, number], [number, number], [number, number]],
): Tamanho => ({
    id,
    nome,
    ordem,
    dimensao,
    deques: n[0],
    comodos: n[1],
    tripulantes: n[2],
    canhoes: n[3],
    pv: n[4],
    peso: n[5],
    mastros: n[6],
    pecasMadeira: obra[0],
    pecasFortificacao: obra[1],
    diasConstrucao: obra[2],
    diasFortificacao: obra[3],
    kairoseki: { pecas: kairoseki[0], dias: kairoseki[1], adicional: kairoseki[2] },
    efetivo: { navegacao: efetivo[0], limpeza: efetivo[1], vigilancia: efetivo[2] },
});

export const TAMANHOS: Tamanho[] = [
    tam(
        'pequeno',
        'Pequeno',
        0,
        '6 × 15 × 18 m',
        [1, 4, 20, 3, 150, 2, 1],
        [200, 40, 12, 15],
        [100, 12, 1_500_000],
        [
            [1, 2],
            [1, 2],
            [2, 4],
        ],
    ),
    tam(
        'medio',
        'Médio',
        1,
        '15 × 36 × 39 m',
        [2, 10, 50, 10, 300, 10, 2],
        [300, 60, 18, 15],
        [150, 18, 2_000_000],
        [
            [2, 3],
            [2, 3],
            [2, 4],
        ],
    ),
    tam(
        'grande',
        'Grande',
        2,
        '24 × 51 × 54 m',
        [3, 26, 130, 15, 500, 20, 2],
        [500, 80, 25, 15],
        [200, 25, 3_000_000],
        [
            [3, 5],
            [4, 6],
            [5, 7],
        ],
    ),
    tam(
        'enorme',
        'Enorme',
        3,
        '36 × 72 × 75 m',
        [4, 48, 240, 25, 750, 30, 3],
        [600, 120, 30, 30],
        [300, 30, 3_500_000],
        [
            [7, 10],
            [15, 20],
            [5, 7],
        ],
    ),
    tam(
        'colossal',
        'Colossal',
        4,
        '48 × 120 × 90 m',
        [5, 90, 450, 45, 1000, 40, 3],
        [800, 160, 40, 30],
        [400, 40, 4_500_000],
        [
            [12, 15],
            [30, 50],
            [7, 10],
        ],
    ),
];

export interface Madeira {
    id: string;
    nome: string;
    precoPorPeca: number;
    cr: number;
    br: number;
    /** Custo por PV recuperado no conserto do Carpinteiro. */
    consertoPorPv: number;
}
export const MADEIRAS: Madeira[] = [
    { id: 'cedro', nome: 'Cedro', precoPorPeca: 30_000, cr: 10, br: 5, consertoPorPv: 40_000 },
    { id: 'carvalho', nome: 'Carvalho', precoPorPeca: 80_000, cr: 12, br: 10, consertoPorPv: 100_000 },
    { id: 'cerejeira', nome: 'Cerejeira', precoPorPeca: 150_000, cr: 15, br: 15, consertoPorPv: 190_000 },
    { id: 'adam', nome: 'Adam', precoPorPeca: 400_000, cr: 18, br: 30, consertoPorPv: 500_000 },
];

export interface Fortificacao {
    id: string;
    nome: string;
    precoPorPeca: number;
    adicional: number;
    cr: number;
}
export const FORTIFICACOES: Fortificacao[] = [
    { id: 'aco', nome: 'Aço', precoPorPeca: 450_000, adicional: 900_000, cr: 1 },
    { id: 'aco-temperado', nome: 'Aço Temperado', precoPorPeca: 600_000, adicional: 900_000, cr: 2 },
];

/** Kairoseki: preço médio por peça (Ala S do Mercado Negro) e o bônus de CR. */
export const KAIROSEKI = { precoPorPeca: 10_000_000, cr: 1 };

/** Uma peça comprada pronta (`preco`) ou construída a bordo (`custo`, com prazo em dias). `null` = não se compra. */
export interface Peca {
    id: string;
    nome: string;
    preco: number | null;
    custo: number;
    dias: number;
    /** Nós de velocidade que soma. */
    nos?: number;
    /** Menor tamanho que a comporta (ordem do tamanho). */
    ordemMinima?: number;
    /** Maior tamanho que a usa. */
    ordemMaxima?: number;
    texto?: string;
}

export const ANCORAS: Peca[] = [
    { id: 'normal', nome: 'Âncora Normal', preco: 800_000, custo: 600_000, dias: 3, ordemMaxima: 2 },
    { id: 'robusta', nome: 'Âncora Robusta', preco: 1_200_000, custo: 900_000, dias: 6, ordemMinima: 3 },
];
/** Os lemes levam horas (2 h e 5 h): ficam prontos no mesmo dia. */
export const LEMES: Peca[] = [
    {
        id: 'tora',
        nome: 'Leme Tora',
        preco: 40_000,
        custo: 25_000,
        dias: 0,
        ordemMaxima: 1,
        texto: 'Pode quebrar em forte correnteza (d20: 5 ou menos).',
    },
    { id: 'circular', nome: 'Leme Circular', preco: 70_000, custo: 55_000, dias: 0 },
];
export const MASTROS: Peca[] = [
    { id: 'simples', nome: 'Mastro Simples', preco: 200_000, custo: 160_000, dias: 1, nos: 8 },
    { id: 'composto', nome: 'Mastro Composto', preco: 400_000, custo: 320_000, dias: 1, nos: 12 },
    { id: 'multiplo', nome: 'Mastro Múltiplo', preco: 600_000, custo: 480_000, dias: 2, nos: 16 },
];
export const MOTORES: Peca[] = [
    {
        id: 'manual',
        nome: 'Motor Manual',
        preco: 2_000_000,
        custo: 1_600_000,
        dias: 3,
        nos: 4,
        texto: '10 tripulantes dedicados; 1 Nível de Exaustão a cada 10 minutos.',
    },
    {
        id: 'vapor',
        nome: 'Motor a Vapor',
        preco: 25_000_000,
        custo: 20_000_000,
        dias: 5,
        nos: 6,
        ordemMinima: 2,
        texto: 'Sala das Máquinas, 300 kg de carvão por hora e 3 tripulantes dedicados.',
    },
    {
        id: 'combustao',
        nome: 'Motor de Combustão',
        preco: 60_000_000,
        custo: 48_000_000,
        dias: 15,
        nos: 8,
        ordemMinima: 2,
        texto: 'Sala das Máquinas e 10 L de combustível por hora. Colossal com duas Salas das Máquinas: 16 nós.',
    },
    {
        id: 'turbina',
        nome: 'Turbina Submersa',
        preco: 300_000_000,
        custo: 100_000_000,
        dias: 20,
        nos: 8,
        ordemMinima: 2,
        texto: 'Acionada com uma manobra: +8 nós por 2 horas, gastando 1 bateria grande. Soma com outro motor.',
    },
    {
        id: 'jato',
        nome: 'Propulsão a Jato',
        preco: null,
        custo: 1_200_000_000,
        dias: 45,
        ordemMinima: 2,
        texto: 'Após 10 minutos de preparo, o navio voa até 2 km. Gasta 2 baterias grandes.',
    },
];
/** Motores que só valem enquanto acionados: não entram na velocidade de cruzeiro. */
export const MOTORES_SOB_DEMANDA = ['turbina', 'jato'];
/** Motores que exigem o cômodo Sala das Máquinas. */
export const MOTORES_COM_SALA = ['vapor', 'combustao'];

export interface Canhao extends Peca {
    alcance: string;
    acerto: string;
    dano: string;
    pv: number;
    /** Quanto soma à CR do navio para a CR da própria arma. */
    crExtra: number;
}
export const CANHOES: Canhao[] = [
    {
        id: 'comum',
        nome: 'Canhão Comum',
        preco: 1_500_000,
        custo: 900_000,
        dias: 10,
        alcance: '90/120 m',
        acerto: '+2',
        dano: 'Munição',
        pv: 50,
        crExtra: 1,
    },
    {
        id: 'aprimorado',
        nome: 'Canhão Aprimorado',
        preco: 2_000_000,
        custo: 1_200_000,
        dias: 12,
        alcance: '120/240 m',
        acerto: '+4',
        dano: 'Munição',
        pv: 70,
        crExtra: 1,
    },
    {
        id: 'superior',
        nome: 'Canhão Superior',
        preco: 5_000_000,
        custo: 3_000_000,
        dias: 18,
        alcance: '45/90 m',
        acerto: '+6',
        dano: 'Dobro da munição',
        pv: 90,
        crExtra: 2,
    },
    {
        id: 'longo',
        nome: 'Canhão de Longo Alcance',
        preco: 10_000_000,
        custo: 6_000_000,
        dias: 30,
        alcance: '500/750 m',
        acerto: '+5',
        dano: 'Metade da munição',
        pv: 120,
        crExtra: 3,
    },
    {
        id: 'arpao',
        nome: 'Lançador de Arpão',
        preco: 2_500_000,
        custo: 1_500_000,
        dias: 25,
        alcance: '45/90 m',
        acerto: '+5',
        dano: '4d10 Perfurante',
        pv: 80,
        crExtra: 1,
    },
    {
        id: 'energia',
        nome: 'Canhão de Energia',
        preco: null,
        custo: 3_000_000_000,
        dias: 40,
        ordemMinima: 2,
        alcance: 'linha de 500 m',
        acerto: 'Salv. Destreza CD 18',
        dano: '50d12 de Energia',
        pv: 250,
        crExtra: 4,
        texto: '10 minutos de preparo; gasta 5 baterias grandes por disparo.',
    },
];

export interface Comodo {
    id: string;
    nome: string;
    custo: number;
    dias: number;
    /** Despesa semanal. */
    despesa: number;
    /** Quantos espaços de cômodo ocupa (o Quarto de Vigilância não conta). */
    espacos: number;
    /** Só um por navio. */
    unico?: boolean;
    descricao: string;
    beneficio: string;
}
const comodo = (
    id: string,
    nome: string,
    custo: number,
    dias: number,
    despesa: number,
    descricao: string,
    beneficio: string,
    extra: Partial<Comodo> = {},
): Comodo => ({
    id,
    nome,
    custo,
    dias,
    despesa,
    espacos: 1,
    descricao,
    beneficio,
    ...extra,
});
export const COMODOS: Comodo[] = [
    comodo(
        'aposento-capitao',
        'Aposento do Capitão',
        150_000,
        1,
        10_000,
        'Exclusivo do capitão: descanso e discussão dos assuntos mais importantes da tripulação.',
        'Testes e Salvaguardas de Presença do capitão têm vantagem aqui. Ao terminar um descanso longo neste cômodo, o capitão ganha um sucesso automático que substitui uma jogada falha, até o fim do próximo descanso longo.',
        { unico: true },
    ),
    comodo(
        'biblioteca',
        'Biblioteca',
        200_000,
        3,
        25_000,
        'Livros, cartas, jornais e mapas organizados.',
        'Cartas e mapas levam metade do tempo. Testes de Sabedoria de arqueólogos, caçadores de recompensas e navegadores, depois de pesquisar aqui, recebem +5.',
    ),
    comodo(
        'cela',
        'Cela',
        220_000,
        1,
        5_000,
        'Detenção de alta segurança: até 5 criaturas Médias ou 2 Grandes.',
        'Para fugir sem alertar o navio: Teste de Destreza (Furtividade) CD 25.',
    ),
    comodo(
        'cozinha',
        'Cozinha',
        300_000,
        3,
        25_000,
        'Obrigatória para o preparo dos alimentos; também serve de refeitório.',
        'A lotação máxima do navio aumenta em 5 tripulantes.',
        {
            unico: true,
        },
    ),
    comodo(
        'despensa',
        'Despensa',
        150_000,
        1,
        10_000,
        'Limpa e protegida da umidade, para conservar alimentos.',
        'Alimentos demoram o dobro para estragar. O cozinheiro e seus ajudantes alimentam 20 tripulantes a mais.',
    ),
    comodo(
        'dormitorio',
        'Dormitório',
        100_000,
        2,
        10_000,
        'Afastado do barulho, com camas confortáveis. Comporta até 5 tripulantes (com mais, ninguém recebe o descanso longo).',
        'Quem repousa aqui precisa de 1 hora a menos para o descanso longo.',
    ),
    comodo(
        'enfermaria',
        'Enfermaria',
        350_000,
        3,
        40_000,
        'Higienizada e projetada para o médico usar ao máximo suas habilidades.',
        'Testes de Sabedoria de um médico para tratar feridas e Salvaguardas de Constituição do paciente recebem +5 aqui.',
    ),
    comodo(
        'gerador',
        'Gerador de Energia',
        700_000_000,
        15,
        200_000,
        'Construído por engenheiros: converte o movimento do navio em energia. Ocupa 2 cômodos; só um por embarcação.',
        'Comporta e recarrega 3 baterias grandes (após 1 dia de viagem).',
        { espacos: 2, unico: true },
    ),
    comodo(
        'laboratorio',
        'Laboratório',
        400_000,
        4,
        35_000,
        'Pesquisa e armazenagem.',
        'Testes de Sabedoria de botânicos, cientistas, engenheiros, farmacêuticos, inventores e médicos recebem +5 aqui.',
    ),
    comodo(
        'quarto-vigilancia',
        'Quarto de Vigilância',
        250_000,
        9,
        5_000,
        'No alto de um mastro múltiplo. Não conta no máximo de cômodos.',
        'A vigilância passa a pedir só 2 tripulantes, seja qual for o tamanho do navio.',
        { espacos: 0, unico: true },
    ),
    comodo(
        'refeitorio',
        'Refeitório',
        200_000,
        2,
        10_000,
        'Onde os cozinheiros entregam as refeições.',
        'O cozinheiro e seus ajudantes alimentam 20 tripulantes a mais.',
    ),
    comodo(
        'sala-maquinas',
        'Sala das Máquinas',
        500_000,
        6,
        20_000,
        'Construída por engenheiros; ocupa 3 cômodos.',
        'Permite motor a vapor ou de combustão.',
        { espacos: 3 },
    ),
    comodo(
        'sala-ferramentas',
        'Sala de Ferramentas',
        200_000,
        2,
        15_000,
        'Armazenamento e uso das ferramentas de trabalhos manuais, criações e invenções.',
        'Testes de Sabedoria e Destreza de carpinteiros e engenheiros recebem +5 aqui.',
    ),
    comodo(
        'sala-treinamento',
        'Sala de Treinamento',
        450_000,
        3,
        30_000,
        'Ampla e resistente; ocupa 3 cômodos.',
        'Todos os tripulantes aumentam o Nível de Desafio em 1. Cada dia de treino aqui vale 2 (um tripulante por vez).',
        { espacos: 3 },
    ),
    comodo(
        'sala-tesouro',
        'Sala do Tesouro',
        600_000,
        4,
        10_000,
        'O cômodo mais seguro do navio.',
        'Só abre com duas chaves (capitão e imediato); qualquer outro meio aciona o mecanismo que protege o tesouro.',
    ),
];

/** Condição do navio pela % de PV (tabela "Navio Danificado"), da pior para a melhor. `ate` = % máxima. */
export interface Condicao {
    id: string;
    nome: string;
    ate: number;
    /** Redução de velocidade, em nós. */
    reducao: number;
    /** Estaleiro: dias e teto do custo em % do valor do navio. `null` = sem conserto. */
    estaleiro: { dias: number; teto: number } | null;
    /** Carpinteiro da tripulação: custo fixo e o dado dos dias (ele rola). */
    carpinteiro: { fixo: number; dias: string; maximo: number } | null;
}
export const CONDICOES_DO_NAVIO: Condicao[] = [
    { id: 'irreparavel', nome: 'Irreparável', ate: 5, reducao: 20, estaleiro: null, carpinteiro: null },
    {
        id: 'muito-danificado',
        nome: 'Muito Danificado',
        ate: 50,
        reducao: 8,
        estaleiro: { dias: 50, teto: 100 },
        carpinteiro: { fixo: 300_000, dias: '4d6', maximo: 24 },
    },
    {
        id: 'avariado',
        nome: 'Avariado',
        ate: 80,
        reducao: 4,
        estaleiro: { dias: 12, teto: 45 },
        carpinteiro: { fixo: 100_000, dias: '2d6', maximo: 12 },
    },
    {
        id: 'danificado',
        nome: 'Danificado',
        ate: 99,
        reducao: 0,
        estaleiro: { dias: 5, teto: 20 },
        carpinteiro: { fixo: 15_000, dias: '1d6', maximo: 6 },
    },
    { id: 'integro', nome: 'Íntegro', ate: 100, reducao: 0, estaleiro: null, carpinteiro: null },
];
/** Dano nunca reduz a velocidade abaixo disto (nós). */
export const VELOCIDADE_MINIMA_POR_DANO = 8;

export interface Funcao {
    id: string;
    nome: string;
    grupo: 'comando' | 'combate' | 'manutencao' | 'navegacao';
    texto: string;
}
/** Funções da tripulação (13.2). Cada tripulante acumula até 3, com no máximo uma de comando. */
export const FUNCOES: Funcao[] = [
    { id: 'capitao', nome: 'Capitão', grupo: 'comando', texto: 'Líder da tripulação: Peso do Mundo e Ordem do Capitão.' },
    { id: 'imediato', nome: 'Imediato', grupo: 'comando', texto: 'Segundo em comando; assume na ausência do capitão.' },
    { id: 'comandante', nome: 'Comandante', grupo: 'comando', texto: 'Lidera um grupo da tripulação.' },
    { id: 'navegacao', nome: 'Navegação', grupo: 'navegacao', texto: 'Velas, âncora, cordas e leme. Conta para o efetivo de navegação.' },
    { id: 'artilheiro', nome: 'Artilheiro', grupo: 'combate', texto: 'Opera um canhão.' },
    { id: 'combatente', nome: 'Combatente', grupo: 'combate', texto: 'Batalhas diretas.' },
    { id: 'homem-das-armas', nome: 'Homem das Armas', grupo: 'combate', texto: 'Atirador principal: +3 nas jogadas de ataque dos canhões do navio.' },
    { id: 'cozinheiro', nome: 'Cozinheiro', grupo: 'manutencao', texto: 'Alimenta até 50 tripulantes (exige a Cozinha).' },
    { id: 'cozinheiro-ajudante', nome: 'Cozinheiro Ajudante', grupo: 'manutencao', texto: 'Alimenta mais 25 tripulantes.' },
    { id: 'criado-de-bordo', nome: 'Criado-de-Bordo', grupo: 'manutencao', texto: 'Limpeza e trabalhos braçais. Conta para o efetivo de limpeza.' },
    { id: 'mecanico', nome: 'Mecânico', grupo: 'manutencao', texto: 'Mantém engrenagens e mecanismos.' },
    { id: 'mestre-do-navio', nome: 'Mestre do Navio', grupo: 'manutencao', texto: 'Gerencia uma função do navio e fiscaliza os novatos.' },
    { id: 'monitor', nome: 'Monitor', grupo: 'manutencao', texto: 'Supervisiona a vigilância. Conta para o efetivo de vigilância.' },
    { id: 'rapaz-da-polvora', nome: 'Rapaz da Pólvora', grupo: 'manutencao', texto: 'Mantém os canhões e os estoques de pólvora.' },
    { id: 'sentinela', nome: 'Sentinela', grupo: 'manutencao', texto: 'Vigia do navio. Conta para o efetivo de vigilância.' },
];
export const MAX_FUNCOES = 3;

/** O que acontece sem o efetivo (13.3 e 13.4): texto para a ficha. */
export const CONSEQUENCIAS: Record<string, { semMinimo: string; semNecessario: string }> = {
    navegacao: {
        semMinimo: 'O navio não pode navegar.',
        semNecessario: 'Testes de navegação com desvantagem e sem manobras.',
    },
    limpeza: {
        semMinimo: 'A cada 4 dias, Salvaguarda de Constituição CD 18 ou "Doente"; mover-se no navio custa 1,5 m a mais por 1,5 m.',
        semNecessario: 'Mover-se no navio custa 1,5 m a mais por 1,5 m.',
    },
    vigilancia: {
        semMinimo: 'Infiltrações podem levar todo o tesouro; ataques-surpresa frequentes.',
        semNecessario: 'Ataque-surpresa na falha de Vontade (Percepção) CD 18, a cada duas noites.',
    },
    artilharia: {
        semMinimo: 'Canhão sem artilheiro não ataca.',
        semNecessario: 'Canhão sem rapaz da pólvora não ataca em 2 turnos seguidos.',
    },
    alimentacao: {
        semMinimo: 'Quem não foi alimentado sofre a falta de comida (Cap. 11).',
        semNecessario: '',
    },
};

/** Profissões cujos traços mexem no navio (o tripulante precisa estar ligado a um personagem com a profissão). */
export const PROFISSOES_DO_NAVIO = {
    /** Trabalho em Madeira: −40% nos custos de construção e adicionais; Conserto em Madeira. */
    carpinteiro: { desconto: 40, nos: 12, cr: 3 },
    /** Condução: efetivo mínimo de navegação −10; com o carpinteiro, obra na metade do tempo; ignora a redução de velocidade por dano. */
    timoneiro: { efetivoMinimo: 10 },
};

export const BATERIAS_DO_GERADOR = 3;
/** Klabautermann: PV recuperados ao fim de cada dia, mais o mesmo valor por tamanho acima de Pequeno. */
export const AUTO_REPARO = 50;
/** Dias entre as cobranças das despesas dos cômodos. */
export const DIAS_DA_MANUTENCAO = 7;

/** Modelo pronto do livro (14.6): o mestre cria o navio já montado, com os cômodos vazios. */
export interface Modelo {
    id: string;
    nome: string;
    tamanho: TamanhoId;
    preco: number | null;
    madeira: string;
    fortificacao: string | null;
    leme: string;
    ancora: string;
    mastros: string[];
    motores: string[];
    canhoes: string[];
    /** Lotação diferente da do tamanho (navios da Marinha). */
    lotacao?: number;
    /** Cômodos que o modelo já traz (a Sala das Máquinas de quem tem motor). */
    comodos?: string[];
    texto: string;
}
const vezes = (tipo: string, n: number): string[] => Array.from({ length: n }, () => tipo);
export const MODELOS: Modelo[] = [
    {
        id: 'pequeno',
        nome: 'Navio Pequeno',
        tamanho: 'pequeno',
        preco: 10_000_000,
        madeira: 'cedro',
        fortificacao: null,
        leme: 'tora',
        ancora: 'normal',
        mastros: vezes('composto', 1),
        motores: [],
        canhoes: vezes('comum', 1),
        texto: 'Cedro, 1 mastro composto, 1 canhão comum.',
    },
    {
        id: 'medio',
        nome: 'Navio Médio',
        tamanho: 'medio',
        preco: 30_000_000,
        madeira: 'carvalho',
        fortificacao: null,
        leme: 'tora',
        ancora: 'normal',
        mastros: vezes('composto', 2),
        motores: [],
        canhoes: vezes('comum', 3),
        texto: 'Carvalho, 2 mastros compostos, 3 canhões comuns.',
    },
    {
        id: 'grande',
        nome: 'Navio Grande',
        tamanho: 'grande',
        preco: 100_000_000,
        madeira: 'cerejeira',
        fortificacao: null,
        leme: 'circular',
        ancora: 'normal',
        mastros: vezes('multiplo', 2),
        motores: [],
        canhoes: vezes('aprimorado', 5),
        texto: 'Cerejeira, 2 mastros múltiplos, 5 canhões aprimorados.',
    },
    {
        id: 'enorme',
        nome: 'Navio Enorme',
        tamanho: 'enorme',
        preco: 150_000_000,
        madeira: 'cerejeira',
        fortificacao: null,
        leme: 'circular',
        ancora: 'robusta',
        mastros: vezes('multiplo', 3),
        motores: ['vapor'],
        canhoes: vezes('aprimorado', 8),
        comodos: ['sala-maquinas'],
        texto: 'Cerejeira, 3 mastros múltiplos, motor a vapor, 8 canhões aprimorados.',
    },
    {
        id: 'colossal',
        nome: 'Navio Colossal',
        tamanho: 'colossal',
        preco: 200_000_000,
        madeira: 'cerejeira',
        fortificacao: 'aco',
        leme: 'circular',
        ancora: 'robusta',
        mastros: vezes('multiplo', 3),
        motores: ['combustao'],
        canhoes: vezes('aprimorado', 12),
        comodos: ['sala-maquinas'],
        texto: 'Cerejeira com aço, 3 mastros múltiplos, motor de combustão, 12 canhões aprimorados.',
    },
    {
        id: 'marinha-padrao',
        nome: 'Marinha: Navio Padrão (Grande)',
        tamanho: 'grande',
        preco: null,
        madeira: 'cerejeira',
        fortificacao: 'aco-temperado',
        leme: 'circular',
        ancora: 'normal',
        mastros: vezes('multiplo', 2),
        motores: ['combustao'],
        canhoes: vezes('aprimorado', 15),
        comodos: ['sala-maquinas'],
        texto: 'A maior parte da frota da Marinha: transporte, missões pacíficas e combate.',
    },
    {
        id: 'marinha-batedor',
        nome: 'Marinha: Navio Batedor (Médio)',
        tamanho: 'medio',
        preco: null,
        madeira: 'cerejeira',
        fortificacao: null,
        leme: 'circular',
        ancora: 'normal',
        mastros: vezes('multiplo', 2),
        motores: ['combustao'],
        canhoes: vezes('aprimorado', 10),
        lotacao: 30,
        comodos: ['sala-maquinas'],
        texto: 'Menor e mais veloz: patrulha e reconhecimento.',
    },
    {
        id: 'marinha-prisao',
        nome: 'Marinha: Navio Prisão (Enorme)',
        tamanho: 'enorme',
        preco: null,
        madeira: 'cerejeira',
        fortificacao: 'aco-temperado',
        leme: 'circular',
        ancora: 'robusta',
        mastros: vezes('multiplo', 3),
        motores: ['combustao'],
        canhoes: [...vezes('aprimorado', 10), ...vezes('superior', 15)],
        lotacao: 800,
        comodos: ['sala-maquinas'],
        texto: 'Transporte e contenção de criminosos perigosos.',
    },
    {
        id: 'marinha-batalha',
        nome: 'Marinha: Navio de Batalha (Colossal)',
        tamanho: 'colossal',
        preco: null,
        madeira: 'cerejeira',
        fortificacao: 'aco-temperado',
        leme: 'circular',
        ancora: 'robusta',
        mastros: vezes('multiplo', 3),
        motores: ['combustao'],
        canhoes: [...vezes('aprimorado', 40), ...vezes('superior', 10), ...vezes('longo', 10)],
        lotacao: 1000,
        comodos: ['sala-maquinas', 'sala-maquinas'],
        texto: 'Convocado dos Quartéis-Generais para grandes ofensivas e Buster Calls.',
    },
];

/** O que o servidor espelha (`app/Sistemas/OnePiece/dados/navios.json`): só números e ids, sem os textos. */
export const DADOS_DOS_NAVIOS = {
    tamanhos: TAMANHOS.map((t) => sem(t, 'dimensao', 'nome')),
    madeiras: MADEIRAS.map((m) => sem(m, 'nome')),
    fortificacoes: FORTIFICACOES.map((f) => sem(f, 'nome')),
    kairoseki: KAIROSEKI,
    ancoras: ANCORAS.map(semTexto),
    lemes: LEMES.map(semTexto),
    mastros: MASTROS.map(semTexto),
    motores: MOTORES.map(semTexto),
    motoresSobDemanda: MOTORES_SOB_DEMANDA,
    motoresComSala: MOTORES_COM_SALA,
    canhoes: CANHOES.map(({ id, preco, custo, dias, ordemMinima }) => ({
        id,
        preco,
        custo,
        dias,
        ordemMinima: ordemMinima ?? null,
        ordemMaxima: null,
        nos: null,
    })),
    comodos: COMODOS.map(({ id, custo, dias, despesa, espacos, unico }) => ({ id, custo, dias, despesa, espacos, unico: !!unico })),
    condicoes: CONDICOES_DO_NAVIO.map((c) => sem(c, 'nome')),
    velocidadeMinimaPorDano: VELOCIDADE_MINIMA_POR_DANO,
    funcoes: FUNCOES.map(({ id, grupo }) => ({ id, grupo })),
    maxFuncoes: MAX_FUNCOES,
    profissoes: PROFISSOES_DO_NAVIO,
    bateriasDoGerador: BATERIAS_DO_GERADOR,
    autoReparo: AUTO_REPARO,
    diasDaManutencao: DIAS_DA_MANUTENCAO,
    modelos: MODELOS.map((m) => ({ ...sem(m, 'nome', 'texto'), lotacao: m.lotacao ?? null, comodos: m.comodos ?? [] })),
};

/** O objeto sem as chaves dadas (os textos ficam só no TS). */
function sem<T extends object, K extends keyof T>(objeto: T, ...chaves: K[]): Omit<T, K> {
    const copia = { ...objeto };
    for (const k of chaves) delete copia[k];

    return copia;
}

function semTexto(p: Peca) {
    return {
        id: p.id,
        preco: p.preco,
        custo: p.custo,
        dias: p.dias,
        nos: p.nos ?? null,
        ordemMinima: p.ordemMinima ?? null,
        ordemMaxima: p.ordemMaxima ?? null,
    };
}
