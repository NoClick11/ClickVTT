/**
 * A área de uma Técnica pelo texto do alcance ("Até 18 m, Cone", "Arma, Esfera"). "Arma" deixa o tamanho para o cursor (varia com a arma).
 * Arquivo PURO: o Node o executa direto nos testes.
 */
import type { AreaDeEfeito, FormaDeArea } from '../../nucleo/combate/area.ts';
import { lerAlcance } from './itens/forja.ts';

export type AreaDaTecnica = AreaDeEfeito;

/** A área da Técnica pelo texto do alcance; `null` se ele não descreve uma forma (Pessoal, Toque...). `acrescimo`: alcance ampliado (m). */
export function areaDoAlcance(texto: string, acrescimo = 0): AreaDaTecnica | null {
    const t = texto.toLowerCase();
    const lido = lerAlcance(texto);
    if (lido) return { forma: lido.forma, metros: lido.metros + acrescimo };
    const forma: FormaDeArea | null = /\bcone\b/.test(t)
        ? 'cone'
        : /\blinha\b/.test(t)
          ? 'linha'
          : /esfera|cilindro|emana[cç][aã]o|\braio\b/.test(t)
            ? 'esfera'
            : null;
    if (!forma) return null;

    return /\barma\b/.test(t) ? { forma, metros: null } : null;
}
