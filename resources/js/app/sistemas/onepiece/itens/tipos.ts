// Catálogo de itens do One Piece (cap. 8): tipos. Dados puros, sem Vue; espelhados em `app/Sistemas/OnePiece/dados/itens.json`
// (gerado por script e conferido por teste). A loja e o "adicionar à mesa" leem este catálogo.
import type { DadosItemOnePiece } from '../regras.ts';

export type Raridade = 'comum' | 'incomum' | 'raro' | 'mercado-negro';

export const RARIDADES: { id: Raridade; nome: string; descricao: string }[] = [
    { id: 'comum', nome: 'Comum', descricao: 'Facilmente encontrado para compra ou venda em praticamente qualquer vila, cidade ou reino.' },
    {
        id: 'incomum',
        nome: 'Incomum',
        descricao:
            'Mais difícil de encontrar (alto custo, função específica, manuseio complexo ou baixa demanda): em geral só em grandes cidades ou reinos.',
    },
    {
        id: 'raro',
        nome: 'Raro',
        descricao:
            'Exclusivo, extremamente caro, com distribuição limitada ou controlada; mesmo em grandes cidades pode exigir permissões especiais.',
    },
    {
        id: 'mercado-negro',
        nome: 'Mercado Negro',
        descricao:
            'Ilegal ou restrito, adquirido só por meios ilícitos e com contatos apropriados; o preço varia drasticamente (um mesmo item pode custar 100 vezes mais, conforme o vendedor ou o momento).',
    },
];

export type CategoriaId =
    | 'hospedagem'
    | 'comida-e-bebida'
    | 'ferramentas'
    | 'kits'
    | 'restricao'
    | 'armazenamento'
    | 'construcao'
    | 'exploracao'
    | 'variados'
    | 'roupas'
    | 'den-den-mushi'
    | 'navegacao'
    | 'energia'
    | 'quimicos'
    | 'gases'
    | 'alimentos'
    | 'armas-cortantes'
    | 'armas-marciais'
    | 'armas-de-fogo'
    | 'municao'
    | 'armas-especiais'
    | 'estilo-de-vida'
    | 'barcos'
    | 'montarias'
    | 'arreios'
    | 'selas';

export type GrupoDoCatalogo = 'Equipamento de aventura' | 'Armas' | 'Montarias e veículos' | 'Serviços';

export interface CategoriaDoCatalogo {
    id: CategoriaId;
    nome: string;
    grupo: GrupoDoCatalogo;
}

export const CATEGORIAS: CategoriaDoCatalogo[] = [
    { id: 'ferramentas', nome: 'Ferramentas e Livros de Profissão', grupo: 'Equipamento de aventura' },
    { id: 'kits', nome: 'Kits de Ferramentas', grupo: 'Equipamento de aventura' },
    { id: 'restricao', nome: 'Restrição e Contenção', grupo: 'Equipamento de aventura' },
    { id: 'armazenamento', nome: 'Armazenamento e Transporte', grupo: 'Equipamento de aventura' },
    { id: 'construcao', nome: 'Construção e Materiais', grupo: 'Equipamento de aventura' },
    { id: 'exploracao', nome: 'Exploração', grupo: 'Equipamento de aventura' },
    { id: 'variados', nome: 'Variados', grupo: 'Equipamento de aventura' },
    { id: 'roupas', nome: 'Roupas Especiais', grupo: 'Equipamento de aventura' },
    { id: 'den-den-mushi', nome: 'Den-Den Mushi', grupo: 'Equipamento de aventura' },
    { id: 'navegacao', nome: 'Navegação', grupo: 'Equipamento de aventura' },
    { id: 'energia', nome: 'Fontes de Energia', grupo: 'Equipamento de aventura' },
    { id: 'quimicos', nome: 'Substâncias Químicas', grupo: 'Equipamento de aventura' },
    { id: 'gases', nome: 'Gases', grupo: 'Equipamento de aventura' },
    { id: 'alimentos', nome: 'Alimentos', grupo: 'Equipamento de aventura' },
    { id: 'comida-e-bebida', nome: 'Comida, Bebida e Hospedagem', grupo: 'Equipamento de aventura' },
    { id: 'armas-cortantes', nome: 'Armas Cortantes', grupo: 'Armas' },
    { id: 'armas-marciais', nome: 'Armas Marciais', grupo: 'Armas' },
    { id: 'armas-de-fogo', nome: 'Armas de Fogo', grupo: 'Armas' },
    { id: 'municao', nome: 'Munição', grupo: 'Armas' },
    { id: 'armas-especiais', nome: 'Armas Especiais', grupo: 'Armas' },
    { id: 'barcos', nome: 'Barcos', grupo: 'Montarias e veículos' },
    { id: 'montarias', nome: 'Montarias e Outros Animais', grupo: 'Montarias e veículos' },
    { id: 'arreios', nome: 'Arreios e Veículos de Tração', grupo: 'Montarias e veículos' },
    { id: 'selas', nome: 'Selas', grupo: 'Montarias e veículos' },
    { id: 'hospedagem', nome: 'Hospedagem (diária)', grupo: 'Serviços' },
    { id: 'estilo-de-vida', nome: 'Despesas de Estilo de Vida', grupo: 'Serviços' },
];

/** `item` entra no inventário; `servico` é uma despesa (hospedagem, estilo de vida), sem peso nem inventário. */
export type TipoDeEntrada = 'item' | 'servico';

export interface DadosDeArmaDoCatalogo {
    /** Dado da arma quando é fixo (armas "de acordo com a munição" ou marciais não têm). */
    dano: string | null;
    tipoDano: string;
    /** Tipos alternativos ("Cortante ou Perfurante"). */
    tiposAlternativos?: string[];
    propriedades: string[];
    /** Alcance normal/máximo em metros (Distância ou Arremesso). */
    distancia?: [number, number];
    /** Área do disparo (escopeta, metralhadora): cone em metros. */
    cone?: number;
    /** Efeito ao obter um acerto crítico natural (só com proficiência na arma). */
    expertise?: string;
    /** Marcial: dano = dano desarmado + 1 passo. */
    marcial?: boolean;
    /** Dano segundo a munição usada. */
    porMunicao?: boolean;
}

export interface ItemDoCatalogo {
    id: string;
    nome: string;
    /** Outros nomes (Adaga/Kunai, Canhão/Bazuca...). */
    apelidos?: string[];
    categoria: CategoriaId;
    tipo: TipoDeEntrada;
    raridade: Raridade;
    /** Preço em Bellys por `unidade`; `null` quando varia (veja `precoTexto`). */
    preco: number | null;
    precoTexto?: string;
    /** O que o preço cobre: "unidade", "metro", "ração", "dia"... (padrão: o item). */
    unidade?: string;
    /** Peso de 1 unidade em kg (0 quando só há volume ou o livro não dá). */
    peso: number;
    pesoTexto?: string;
    volume?: string;
    descricao: string;
    equipavel: boolean;
    /** Arma, escudo etc.: o que o sistema calcula no item da mesa. */
    arma?: DadosDeArmaDoCatalogo;
    dados?: DadosItemOnePiece;
    /** Para a loja: pode ser comprado diretamente (falso: só pelo mestre, como a Akuma no Mi). */
    loja: boolean;
}

/** Regras de compra e venda (8.2) para a loja e para o mestre. */
export const REGRAS_DE_COMERCIO = {
    /** Armas e equipamentos em bom estado valem metade do preço original quando vendidos. */
    vendaDeEquipamentos: 0.5,
    /** Gemas, joias e obras de arte mantêm o valor de mercado. */
    vendaDeArte: 1,
    /** Akuma no Mi: quase impossível comprar ou vender (só mercado negro). */
    akumaNoMi: 'Vender ou comprar uma Akuma no Mi é extremamente difícil: só em mercados negros.',
    /** Itens do Mercado Negro podem custar até 100 vezes mais, a critério do Narrador. */
    multiplicadorMaximoDoMercadoNegro: 100,
};

/** Capacidade dos recipientes (8.3), para referência. */
export const CAPACIDADE_DE_RECIPIENTES: { recipiente: string; capacidade: string }[] = [
    { recipiente: 'Algibeira', capacidade: '3 kg de equipamentos' },
    { recipiente: 'Balde', capacidade: '12 litros' },
    { recipiente: 'Barril', capacidade: '160 litros' },
    { recipiente: 'Baú', capacidade: '150 kg de equipamentos' },
    { recipiente: 'Caneca', capacidade: '500 ml' },
    { recipiente: 'Cantil', capacidade: '2 litros' },
    { recipiente: 'Cesto', capacidade: '20 kg de equipamentos' },
    { recipiente: 'Frasco', capacidade: '120 ml' },
    { recipiente: 'Garrafa', capacidade: '750 ml' },
    { recipiente: 'Jarra', capacidade: '5 litros' },
    { recipiente: 'Mochila Pequena', capacidade: '30 kg de equipamentos' },
    { recipiente: 'Mochila Média', capacidade: '60 kg de equipamentos' },
    { recipiente: 'Mochila Grande', capacidade: '100 kg de equipamentos' },
    { recipiente: 'Saco', capacidade: '10 kg de equipamentos' },
];
