<?php

namespace App\Nucleo\Cena;

use App\Models\Objeto;
use App\Models\Pagina;

/**
 * As paredes como barreira. O servidor decide o que um token pode atravessar e quem alcança uma porta: o cliente só antecipa para a
 * tela não "pular". Cada parede (porta ou janela) pode bloquear movimento, visão e luz separadamente (`dados.bloqueio`); aberta, deixa
 * tudo passar. Há ainda a parede etérea (só barra o movimento) e a ilusória (só barra a visão e a luz). Espelha `resources/js/app/engine/visao.ts`.
 */
final class Paredes
{
    /** O que cada tipo bloqueia quando nada foi configurado (a janela é vidro: barra o corpo, não a visão nem a luz). */
    private const PADRAO = [
        'parede' => ['movimento' => true, 'visao' => true, 'luz' => true],
        'porta' => ['movimento' => true, 'visao' => true, 'luz' => true],
        'janela' => ['movimento' => true, 'visao' => false, 'luz' => false],
        // etérea: barra o corpo mas não a vista nem a luz (um fosso, um precipício); ilusória: barra a vista e a luz mas não o corpo (fumaça densa)
        'etereo' => ['movimento' => true, 'visao' => false, 'luz' => false],
        'ilusoria' => ['movimento' => false, 'visao' => true, 'luz' => true],
    ];

    /** @return array{0: float, 1: float, 2: float, 3: float}|null */
    public static function pontos(Objeto $o): ?array
    {
        $p = $o->dados['pontos'] ?? null;

        return $o->tipo === 'parede' && is_array($p) && count($p) === 4 ? [(float) $p[0], (float) $p[1], (float) $p[2], (float) $p[3]] : null;
    }

    public static function bloqueia(Objeto $o, string $canal): bool
    {
        $tipo = $o->dados['tipo'] ?? 'parede';
        if (in_array($tipo, ['porta', 'janela'], true) && ($o->dados['aberta'] ?? false)) {
            return false;
        }

        return (bool) ($o->dados['bloqueio'][$canal] ?? self::PADRAO[$tipo][$canal] ?? true);
    }

    /** O caminho reto de (x0,y0) a (x1,y1) não cruza nenhuma parede que barre o movimento? */
    public static function caminhoLivre(Pagina $pagina, float $x0, float $y0, float $x1, float $y1): bool
    {
        if ($x0 === $x1 && $y0 === $y1) {
            return true;
        }
        foreach ($pagina->objetos()->where('tipo', 'parede')->get() as $o) {
            $p = self::pontos($o);
            if ($p && self::bloqueia($o, 'movimento') && self::cruza($x0, $y0, $x1, $y1, ...$p)) {
                return false;
            }
        }

        return true;
    }

    /** Distância do ponto ao segmento. */
    public static function distanciaAoSegmento(float $px, float $py, float $ax, float $ay, float $bx, float $by): float
    {
        $dx = $bx - $ax;
        $dy = $by - $ay;
        $len2 = $dx * $dx + $dy * $dy;
        $t = $len2 > 0 ? max(0, min(1, (($px - $ax) * $dx + ($py - $ay) * $dy) / $len2)) : 0;

        return hypot($px - ($ax + $t * $dx), $py - ($ay + $t * $dy));
    }

    private static function cruza(float $x0, float $y0, float $x1, float $y1, float $ax, float $ay, float $bx, float $by): bool
    {
        $rx = $x1 - $x0;
        $ry = $y1 - $y0;
        $sx = $bx - $ax;
        $sy = $by - $ay;
        $den = $rx * $sy - $ry * $sx;
        if (abs($den) < 1e-12) {
            return false; // paralelos
        }
        $t = (($ax - $x0) * $sy - ($ay - $y0) * $sx) / $den;
        $u = (($ax - $x0) * $ry - ($ay - $y0) * $rx) / $den;

        return $t >= 0 && $t <= 1 && $u >= 0 && $u <= 1;
    }
}
