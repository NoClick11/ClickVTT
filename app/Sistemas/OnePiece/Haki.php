<?php

namespace App\Sistemas\OnePiece;

/**
 * Regras do Haki (cap. 7) no servidor: PA ganhos e gastos, estágio e a conferência das compras. É o ESPELHO de
 * `resources/js/app/sistemas/onepiece/haki/{calculo,regras}.ts` (conferido por `tests/paridade/haki.json`); o catálogo
 * (custos, estágio, pré-requisitos, formas) vem de `dados/haki.json`, que o teste de paridade confere contra o TS.
 */
class Haki
{
    public const TIPOS = ['armamento', 'observacao', 'rei'];

    public const NIVEL_DO_HAKI = 8;

    /** @var array{limitesEstagio: array<int, array{0: int, 1: int}>, talentos: array<int, array<string, mixed>>}|null */
    private static ?array $catalogo = null;

    /** @return array{limitesEstagio: array<int, array{0: int, 1: int}>, talentos: array<int, array<string, mixed>>} */
    public static function catalogo(): array
    {
        return self::$catalogo ??= json_decode(file_get_contents(__DIR__.'/dados/haki.json'), true);
    }

    /** @return array<string, mixed>|null */
    public static function talento(string $id): ?array
    {
        foreach (self::catalogo()['talentos'] as $t) {
            if ($t['id'] === $id) {
                return $t;
            }
        }

        return null;
    }

    public static function padrao(): array
    {
        return [
            'ativo' => false,
            'liberado' => false,
            'rei' => false,
            'prematuroNivel' => 0,
            'extras' => 0,
            'restritos' => ['armamento' => 0, 'observacao' => 0, 'rei' => 0],
            'principal' => '',
            'afinidade' => '',
            'talentos' => [],
        ];
    }

    private static function haki(array $ficha): array
    {
        return array_replace_recursive(self::padrao(), $ficha['haki'] ?? []);
    }

    public static function desperto(array $ficha): bool
    {
        return (int) ($ficha['nivel'] ?? 1) >= self::NIVEL_DO_HAKI || (bool) (self::haki($ficha)['liberado']);
    }

    /** @return array<string, int> PA gastos em cada tipo (cada forma custa o mesmo que a base). */
    public static function gastoPorTipo(array $ficha): array
    {
        $r = array_fill_keys(self::TIPOS, 0);
        foreach (self::haki($ficha)['talentos'] as $c) {
            $t = self::talento((string) ($c['id'] ?? ''));
            if ($t) {
                $r[$t['tipo']] += $t['custo'] * min((int) ($c['formas'] ?? 1), $t['formas']);
            }
        }

        return $r;
    }

    public static function estagioDoGasto(int $gasto): int
    {
        $e = 0;
        foreach (self::catalogo()['limitesEstagio'] as [$minimo, $estagio]) {
            if ($gasto >= $minimo) {
                $e = $estagio;
            }
        }

        return $e;
    }

    /** 0 Latente, 1 Inexperiente, 2 Treinado, 3 Perito. */
    public static function estagio(array $ficha): int
    {
        return self::estagioDoGasto(array_sum(self::gastoPorTipo($ficha)));
    }

    public static function paPorNivel(int $nivel): int
    {
        return $nivel >= self::NIVEL_DO_HAKI ? 5 + 12 * ($nivel - self::NIVEL_DO_HAKI) : 0;
    }

    public static function paDoDespertarPrematuro(int $nivel, int $prematuroNivel): int
    {
        if ($prematuroNivel <= 0 || $nivel < $prematuroNivel || $prematuroNivel >= self::NIVEL_DO_HAKI) {
            return 0;
        }

        return 2 + 2 * (min($nivel, self::NIVEL_DO_HAKI) - $prematuroNivel);
    }

    /**
     * @return array{ganhosGerais: int, gastoGeral: int, disponiveis: int, restritosRestantes: array<string, int>, gastoPorTipo: array<string, int>}
     */
    public static function resumoDosPA(array $ficha): array
    {
        $h = self::haki($ficha);
        $nivel = max(1, (int) ($ficha['nivel'] ?? 1));
        $gasto = self::gastoPorTipo($ficha);
        $afinidade = ($h['afinidade'] !== '' && ($gasto[$h['afinidade']] ?? 0) >= 1) ? 2 : 0;
        $ambicao = ($h['rei'] && $nivel >= 10) ? 2 * ($nivel - 9) : 0;
        $ganhos = self::paPorNivel($nivel) + self::paDoDespertarPrematuro($nivel, (int) $h['prematuroNivel']) + $ambicao + $afinidade + (int) $h['extras'] + Treinamentos::paDeHaki($ficha) + Individualidades::paDeHaki($ficha);
        $restantes = [];
        $gastoGeral = 0;
        foreach (self::TIPOS as $tipo) {
            $restrito = max(0, (int) ($h['restritos'][$tipo] ?? 0));
            $restantes[$tipo] = max(0, $restrito - $gasto[$tipo]);
            $gastoGeral += max(0, $gasto[$tipo] - $restrito);
        }

        return [
            'ganhosGerais' => $ganhos,
            'gastoGeral' => $gastoGeral,
            'disponiveis' => $ganhos - $gastoGeral,
            'restritosRestantes' => $restantes,
            'gastoPorTipo' => $gasto,
        ];
    }

    /** Estágio mínimo para comprar a forma `n` do talento. */
    public static function estagioDaForma(array $talento, int $forma): int
    {
        // o 1º talento é comprado ainda Latente: o estágio nasce do gasto
        return $forma >= 3 ? 3 : ($forma === 2 ? max(2, $talento['estagio']) : ($talento['estagio'] === 1 ? 0 : $talento['estagio']));
    }

    private static function formaDe(array $h, string $id): int
    {
        foreach ($h['talentos'] as $t) {
            if (($t['id'] ?? null) === $id) {
                return (int) $t['formas'];
            }
        }

        return 0;
    }

    /**
     * Confere as compras da ficha. Devolve as mensagens de erro (lista vazia = válido). Espelha `problemasDoHaki` (TS).
     *
     * @return list<string>
     */
    public static function problemas(array $ficha): array
    {
        $h = self::haki($ficha);
        $p = [];
        $vistos = [];
        foreach ($h['talentos'] as $c) {
            $id = (string) ($c['id'] ?? '');
            $t = self::talento($id);
            if (! $t || $id === 'rei') {
                $p[] = "Talento inválido: {$id}.";
            } elseif (isset($vistos[$id])) {
                $p[] = "Talento repetido: {$t['nome']}.";
            } elseif (! is_int($c['formas'] ?? null) || $c['formas'] < 1 || $c['formas'] > $t['formas']) {
                $p[] = "{$id}: forma inválida.";
            }
            $vistos[$id] = true;
        }
        if ($p) {
            return $p;
        }
        if ($h['talentos'] && ! self::desperto($ficha)) {
            $p[] = 'O Haki ainda não foi despertado.';
        }
        foreach ($h['talentos'] as $c) {
            $t = self::talento($c['id']);
            if ($t['tipo'] === 'rei' && ! $h['rei']) {
                $p[] = "{$c['id']}: o personagem não tem o Haki do Rei.";
            }
            foreach ($t['requisitos'] as $r) {
                if ($r !== 'rei' && self::formaDe($h, $r) < 1) {
                    $p[] = "{$c['id']}: falta o requisito {$r}.";
                }
            }
        }
        $itens = [];
        foreach ($h['talentos'] as $c) {
            $t = self::talento($c['id']);
            for ($i = 1; $i <= $c['formas']; $i++) {
                $itens[] = ['custo' => $t['custo'], 'exigido' => self::estagioDaForma($t, $i), 'id' => $t['id']];
            }
        }
        usort($itens, fn ($a, $b) => $a['exigido'] <=> $b['exigido']);
        $acumulado = 0;
        foreach ($itens as $it) {
            if (self::estagioDoGasto($acumulado) < $it['exigido']) {
                $p[] = "{$it['id']}: exige o estágio {$it['exigido']} antes da compra.";
            }
            $acumulado += $it['custo'];
        }
        if (self::resumoDosPA($ficha)['disponiveis'] < 0) {
            $p[] = 'Os talentos custam mais PA do que o personagem tem.';
        }
        if ($h['afinidade'] === 'rei' && ! $h['rei']) {
            $p[] = 'A afinidade com o Haki do Rei exige o Haki do Rei.';
        }
        return $p;
    }
}
