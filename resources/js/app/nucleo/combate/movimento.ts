/**
 * Medida de deslocamento no mapa: do pixel do mundo para metros pela escala da página, e o limite do turno. Espelha
 * `app/Nucleo/Combate/Movimento.php` (o servidor trava de verdade; a tela usa isto para desenhar a régua e travar o
 * arrasto na hora). Arquivo PURO.
 */
import type { ItemTurno } from './estado.ts';

/** Escala do mapa: `distancia_quadrado` (na `unidade`) a cada `tamanho_quadrado` pixels. */
export interface EscalaDoMapa {
    tamanho_quadrado: number;
    distancia_quadrado: number;
    unidade: string;
}

/** Margem para a conta de ponto flutuante não recusar um passo que cabe exato. */
export const FOLGA = 0.001;

/** Quantos metros vale 1 da unidade do mapa (m = 1; pés = 0,3048...). */
export function fatorParaMetros(unidade: string | null | undefined): number {
    switch ((unidade ?? '').trim().toLowerCase()) {
        case 'ft':
        case 'pé':
        case 'pés':
        case 'pe':
        case 'pes':
        case 'feet':
        case 'foot':
            return 0.3048;
        case 'km':
            return 1000;
        case 'cm':
            return 0.01;
        default:
            return 1;
    }
}

/** Metros que um deslocamento de (dx, dy) pixels vale neste mapa. */
export function metros(dx: number, dy: number, mapa: EscalaDoMapa): number {
    return (Math.hypot(dx, dy) / Math.max(1, mapa.tamanho_quadrado)) * mapa.distancia_quadrado * fatorParaMetros(mapa.unidade);
}

export interface PassoLimitado {
    x: number;
    y: number;
    metros: number;
    /** O deslocamento acabou antes do ponto pedido. */
    travou: boolean;
}

/** Do ponto antigo ao novo sem passar de `restante` metros: se passa, o ponto final é onde o deslocamento acaba. */
export function limitar(x0: number, y0: number, x1: number, y1: number, restante: number, mapa: EscalaDoMapa): PassoLimitado {
    const d = metros(x1 - x0, y1 - y0, mapa);
    if (d <= restante + FOLGA) return { x: x1, y: y1, metros: d, travou: false };
    const t = d > 0 ? Math.max(0, restante) / d : 0;

    return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t, metros: Math.max(0, restante), travou: true };
}

/** Deslocamento total do turno (base do sistema + bônus da Disparada), em metros; null = sem limite medido. */
export const totalDoTurno = (i: ItemTurno): number | null => (i.movimento.base === null ? null : i.movimento.base + i.movimento.bonus);

/** Quanto ainda pode andar neste turno, em metros (nunca negativo); null = sem limite medido. */
export function restanteDoTurno(i: ItemTurno): number | null {
    const total = totalDoTurno(i);

    return total === null ? null : Math.max(0, total - i.movimento.usado);
}
