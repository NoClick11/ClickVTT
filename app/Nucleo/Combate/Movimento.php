<?php

namespace App\Nucleo\Combate;

use App\Models\Pagina;

/**
 * Medida de deslocamento no mapa: do pixel do mundo para metros, pela escala da página (`distancia_quadrado` na
 * `unidade` do mapa a cada `tamanho_quadrado` pixels). Espelha `resources/js/app/nucleo/combate/movimento.ts`.
 */
final class Movimento
{
    /** Margem para a conta de ponto flutuante não recusar um passo que cabe exato. */
    public const FOLGA = 0.001;

    /** Quantos metros vale 1 da unidade da página (m = 1; pés = 0,3048...). */
    public static function fatorParaMetros(?string $unidade): float
    {
        return match (mb_strtolower(trim((string) $unidade))) {
            'ft', 'pé', 'pés', 'pe', 'pes', 'feet', 'foot' => 0.3048,
            'km' => 1000.0,
            'cm' => 0.01,
            default => 1.0,
        };
    }

    /** Metros que um deslocamento de (dx, dy) pixels vale nesta página. */
    public static function metros(float $dx, float $dy, Pagina $pagina): float
    {
        $quadrado = max(1.0, (float) $pagina->tamanho_quadrado);

        return hypot($dx, $dy) / $quadrado * (float) $pagina->distancia_quadrado * self::fatorParaMetros($pagina->unidade);
    }

    /**
     * Do ponto antigo ao novo, sem passar de `$restante` metros: se passa, o ponto novo vira o ponto do segmento onde o
     * deslocamento acaba. Devolve o ponto final e os metros andados.
     *
     * @return array{x: float, y: float, metros: float, travou: bool}
     */
    public static function limitar(float $x0, float $y0, float $x1, float $y1, float $restante, Pagina $pagina): array
    {
        $d = self::metros($x1 - $x0, $y1 - $y0, $pagina);
        if ($d <= $restante + self::FOLGA) {
            return ['x' => $x1, 'y' => $y1, 'metros' => $d, 'travou' => false];
        }
        $t = $d > 0 ? max(0.0, $restante) / $d : 0.0;

        return ['x' => $x0 + ($x1 - $x0) * $t, 'y' => $y0 + ($y1 - $y0) * $t, 'metros' => max(0.0, $restante), 'travou' => true];
    }
}
