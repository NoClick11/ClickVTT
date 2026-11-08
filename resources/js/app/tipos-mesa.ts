import type { EfeitoBruto } from './nucleo/efeitos/efeitos';
import type { DadosRolagem } from './nucleo/rolagem';

/** Atalhos de dado do painel de rolagem; a rolagem em si aceita qualquer expressão (`2d20kh1+5`). */
export type Dado = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
export const DADOS: Dado[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

/** todos = chat aberto; mestre = autor + mestre (para o mestre, só ele); secreto = só o mestre vê o resultado. */
export type VisibilidadeRolagem = 'todos' | 'mestre' | 'secreto';

export interface Mensagem {
    id: number;
    tipo: 'texto' | 'rolagem' | 'tecnica' | 'gatilho';
    /** `secreto_oculto` = aviso mostrado aos jogadores quando o mestre rola em segredo. */
    visibilidade: VisibilidadeRolagem | 'secreto_oculto';
    /** `id` = JOGADOR que enviou; nome/cor = do personagem quando falou como ele. */
    autor: { id: number; personagem_id: number | null; nome: string; cor: string } | null;
    texto: string | null;
    dados: DadosRolagem | null;
    criada_em: string | null;
}

// O estado do combate (turnos) e as regras puras que a tela usa estão em `nucleo/combate/estado.ts`.
export type { Combate, Disposicao, FaseCombate, ItemTurno } from './nucleo/combate/estado';

/** Item da mesa (só o mestre cria/edita). `dados` = o que só o sistema entende; `efeitos` = buffs do núcleo. */
export interface ItemDto {
    id: number;
    /** Item criado por uma compra na loja (id do catálogo): fica fora da aba Itens do mestre. */
    catalogo_id?: string | null;
    nome: string;
    descricao: string | null;
    /** Peso de 1 unidade, em kg. */
    peso: number;
    equipavel: boolean;
    requer_sintonia: boolean;
    dados: Record<string, unknown> | null;
    efeitos: EfeitoBruto[];
}
/** Campos para criar um item (o servidor valida e completa o resto). */
export interface NovoItem {
    nome: string;
    descricao?: string | null;
    peso: number;
    equipavel: boolean;
    requer_sintonia: boolean;
    efeitos?: EfeitoBruto[];
    dados?: Record<string, unknown> | null;
}

/** Item que o mestre criou para o catálogo e a loja da mesa (além dos do sistema). */
export interface ItemDeCatalogoDto extends Omit<ItemDto, 'catalogo_id'> {
    categoria: string;
    raridade: string;
    /** Preço na moeda do sistema (Belly). */
    preco: number;
}
export interface NovoItemDeCatalogo extends NovoItem {
    categoria: string;
    raridade: string;
    preco: number;
}
/** Loja aberta para um jogador: as categorias à venda e o ajuste de preço (%; 100 = preço do livro). */
export interface LojaAbertaDto {
    jogador_id: number;
    categorias: string[];
    /** Raridades à venda (vazio = todas). */
    raridades: string[];
    fator: number;
}
export interface LojaDoJogadorDto extends LojaAbertaDto {
    /** Itens que o mestre criou nas categorias desta loja. */
    itens: ItemDeCatalogoDto[];
}

/** Uma arma do inventário de um personagem, para o Ferreiro aprimorar. */
export interface ArmaParaForja {
    item_id: number;
    nome: string;
    dano: string | null;
    tipoDano: string | null;
    cortante: boolean;
    forja: Record<string, unknown>;
    /** Aprimoramento do Ferreiro já feito (revestida de Kairoseki ou distâncias ampliadas): a arma não aceita outro. */
    melhoria?: 'kairoseki' | 'alcance' | null;
    distancia?: boolean;
}
/** Munição do inventário de alguém (revestir 10 com Kairoseki). */
export interface MunicaoParaForja {
    item_id: number;
    nome: string;
    qtd: number;
}

/** Diário da mesa: pastas (aninháveis) e folhetos (imagem + texto que o mestre libera aos jogadores). */
export interface DiarioPastaDto {
    id: number;
    nome: string;
    pai_id: number | null;
}
export interface FolhetoDto {
    id: number;
    nome: string;
    pasta_id: number | null;
    imagem: string;
    texto: string | null;
    /** Os jogadores o veem na lista. */
    visivel: boolean;
}
export interface DiarioDto {
    pastas: DiarioPastaDto[];
    folhetos: FolhetoDto[];
}
