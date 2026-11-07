/**
 * Área de uma Técnica no mapa: a forma lida do alcance ("Até 18 m, Cone", "Arma, Esfera"), o tamanho em metros e quem está dentro.
 * A origem é sempre quem usa a Técnica; o cursor dá a direção (cone, linha) e, quando o alcance é "Arma" (varia com a arma), também o
 * tamanho. Arquivo PURO (sem Vue nem Pixi): o Node o executa direto nos testes.
 */
import { lerAlcance, type FormaDaTecnica } from './itens/forja.ts';

export type FormaDeArea = FormaDaTecnica;

/** Largura da Linha (m): um quadrado. */
export const LARGURA_DA_LINHA = 1.5;
/** O Cone abre como o D&D: na ponta, a largura é igual ao comprimento (meio ângulo de ~26,57°). */
export const MEIO_ANGULO_DO_CONE = Math.atan(0.5);

export interface AreaDaTecnica {
    forma: FormaDeArea;
    /** Tamanho fixo em metros (raio, comprimento); `null` = alcance da arma, que o cursor define. */
    metros: number | null;
}

/** A área da Técnica pelo texto do alcance; `null` se ele não descreve uma forma (Pessoal, Toque...). */
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

export interface Ponto {
    x: number;
    y: number;
}

/** A forma já com o tamanho (m): o cursor decide o que o alcance da arma deixou em aberto; fixo, só dá a direção. */
export function areaMedida(
    area: AreaDaTecnica,
    origem: Ponto,
    cursor: Ponto,
    metrosPorPx: number,
): { forma: FormaDeArea; metros: number; angulo: number } {
    const dx = cursor.x - origem.x;
    const dy = cursor.y - origem.y;

    return { forma: area.forma, metros: area.metros ?? Math.hypot(dx, dy) * metrosPorPx, angulo: Math.atan2(dy, dx) };
}

/** Um token (centro e meia largura, em pixels do mundo). */
export interface TokenNoMapa {
    id: number;
    x: number;
    y: number;
    raio: number;
}

/**
 * Os tokens que a área atinge: o token conta se alguma parte dele entra (o centro mais o raio do token). Quem usa a Técnica
 * (`origemId`) fica de fora. `medida.metros` em metros; `metrosPorPx` converte o mapa.
 */
export function tokensNaArea(
    medida: { forma: FormaDeArea; metros: number; angulo: number },
    origem: Ponto,
    tokens: TokenNoMapa[],
    metrosPorPx: number,
    origemId: number | null = null,
): number[] {
    return tokens
        .filter((t) => t.id !== origemId)
        .filter((t) => {
            const dx = (t.x - origem.x) * metrosPorPx;
            const dy = (t.y - origem.y) * metrosPorPx;
            const raio = t.raio * metrosPorPx;
            const distancia = Math.hypot(dx, dy);
            if (medida.forma === 'esfera') return distancia <= medida.metros + raio;
            // eixo da forma: along = quanto avança na direção do cursor; across = quanto se afasta dela
            const c = Math.cos(medida.angulo);
            const s = Math.sin(medida.angulo);
            const along = dx * c + dy * s;
            const across = Math.abs(-dx * s + dy * c);
            if (medida.forma === 'linha') return along >= -raio && along <= medida.metros + raio && across <= LARGURA_DA_LINHA / 2 + raio;
            // cone: dentro do comprimento e do ângulo (a margem do raio do token deixa passar quem está na borda)
            return along >= -raio && distancia <= medida.metros + raio && across <= Math.max(0, along) * Math.tan(MEIO_ANGULO_DO_CONE) + raio;
        })
        .map((t) => t.id);
}
