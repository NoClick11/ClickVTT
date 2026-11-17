/**
 * Zonas do mapa (objeto `zona`): a geometria que o mapa e o servidor compartilham. A origem fica no CENTRO da caixa do objeto; a caixa é
 * um quadrado de lado 2 × o alcance da forma (assim cabe a forma inteira, em qualquer rotação) e quem gira a zona é a `rotacao` do objeto.
 * Arquivo PURO (sem Vue nem Pixi). Espelha `App\Nucleo\Combate\Zonas`.
 */
import type { FormaDeArea, MedidaDeArea } from '../nucleo/combate/area';

export interface DadosDeZona {
    forma: FormaDeArea;
    /** Raio (esfera) ou comprimento (cone, linha, retângulo), em metros. */
    metros: number;
    /** Retângulo: o outro lado, em metros (sem ele, um quadrado). */
    largura_m?: number;
}

/** A que distância (m) da origem a forma chega: o raio da caixa. */
export const alcanceDaZona = (d: DadosDeZona): number => (d.forma === 'retangulo' ? Math.hypot(d.metros, d.largura_m ?? d.metros) / 2 : d.metros);

/** A caixa do objeto para uma zona centrada em `centro` (pixels do mundo); `metrosPorPx` é a escala da página. */
export function caixaDaZona(centro: { x: number; y: number }, d: DadosDeZona, metrosPorPx: number) {
    const lado = Math.max(8, (alcanceDaZona(d) / metrosPorPx) * 2);

    return { x: centro.x - lado / 2, y: centro.y - lado / 2, largura: lado, altura: lado };
}

/** A forma já medida (sem rotação: o objeto gira por inteiro) e a escala local (m/px) da caixa, para desenhar e testar acertos. */
export function medidaDaZona(d: DadosDeZona, larguraDaCaixa: number): { medida: MedidaDeArea; metrosPorPx: number } {
    return {
        medida: { forma: d.forma, metros: d.metros, angulo: 0, ...(d.largura_m ? { largura: d.largura_m } : {}) },
        metrosPorPx: alcanceDaZona(d) / Math.max(1, larguraDaCaixa / 2),
    };
}
