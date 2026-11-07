/**
 * Economia de ações no combate: pode gastar esta categoria agora? Espelha `CombateService::gastar` (o servidor é quem
 * decide; a tela usa isto só para ligar/desligar botões e explicar o motivo). Arquivo PURO.
 */
import { emCurso, itemAtual, type Combate } from './estado.ts';

/** Categoria de ação declarada pelo sistema (`SistemaDeCombate::categoriasDeAcao`). */
export interface CategoriaAcao {
    id: string;
    nome: string;
    /** Limite por turno de quem age (null = sem limite). */
    porTurno: number | null;
    /** Limite por rodada (reação). */
    porRodada: number | null;
    /** Só quem está no turno pode usar (false = qualquer um, ex.: reação). */
    soNoTurno: boolean;
    soTecnicas?: boolean;
}

export interface Avaliacao {
    ok: boolean;
    motivo?: string;
}

/** Quantas vezes o personagem já usou a categoria (no turno, ou na rodada para reação). */
export function usos(c: Combate, personagemId: number | null, categoria: string): number {
    return c.itens.find((i) => i.personagem_id === personagemId)?.acoes[categoria] ?? 0;
}

/**
 * O personagem pode gastar uma ação de `categoria` agora? Fora do combate em curso, com o personagem fora do encontro ou
 * categoria desconhecida: sim. O mestre: sempre. Senão: tem de ser o turno dele (se a categoria é `soNoTurno`), a categoria
 * `soTecnicas` pede técnica e o limite por turno/rodada não pode ter acabado.
 */
export function avaliarAcao(
    c: Combate,
    categorias: CategoriaAcao[],
    personagemId: number | null,
    categoria: string | undefined,
    mestre: boolean,
    tecnica = false,
): Avaliacao {
    if (!categoria || !emCurso(c) || mestre) return { ok: true };
    const cfg = categorias.find((x) => x.id === categoria);
    const item = c.itens.find((i) => i.personagem_id === personagemId);
    if (!cfg || !item) return { ok: true };
    const usado = item.acoes[categoria] ?? 0;
    if (cfg.soNoTurno && itemAtual(c)?.id !== item.id) return { ok: false, motivo: 'Não é o seu turno: fora dele só dá para usar reações.' };
    if (cfg.soTecnicas && !tecnica) return { ok: false, motivo: `${cfg.nome} só serve para técnicas.` };
    if (cfg.porTurno !== null && usado >= cfg.porTurno) return { ok: false, motivo: `Você já usou sua ${cfg.nome} neste turno.` };
    if (cfg.porRodada !== null && usado >= cfg.porRodada) return { ok: false, motivo: `Você já usou sua ${cfg.nome} nesta rodada.` };

    return { ok: true };
}

/** O nome da categoria para mostrar (`padrao` → "Ação"). */
export const rotuloDaAcao = (categorias: CategoriaAcao[], id: string | undefined): string => categorias.find((c) => c.id === id)?.nome ?? '';

export interface AvaliacaoDeAtaque extends Avaliacao {
    /** Ataques feitos neste turno com a Ação "Atacar". */
    feitos: number;
    /** O limite de ataques do turno: os da Ação (Ataque Extra e afins) mais os extras do turno. */
    max: number;
    extras: number;
}

/**
 * Pode atacar com uma arma agora? O 1º ataque gasta a Ação; os seguintes valem até `ataquesPorAcao` (+ extras do turno) sem gastar outra.
 * Espelha `CombateService::gastar` com `ataquesPorAcao`. Fora do combate em curso (ou para o mestre) nada é limitado.
 */
export function avaliarAtaque(
    c: Combate,
    categorias: CategoriaAcao[],
    personagemId: number | null,
    mestre: boolean,
    ataquesPorAcao: number,
): AvaliacaoDeAtaque {
    const item = c.itens.find((i) => i.personagem_id === personagemId);
    const feitos = item?.acoes.ataques ?? 0;
    const extras = item?.acoes.extras ?? 0;
    const max = Math.max(1, ataquesPorAcao) + extras;
    const base = { feitos, max, extras };
    if (!emCurso(c) || !item || mestre) return { ok: true, ...base };
    if (itemAtual(c)?.id !== item.id) return { ok: false, motivo: 'Não é o seu turno: fora dele só dá para usar reações.', ...base };
    if (feitos > 0) {
        return feitos < max
            ? { ok: true, ...base }
            : { ok: false, motivo: `Você já fez seus ${max} ataque${max > 1 ? 's' : ''} neste turno.`, ...base };
    }

    return { ...avaliarAcao(c, categorias, personagemId, 'padrao', mestre), ...base };
}
