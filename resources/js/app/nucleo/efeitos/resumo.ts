/**
 * Texto curto de um efeito, para listas e etiquetas. Sem formato mostra os ids (`ca +1`, `ca = 14+min(@mod.des,2)`);
 * com o formato do sistema, nomes legíveis (`Classe de Armadura +1`, `Classe de Armadura +mod. CON`). Puro.
 */
import type { EfeitoBruto } from './efeitos.ts';

/** Como o sistema escreve o alvo (id → nome) e as fórmulas (`@mod.con` → `mod. CON`). */
export interface FormatoResumo {
    alvo?: (id: string) => string;
    valor?: (formula: string) => string;
}

export function resumoEfeito(e: EfeitoBruto, formato: FormatoResumo = {}): string {
    const alvo = formato.alvo?.(e.alvo) ?? e.alvo;
    const v = typeof e.valor === 'string' ? (formato.valor?.(e.valor) ?? e.valor) : (e.valor ?? '');
    switch (e.modo) {
        case 'soma':
            return typeof v === 'number' ? `${alvo} ${v >= 0 ? '+' : '−'}${Math.abs(v)}` : `${alvo} +${v}`;
        case 'base':
            return `${alvo} = ${v}`;
        case 'min':
            return `${alvo} ≥ ${v}`;
        case 'max':
            return `${alvo} ≤ ${v}`;
        case 'dados':
            return `${alvo} +${v}`;
        case 'vantagem':
            return `Vantagem em ${alvo}`;
        case 'desvantagem':
            return `Desvantagem em ${alvo}`;
    }
}
