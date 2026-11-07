<?php

namespace App\Nucleo\Combate;

use Illuminate\Support\Str;

/**
 * Aplicação de dano a uma ficha (genérica: usa `pv`, `resistencias`, `imunidades` e `vulnerabilidades`, que os sistemas
 * do projeto têm em comum). As listas são texto livre; o tipo do dano é comparado sem maiúsculas nem acentos.
 */
final class Dano
{
    public static function normalizar(?string $texto): string
    {
        return Str::of((string) $texto)->ascii()->lower()->trim()->toString();
    }

    /** O texto está na lista (sem maiúsculas e acentos)? */
    public static function contem(array $lista, ?string $texto): bool
    {
        $alvo = self::normalizar($texto);

        return $alvo !== '' && in_array($alvo, array_map(fn ($t) => self::normalizar(is_string($t) ? $t : ''), $lista), true);
    }

    /**
     * Dano final depois das defesas: imunidade zera, resistência divide por 2 (para baixo), vulnerabilidade dobra
     * (resistência e vulnerabilidade juntas se anulam). Tipo desconhecido ou vazio não sofre ajuste.
     *
     * @param  array<string, mixed>  $ficha
     * @return array{final: int, modo: 'normal'|'imune'|'resistido'|'vulneravel'}
     */
    public static function calcular(array $ficha, int $total, ?string $tipo): array
    {
        $total = max(0, $total);
        if (self::contem($ficha['imunidades'] ?? [], $tipo)) {
            return ['final' => 0, 'modo' => 'imune'];
        }
        $resiste = self::contem($ficha['resistencias'] ?? [], $tipo);
        $vulneravel = self::contem($ficha['vulnerabilidades'] ?? [], $tipo);
        if ($resiste && ! $vulneravel) {
            return ['final' => intdiv($total, 2), 'modo' => 'resistido'];
        }
        if ($vulneravel && ! $resiste) {
            return ['final' => $total * 2, 'modo' => 'vulneravel'];
        }

        return ['final' => $total, 'modo' => 'normal'];
    }

    /**
     * Tira o dano dos PV temporários primeiro e do resto dos PV atuais (mínimo 0).
     *
     * @param  array{atual?: int, max?: int, temp?: int}  $pv
     * @return array{atual: int, temp: int}
     */
    public static function noPv(array $pv, int $dano): array
    {
        $temp = (int) ($pv['temp'] ?? 0);
        $absorvido = min($temp, $dano);

        return ['temp' => $temp - $absorvido, 'atual' => max(0, (int) ($pv['atual'] ?? 0) - ($dano - $absorvido))];
    }
}
