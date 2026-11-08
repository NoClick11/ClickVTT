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
     * (resistência e vulnerabilidade juntas se anulam). Tipo desconhecido ou vazio não sofre ajuste. `$ignora` ('resistencia',
     * 'imunidade', 'imunidade_metade'): defesas que a arma passa por cima (Densidade e Balanço da forja).
     *
     * @param  array<string, mixed>  $ficha
     * @return array{final: int, modo: 'normal'|'imune'|'resistido'|'vulneravel'}
     */
    public static function calcular(array $ficha, int $total, ?string $tipo, array $ignora = []): array
    {
        $total = max(0, $total);
        if (! in_array('imunidade', $ignora, true) && self::contem($ficha['imunidades'] ?? [], $tipo)) {
            // `imunidade_metade` (Golpe Moral): a invulnerabilidade só corta o dano pela metade
            return in_array('imunidade_metade', $ignora, true) ? ['final' => intdiv($total, 2), 'modo' => 'imune_metade'] : ['final' => 0, 'modo' => 'imune'];
        }
        $resiste = ! in_array('resistencia', $ignora, true) && self::contem($ficha['resistencias'] ?? [], $tipo);
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
     * Como `noPv`, mas com Pontos de Escudo na frente (consumidos antes dos PV temporários). Com `$escudoResiste` o escudo
     * tem resistência ao dano deste tipo: cada ponto absorve 2 de dano (o escudo perde metade, para baixo).
     *
     * @param  array{atual?: int, max?: int, temp?: int, escudo?: int}  $pv
     * @return array{atual: int, temp: int, escudo: int}
     */
    public static function noPvComEscudo(array $pv, int $dano, bool $escudoResiste): array
    {
        $escudo = max(0, (int) ($pv['escudo'] ?? 0));
        $resto = $dano;
        if ($escudo > 0 && $dano > 0) {
            if ($escudoResiste) {
                $perda = intdiv($dano, 2);
                if ($perda <= $escudo) {
                    $escudo -= $perda;
                    $resto = 0;
                } else {
                    $resto = $dano - 2 * $escudo;
                    $escudo = 0;
                }
            } else {
                $absorvido = min($escudo, $dano);
                $escudo -= $absorvido;
                $resto = $dano - $absorvido;
            }
        }

        return [...self::noPv($pv, $resto), 'escudo' => $escudo];
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
