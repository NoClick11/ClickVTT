/**
 * Estado do combate (turnos) e regras PURAS que a tela usa. O servidor é quem decide (`CombateService`); aqui só se lê o
 * estado que ele manda, para mostrar quem age e liberar ou travar os botões. Arquivo PURO (o Node o executa nos testes).
 */

export type FaseCombate = 'inativo' | 'iniciativa' | 'em_curso';
export type Disposicao = 'jogadores' | 'aliado' | 'inimigo';

/** Quem participa do combate. A lista de itens está NA ORDEM DOS TURNOS. */
export interface ItemTurno {
    id: string;
    nome: string;
    cor: string | null;
    personagem_id: number | null;
    objeto_id: number | null;
    disposicao: Disposicao;
    iniciativa: number | null;
    /** Quantas vezes cada categoria de ação foi usada (o sistema define as categorias e os limites). */
    acoes: Record<string, number>;
    /** Deslocamento do turno em metros: o que já andou, o bônus (Disparada) e a base do sistema (null = sem limite medido). */
    movimento: { usado: number; bonus: number; base: number | null };
}

/** Uma Técnica com duração em andamento (Quick Draw...): ver `TecnicasAtivas` no servidor. */
export interface TecnicaAtiva {
    id: string;
    personagem_id: number;
    nome: string;
    /** Rodadas que faltam. */
    rodadas: number;
    concentracao: boolean;
    /** Alcance em metros. */
    alcance: number;
    /** Vigília (Overwatch): uma esfera no mapa; o centro em pixels, o raio em metros. */
    tipo?: 'vigia';
    zona?: { pagina_id: number; x: number; y: number; raio: number };
}

export interface Combate {
    ativo: boolean;
    fase: FaseCombate;
    rodada: number;
    /** `id` do item do turno atual. */
    atual: string | null;
    itens: ItemTurno[];
    ativas: TecnicaAtiva[];
}

export const combateVazio = (): Combate => ({ ativo: false, fase: 'inativo', rodada: 1, atual: null, itens: [], ativas: [] });

/** Garante todos os campos (a prop inicial pode vir de um combate salvo antes de existirem). */
export function normalizar(c: Partial<Combate> | null | undefined): Combate {
    const base = combateVazio();
    const ativo = c?.ativo ?? false;

    return {
        ativo,
        fase: ativo ? (c?.fase ?? 'em_curso') : 'inativo',
        rodada: c?.rodada ?? base.rodada,
        atual: c?.atual ?? null,
        ativas: c?.ativas ?? [],
        itens: (c?.itens ?? []).map((i) => ({
            ...i,
            objeto_id: i.objeto_id ?? null,
            personagem_id: i.personagem_id ?? null,
            disposicao: i.disposicao ?? (i.personagem_id ? 'jogadores' : 'inimigo'),
            iniciativa: i.iniciativa ?? null,
            acoes: i.acoes ?? {},
            movimento: { usado: i.movimento?.usado ?? 0, bonus: i.movimento?.bonus ?? 0, base: i.movimento?.base ?? null },
        })),
    };
}

export const emCurso = (c: Combate): boolean => c.fase === 'em_curso';

/** O item do turno atual (ou null). */
export const itemAtual = (c: Combate): ItemTurno | null => c.itens.find((i) => i.id === c.atual) ?? null;

/**
 * Este personagem pode se mover/agir agora? Fora do combate em curso, sempre; no combate, só quem está no turno (o mestre
 * sempre pode). Reações são a exceção e têm a própria regra (`podeReagir`).
 */
export function podeAgirAgora(c: Combate, personagemId: number | null, mestre: boolean): boolean {
    if (!emCurso(c) || mestre) return true;

    return personagemId !== null && itemAtual(c)?.personagem_id === personagemId;
}

/** Itens que o jogador controla e que ainda não rolaram a iniciativa (para o aviso na tela dele). */
export function semIniciativaDe(c: Combate, personagensDoJogador: number[]): ItemTurno[] {
    if (c.fase !== 'iniciativa') return [];

    return c.itens.filter((i) => i.iniciativa === null && i.personagem_id !== null && personagensDoJogador.includes(i.personagem_id));
}

/** A rodada para a ficha: só com o combate em curso (limites de um uso por rodada); senão, null. */
export const rodadaParaFicha = (c: Combate): number | null => (emCurso(c) ? c.rodada : null);

/** A nova ordem dos ids ao mover um item uma posição (`-1` sobe, `1` desce); sem efeito nas pontas. */
export function ordemAoMover(c: Combate, id: string, delta: -1 | 1): string[] {
    const ids = c.itens.map((i) => i.id);
    const i = ids.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= ids.length) return ids;
    [ids[i], ids[j]] = [ids[j], ids[i]];

    return ids;
}
