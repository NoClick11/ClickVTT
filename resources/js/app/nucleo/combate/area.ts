/**
 * Área de efeito no mapa (esfera, cone, linha): o tamanho que o cursor define e quais tokens ela atinge. A origem é quem usa a
 * Técnica; o cursor dá a direção (cone, linha) e, quando o alcance varia (arma), também o tamanho. Arquivo PURO (sem Vue nem Pixi):
 * o Node o executa direto nos testes e o mapa só desenha.
 */
export type FormaDeArea = 'linha' | 'cone' | 'esfera';

/** Largura da Linha (m): um quadrado. */
export const LARGURA_DA_LINHA = 1.5;
/** O Cone abre como no D&D: na ponta, a largura é igual ao comprimento (meio ângulo de ~26,57°). */
export const MEIO_ANGULO_DO_CONE = Math.atan(0.5);

export interface AreaDeEfeito {
    forma: FormaDeArea;
    /** Tamanho fixo em metros (raio, comprimento); `null` = o cursor define (alcance da arma). */
    metros: number | null;
    /** Com `metros: null`: o tamanho máximo que o cursor pode dar (o alcance da arma). */
    maximo?: number | null;
    /** A área não pode ser marcada (ex.: sem arma equipada, ou arma sem alcance): o motivo para avisar o jogador. */
    bloqueio?: string;
}

export interface Ponto {
    x: number;
    y: number;
}

/** A forma já com o tamanho (m): o cursor decide o que o alcance da arma deixou em aberto; fixo, só dá a direção. */
export function areaMedida(
    area: AreaDeEfeito,
    origem: Ponto,
    cursor: Ponto,
    metrosPorPx: number,
): { forma: FormaDeArea; metros: number; angulo: number } {
    const dx = cursor.x - origem.x;
    const dy = cursor.y - origem.y;

    const doCursor = Math.hypot(dx, dy) * metrosPorPx;

    // o cursor define o tamanho (alcance da arma), nunca além do máximo da Técnica
    return { forma: area.forma, metros: area.metros ?? Math.min(doCursor, area.maximo ?? Infinity), angulo: Math.atan2(dy, dx) };
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
            return (
                along >= -raio &&
                distancia <= medida.metros + raio &&
                across <= Math.max(0, along) * Math.tan(MEIO_ANGULO_DO_CONE) + raio / Math.cos(MEIO_ANGULO_DO_CONE)
            );
        })
        .map((t) => t.id);
}

/** O desenho da área no mapa (em pixels do mundo): um círculo, um setor (cone) ou um polígono (linha). */
export type DesenhoDaArea =
    | { tipo: 'circulo'; x: number; y: number; r: number }
    | { tipo: 'setor'; x: number; y: number; r: number; de: number; ate: number }
    | { tipo: 'poligono'; pontos: number[] };

/**
 * O contorno que o mapa desenha: o MESMO que `tokensNaArea` usa para contar, ou seja, a forma alargada pelo raio de um token
 * (`raioPx`). Assim a borda toca onde um token começa a ser atingido: a esfera de 1,5 m cobre os quadrados vizinhos por inteiro, e não
 * só até a metade deles. A origem é o centro de quem usa a Técnica.
 */
export function desenhoDaArea(
    medida: { forma: FormaDeArea; metros: number; angulo: number },
    origem: Ponto,
    raioPx: number,
    metrosPorPx: number,
): DesenhoDaArea {
    const comprimento = medida.metros / metrosPorPx;
    const c = Math.cos(medida.angulo);
    const sn = Math.sin(medida.angulo);
    if (medida.forma === 'esfera') return { tipo: 'circulo', x: origem.x, y: origem.y, r: comprimento + raioPx };
    if (medida.forma === 'cone') {
        // as bordas do cone ficam `raioPx` mais afastadas: o vértice recua raio / sen(meio ângulo) e o raio cresce o mesmo tanto
        const recuo = raioPx / Math.sin(MEIO_ANGULO_DO_CONE);

        return {
            tipo: 'setor',
            x: origem.x - c * recuo,
            y: origem.y - sn * recuo,
            r: comprimento + raioPx + recuo,
            de: medida.angulo - MEIO_ANGULO_DO_CONE,
            ate: medida.angulo + MEIO_ANGULO_DO_CONE,
        };
    }
    const meia = LARGURA_DA_LINHA / metrosPorPx / 2 + raioPx;
    const de = -raioPx;
    const ate = comprimento + raioPx;
    const ponto = (along: number, lado: number) => [origem.x + c * along - sn * lado, origem.y + sn * along + c * lado];

    return { tipo: 'poligono', pontos: [...ponto(de, -meia), ...ponto(ate, -meia), ...ponto(ate, meia), ...ponto(de, meia)] };
}
