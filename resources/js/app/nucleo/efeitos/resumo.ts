/** Texto curto de um efeito, para listas e etiquetas (ex.: `ca +1`, `ca = 14+min(@mod.des,2)`). Puro. */
import type { EfeitoBruto } from './efeitos.ts';

export function resumoEfeito(e: EfeitoBruto): string {
    const v = e.valor ?? '';
    switch (e.modo) {
        case 'soma':
            return typeof v === 'number' ? `${e.alvo} ${v >= 0 ? '+' : '−'}${Math.abs(v)}` : `${e.alvo} +${v}`;
        case 'base':
            return `${e.alvo} = ${v}`;
        case 'min':
            return `${e.alvo} ≥ ${v}`;
        case 'max':
            return `${e.alvo} ≤ ${v}`;
        case 'vantagem':
            return `vantagem em ${e.alvo}`;
        case 'desvantagem':
            return `desvantagem em ${e.alvo}`;
    }
}
