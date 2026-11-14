/**
 * Geometria da visão, da luz e das paredes: sem Pixi nem DOM, só números, para rodar rápido no navegador de cada jogador e ser testada.
 * Espelha `app/Nucleo/Cena/Paredes.php` (o servidor tem a palavra final sobre o movimento).
 */

export interface Segmento {
    ax: number;
    ay: number;
    bx: number;
    by: number;
}

export interface Retangulo {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}

export type CanalDeBloqueio = 'movimento' | 'visao' | 'luz';

/** Objeto mínimo de parede (o `ObjetoDto` serve): pontos absolutos [ax, ay, bx, by], o tipo, se está aberta e o que bloqueia. */
export interface ParedeLike {
    tipo: string;
    dados: {
        pontos?: number[];
        tipo?: string;
        aberta?: boolean;
        bloqueio?: Partial<Record<CanalDeBloqueio, boolean>>;
    } | null;
}

/** O que cada tipo bloqueia sem configuração: a janela é vidro (barra o corpo, não a visão nem a luz). */
export const BLOQUEIO_PADRAO: Record<string, Record<CanalDeBloqueio, boolean>> = {
    parede: { movimento: true, visao: true, luz: true },
    porta: { movimento: true, visao: true, luz: true },
    janela: { movimento: true, visao: false, luz: false },
    // etérea: barra o corpo mas não a vista nem a luz (fosso, precipício); ilusória: barra a vista e a luz mas não o corpo (fumaça densa)
    etereo: { movimento: true, visao: false, luz: false },
    ilusoria: { movimento: false, visao: true, luz: true },
};

/** Esta parede (porta, janela) barra o canal agora? Porta e janela abertas deixam tudo passar. */
export function bloqueia(o: ParedeLike, canal: CanalDeBloqueio): boolean {
    const tipo = o.dados?.tipo ?? 'parede';
    if ((tipo === 'porta' || tipo === 'janela') && o.dados?.aberta) return false;

    return o.dados?.bloqueio?.[canal] ?? BLOQUEIO_PADRAO[tipo]?.[canal] ?? true;
}

/** Segmentos das paredes que barram o canal (movimento, visão ou luz). */
export function segmentosQueBloqueiam(objetos: ParedeLike[], canal: CanalDeBloqueio): Segmento[] {
    const segs: Segmento[] = [];
    for (const o of objetos) {
        if (o.tipo !== 'parede') continue;
        const p = o.dados?.pontos;
        if (!p || p.length !== 4 || !bloqueia(o, canal)) continue;
        segs.push({ ax: p[0], ay: p[1], bx: p[2], by: p[3] });
    }

    return segs;
}

const EPS = 1e-4;
const DOIS_PI = Math.PI * 2;

/** Ângulo normalizado para (-π, π]. */
const normalizar = (a: number) => {
    const r = ((((a + Math.PI) % DOIS_PI) + DOIS_PI) % DOIS_PI) - Math.PI;

    return r === -Math.PI ? Math.PI : r;
};

export interface Cone {
    /** Direção central, em radianos. */
    direcao: number;
    /** Abertura total, em radianos (< 2π). */
    abertura: number;
}

/**
 * Polígono (lista plana x,y,x,y...) da região visível a partir de `origem`, por varredura de raios. `raio` limita a um quadrado ao redor
 * (null = até os `limites`); `cone` restringe a um setor (lanterna). Paredes que cruzam a origem não a prendem: o raio para na primeira
 * que encontrar adiante.
 */
export function poligonoDeVisao(
    origem: { x: number; y: number },
    paredes: Segmento[],
    limites: Retangulo,
    raio: number | null = null,
    cone: Cone | null = null,
): number[] {
    const caixa: Retangulo =
        raio === null
            ? limites
            : {
                  x0: Math.max(limites.x0, origem.x - raio),
                  y0: Math.max(limites.y0, origem.y - raio),
                  x1: Math.min(limites.x1, origem.x + raio),
                  y1: Math.min(limites.y1, origem.y + raio),
              };
    const segs: Segmento[] = paredes.filter(
        (s) =>
            Math.max(s.ax, s.bx) >= caixa.x0 &&
            Math.min(s.ax, s.bx) <= caixa.x1 &&
            Math.max(s.ay, s.by) >= caixa.y0 &&
            Math.min(s.ay, s.by) <= caixa.y1,
    );
    segs.push(
        { ax: caixa.x0, ay: caixa.y0, bx: caixa.x1, by: caixa.y0 },
        { ax: caixa.x1, ay: caixa.y0, bx: caixa.x1, by: caixa.y1 },
        { ax: caixa.x1, ay: caixa.y1, bx: caixa.x0, by: caixa.y1 },
        { ax: caixa.x0, ay: caixa.y1, bx: caixa.x0, by: caixa.y0 },
    );

    // Ângulos relativos à direção do cone (ou a 0): assim o setor é um intervalo simples e a ordenação não dá a volta.
    const base = cone ? cone.direcao : 0;
    const meia = cone ? cone.abertura / 2 : Math.PI;
    const angulos: number[] = [];
    const adicionar = (a: number) => {
        const d = normalizar(a - base);
        if (!cone || Math.abs(d) <= meia + 1e-9) angulos.push(d);
    };
    for (const s of segs) {
        for (const [x, y] of [
            [s.ax, s.ay],
            [s.bx, s.by],
        ]) {
            const a = Math.atan2(y - origem.y, x - origem.x);
            adicionar(a - EPS);
            adicionar(a);
            adicionar(a + EPS);
        }
    }
    if (cone) {
        angulos.push(-meia, meia);
    }
    angulos.sort((p, q) => p - q);

    const pontos: number[] = cone ? [origem.x, origem.y] : [];
    for (const d of angulos) {
        const a = d + base;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        let melhor = Infinity;
        for (const s of segs) {
            const sx = s.bx - s.ax;
            const sy = s.by - s.ay;
            const den = dx * sy - dy * sx;
            if (Math.abs(den) < 1e-12) continue;
            const px = s.ax - origem.x;
            const py = s.ay - origem.y;
            const t = (px * sy - py * sx) / den;
            const u = (px * dy - py * dx) / den;
            if (t >= 0 && u >= -1e-9 && u <= 1 + 1e-9 && t < melhor) melhor = t;
        }
        if (melhor === Infinity) continue;
        pontos.push(origem.x + dx * melhor, origem.y + dy * melhor);
    }

    return pontos;
}

/** O ponto está dentro do polígono (lista plana)? */
export function pontoNoPoligono(x: number, y: number, poligono: number[]): boolean {
    let dentro = false;
    for (let i = 0, j = poligono.length - 2; i < poligono.length; j = i, i += 2) {
        const xi = poligono[i];
        const yi = poligono[i + 1];
        const xj = poligono[j];
        const yj = poligono[j + 1];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
    }

    return dentro;
}

function cruza(x0: number, y0: number, x1: number, y1: number, s: Segmento): boolean {
    const rx = x1 - x0;
    const ry = y1 - y0;
    const sx = s.bx - s.ax;
    const sy = s.by - s.ay;
    const den = rx * sy - ry * sx;
    if (Math.abs(den) < 1e-12) return false;
    const t = ((s.ax - x0) * sy - (s.ay - y0) * sx) / den;
    const u = ((s.ax - x0) * ry - (s.ay - y0) * rx) / den;

    return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}

/** O caminho reto de (x0,y0) a (x1,y1) não cruza nenhuma das paredes? */
export function caminhoLivre(paredes: Segmento[], x0: number, y0: number, x1: number, y1: number): boolean {
    if (x0 === x1 && y0 === y1) return true;

    return !paredes.some((s) => cruza(x0, y0, x1, y1, s));
}

/**
 * O ponto mais longe do destino (de volta até a origem) que o token alcança sem cruzar parede. `encaixar` ajusta o ponto à grade; só vale
 * se o caminho até ele continuar livre. Sem parede no caminho, devolve o próprio destino.
 */
export function pontoAlcancavel(
    paredes: Segmento[],
    de: { x: number; y: number },
    para: { x: number; y: number },
    encaixar: (p: { x: number; y: number }) => { x: number; y: number },
): { x: number; y: number } {
    if (caminhoLivre(paredes, de.x, de.y, para.x, para.y)) return para;
    for (let t = 0.95; t > 0; t -= 0.05) {
        const livre = { x: de.x + (para.x - de.x) * t, y: de.y + (para.y - de.y) * t };
        for (const p of [encaixar(livre), livre]) {
            if (caminhoLivre(paredes, de.x, de.y, p.x, p.y)) return p;
        }
    }

    return de;
}
