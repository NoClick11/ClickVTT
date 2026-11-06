/** Validação dos efeitos antes de salvar (itens, características...), a mesma em todo editor. Pura. */
import { dadosValidos, type EfeitoBruto } from './efeitos.ts';
import { sintaxeValida } from './formula.ts';

/** Vantagem e desvantagem não têm valor; dano extra precisa de dados (`3d6`); os outros modos, de um número ou fórmula válida. */
export const efeitoValido = (e: EfeitoBruto): boolean =>
    e.modo === 'dados'
        ? dadosValidos(e.valor)
        : e.modo === 'vantagem' ||
          e.modo === 'desvantagem' ||
          (e.valor !== undefined && e.valor !== null && e.valor !== '' && (typeof e.valor === 'number' || sintaxeValida(e.valor)));

/** A fórmula usa só valores que existem neste alvo? (Senão o efeito seria ignorado em silêncio.) */
export function usaApenasVariaveisDoAlvo(e: EfeitoBruto, variaveisDe?: (alvo: string) => { id: string }[]): boolean {
    if (!variaveisDe || typeof e.valor !== 'string' || e.modo === 'dados') return true;
    const ids = new Set(variaveisDe(e.alvo).map((v) => v.id));

    return [...e.valor.toLowerCase().matchAll(/@([a-z0-9_.]+)/g)].every((m) => ids.has(m[1]));
}

/** A mensagem a mostrar ao mestre/jogador, ou null se todos os efeitos estão bons. */
export function erroDosEfeitos(efeitos: EfeitoBruto[], variaveisDe?: (alvo: string) => { id: string }[]): string | null {
    if (!efeitos.every(efeitoValido)) return 'Algum efeito tem valor ou fórmula inválidos.';
    if (!efeitos.every((e) => usaApenasVariaveisDoAlvo(e, variaveisDe)))
        return 'Alguma fórmula usa um valor que não existe no alvo do efeito (nos atributos só vale o nível).';

    return null;
}
