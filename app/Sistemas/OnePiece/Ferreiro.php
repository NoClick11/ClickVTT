<?php

namespace App\Sistemas\OnePiece;

/**
 * Pontos de Forja (PF) do Ferreiro (cap. 4, "Lâminas"): 1 PF a cada 10 anos de vida, 1 a cada 10 lâminas comuns produzidas e 2 a
 * cada graduação alcançada, mais os PF que o mestre der. Os PF gastos e as lâminas contadas são do servidor (`ForjaController`).
 * O campo da ficha é `forja`: {idade, laminas, extras, gastos}.
 */
class Ferreiro
{
    /** @return array{idade: int, laminas: int, extras: int, gastos: int} */
    public static function padrao(): array
    {
        return ['idade' => 0, 'laminas' => 0, 'extras' => 0, 'gastos' => 0];
    }

    /** @param array<string, mixed> $ficha @return array<string, mixed>|null a entrada da profissão Ferreiro */
    public static function profissao(array $ficha): ?array
    {
        if (! empty($ficha['profissoes']['semProfissao'])) {
            return null;
        }
        foreach ($ficha['profissoes']['lista'] ?? [] as $p) {
            if (($p['id'] ?? null) === 'ferreiro') {
                return $p;
            }
        }

        return null;
    }

    public static function ehFerreiro(array $ficha): bool
    {
        return self::profissao($ficha) !== null;
    }

    /** Graduação (0 a 3) na profissão Ferreiro. */
    public static function graduacao(array $ficha): int
    {
        return (int) (self::profissao($ficha)['graduacao'] ?? 0);
    }

    /**
     * @param  array<string, mixed>  $ficha
     * @return array{ganhos: int, gastos: int, disponiveis: int, porIdade: int, porLaminas: int, porGraduacao: int, extras: int}
     */
    public static function pontos(array $ficha): array
    {
        $f = array_replace(self::padrao(), $ficha['forja'] ?? []);
        $porIdade = intdiv(max(0, (int) $f['idade']), 10);
        $porLaminas = intdiv(max(0, (int) $f['laminas']), 10);
        $porGraduacao = 2 * self::graduacao($ficha);
        $ganhos = $porIdade + $porLaminas + $porGraduacao + (int) $f['extras'];

        return [
            'ganhos' => $ganhos, 'gastos' => (int) $f['gastos'], 'disponiveis' => $ganhos - (int) $f['gastos'],
            'porIdade' => $porIdade, 'porLaminas' => $porLaminas, 'porGraduacao' => $porGraduacao, 'extras' => (int) $f['extras'],
        ];
    }

    /** CD do Teste de forja: 16, menos a redução da graduação (Especialista −1, Mestre −2, Grão-Mestre −3). */
    public static function cd(array $ficha): int
    {
        return 16 - self::graduacao($ficha);
    }
}
