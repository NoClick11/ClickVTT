import type { EfeitoBruto } from './nucleo/efeitos/efeitos';
import type { DadosRolagem } from './nucleo/rolagem';

/** Atalhos de dado do painel de rolagem; a rolagem em si aceita qualquer expressão (`2d20kh1+5`). */
export type Dado = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
export const DADOS: Dado[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

/** todos = chat aberto; mestre = autor + mestre (para o mestre, só ele); secreto = só o mestre vê o resultado. */
export type VisibilidadeRolagem = 'todos' | 'mestre' | 'secreto';

export interface Mensagem {
    id: number;
    tipo: 'texto' | 'rolagem';
    /** `secreto_oculto` = aviso mostrado aos jogadores quando o mestre rola em segredo. */
    visibilidade: VisibilidadeRolagem | 'secreto_oculto';
    /** `id` = JOGADOR que enviou; nome/cor = do personagem quando falou como ele. */
    autor: { id: number; personagem_id: number | null; nome: string; cor: string } | null;
    texto: string | null;
    dados: DadosRolagem | null;
    criada_em: string | null;
}

export interface ItemTurno {
    id: string;
    nome: string;
    iniciativa: number | null;
    cor: string | null;
    personagem_id: number | null;
}

/** Turnos/iniciativa: por enquanto só visual (o mestre controla, todos veem). */
export interface Combate {
    ativo: boolean;
    rodada: number;
    atual: string | null;
    itens: ItemTurno[];
}

/** Item da mesa (só o mestre cria/edita). `dados` = o que só o sistema entende; `efeitos` = buffs do núcleo. */
export interface ItemDto {
    id: number;
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
