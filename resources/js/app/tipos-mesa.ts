export type Dado = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20' | 'd100';
export const DADOS: Dado[] = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20', 'd100'];

/** todos = chat aberto; mestre = autor + mestre (para o mestre, só ele); secreto = só o mestre vê o resultado. */
export type VisibilidadeRolagem = 'todos' | 'mestre' | 'secreto';

export interface Mensagem {
    id: number;
    tipo: 'texto' | 'rolagem';
    /** `secreto_oculto` = aviso mostrado aos jogadores quando o mestre rola em segredo. */
    visibilidade: VisibilidadeRolagem | 'secreto_oculto';
    autor: { id: number; nome: string; cor: string } | null;
    texto: string | null;
    dados: { dado: Dado; faces: number; quantidade: number; resultados: number[]; total: number } | null;
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
