<?php

namespace App\Sistemas\OnePiece;

/**
 * Regras dos Treinamentos (cap. 5.7) no servidor: PT ganhos e gastos e a conferência dos pedidos. ESPELHO de
 * `resources/js/app/sistemas/onepiece/treinamentos/regras.ts` (conferido por `tests/paridade/treinamentos.json`); o catálogo
 * vem de `dados/treinamentos.json`, conferido contra o TS.
 */
class Treinamentos
{
    /** @var array{custoGenialidade: list<int>, treinamentos: list<array<string, mixed>>}|null */
    private static ?array $catalogo = null;

    /** @return array{custoGenialidade: list<int>, treinamentos: list<array<string, mixed>>} */
    public static function catalogo(): array
    {
        return self::$catalogo ??= json_decode(file_get_contents(__DIR__.'/dados/treinamentos.json'), true);
    }

    /** @return array<string, mixed>|null */
    public static function treinamento(string $id): ?array
    {
        foreach (self::catalogo()['treinamentos'] as $t) {
            if ($t['id'] === $id) {
                return $t;
            }
        }

        return null;
    }

    public static function padrao(): array
    {
        return ['extras' => 0, 'codigo' => '', 'aprendidos' => [], 'pedidos' => []];
    }

    private static function tr(array $ficha): array
    {
        return array_replace(self::padrao(), $ficha['treinamento'] ?? []);
    }

    public static function ptDoNivel(int $nivel): int
    {
        return 3 * intdiv(min(max(1, $nivel), 10), 2);
    }

    /** Traço Cultural (PT igual ao mod. de Sabedoria, quando positivo) e Singularidade Disciplinado (1 por nível par). */
    public static function ptCulturais(array $ficha): int
    {
        $tem = collect($ficha['caracteristicas'] ?? [])->contains(fn ($c) => ($c['nome'] ?? null) === 'Traços Culturais');

        $cultural = $tem ? max(0, (int) floor((((int) ($ficha['atributos']['sab'] ?? 10)) - 10) / 2)) : 0;
        // Singularidade Disciplinado: 1 PT a cada nível par de personagem.
        $disciplinado = collect($ficha['caracteristicas'] ?? [])->contains(fn ($c) => ($c['nome'] ?? null) === 'Disciplinado' && ($c['builder'] ?? null) === 'individualidade')
            ? intdiv(min(20, max(1, (int) ($ficha['nivel'] ?? 1))), 2)
            : 0;

        // Esforço Heroico (Herói): 5 PT no 1º nível e 2 a cada nível par (o texto pede que sejam usados na Genialidade Inusitada)
        $heroico = collect($ficha['caracteristicas'] ?? [])->contains(fn ($c) => str_contains((string) ($c['nome'] ?? ''), 'Esforço Heroico'))
            ? 5 + 2 * intdiv(min(20, max(1, (int) ($ficha['nivel'] ?? 1))), 2)
            : 0;

        // Akuma no Chikara (Usuário Ínsito): 2 PT a cada nível par e, no 1º nível, 3 (categoria S), 4 (A) ou 6 (B ou C) PT extras
        $insito = collect($ficha['caracteristicas'] ?? [])->contains(fn ($c) => str_contains((string) ($c['nome'] ?? ''), 'Akuma no Chikara'))
            ? 2 * intdiv(min(20, max(1, (int) ($ficha['nivel'] ?? 1))), 2) + (['s' => 3, 'a' => 4, 'b' => 6, 'c' => 6][$ficha['akuma']['categoria'] ?? ''] ?? 0)
            : 0;

        return $cultural + $disciplinado + $heroico + $insito;
    }

    /** @param list<array<string, mixed>> $anteriores */
    public static function custoDe(array $t, array $anteriores): int
    {
        if ($t['id'] === 'genialidade-inusitada') {
            $custos = self::catalogo()['custoGenialidade'];
            $n = count(array_filter($anteriores, fn ($a) => ($a['id'] ?? null) === $t['id']));

            return $custos[min($n, count($custos) - 1)];
        }

        return $t['pt'];
    }

    public static function gastoDosAprendidos(array $aprendidos): int
    {
        $gasto = 0;
        $vistos = [];
        foreach ($aprendidos as $a) {
            $t = self::treinamento((string) ($a['id'] ?? ''));
            if ($t) {
                $gasto += self::custoDe($t, $vistos);
            }
            $vistos[] = $a;
        }

        return $gasto;
    }

    /** @return array{ganhos: int, extras: int, gasto: int, disponiveis: int, comprometidos: int, livres: int} */
    public static function resumoDosPT(array $ficha): array
    {
        $tr = self::tr($ficha);
        $ganhos = self::ptDoNivel((int) ($ficha['nivel'] ?? 1)) + self::ptCulturais($ficha) + (int) $tr['extras'];
        $gasto = self::gastoDosAprendidos($tr['aprendidos']);
        $comprometidos = 0;
        $simulados = $tr['aprendidos'];
        foreach ($tr['pedidos'] as $p) {
            $t = self::treinamento((string) ($p['id'] ?? ''));
            if ($t) {
                $comprometidos += self::custoDe($t, $simulados);
            }
            $simulados[] = ['id' => $p['id'] ?? ''];
        }

        return ['ganhos' => $ganhos, 'extras' => (int) $tr['extras'], 'gasto' => $gasto, 'disponiveis' => $ganhos - $gasto, 'comprometidos' => $comprometidos, 'livres' => $ganhos - $gasto - $comprometidos];
    }

    private static function norm(string $s): string
    {
        return strtolower(\Illuminate\Support\Str::ascii($s));
    }

    /**
     * Motivos que impedem de pedir o treinamento (lista vazia = pode). Espelha `problemasDoPedido` (TS). `$ficha` é a ficha
     * ANTES do pedido.
     *
     * @return list<string>
     */
    public static function problemasDoPedido(array $ficha, string $id, ?string $opcao = null): array
    {
        $t = self::treinamento($id);
        if (! $t) {
            return ['Treinamento desconhecido.'];
        }
        $tr = self::tr($ficha);
        $p = [];
        $aprendidos = array_column($tr['aprendidos'], 'id');
        $pedidos = array_column($tr['pedidos'], 'id');
        if (! $t['repetivel'] && in_array($id, $aprendidos, true)) {
            $p[] = 'Este treinamento só pode ser aprendido uma vez.';
        }
        if (in_array($id, $pedidos, true)) {
            $p[] = $t['repetivel'] ? 'Conclua o treinamento em andamento antes de repetir.' : 'Este treinamento já está em andamento.';
        }
        if ($id === 'genialidade-inusitada' && count(array_keys($aprendidos, $id, true)) >= count(self::catalogo()['custoGenialidade'])) {
            $p[] = 'Todos os graus da Genialidade Inusitada já foram aprendidos.';
        }
        if ($t['requer'] && ! in_array($t['requer'], $aprendidos, true)) {
            $p[] = "Exige o treinamento {$t['requer']}.";
        }
        $atributos = $ficha['atributos'] ?? [];
        if (! array_filter($t['atributos'], fn ($a) => (int) ($atributos[$a] ?? 0) >= $t['minimo'])) {
            $p[] = 'Exige '.implode(' ou ', array_map('strtoupper', $t['atributos'])).' '.$t['minimo'].'.';
        }
        if ($t['especie'] && ! str_contains(self::norm((string) ($ficha['especie'] ?? '')), self::norm($t['especie']))) {
            $p[] = "Só para {$t['especie']} (ou mestiços).";
        }
        if ($t['escolha'] && ! in_array($opcao, $t['escolha'], true)) {
            $p[] = 'Escolha a opção do treinamento.';
        }
        $livres = self::resumoDosPT($ficha)['livres'];
        $custo = self::custoDe($t, $tr['aprendidos']);
        if ($livres < $custo) {
            $p[] = "Faltam PT: custa {$custo} e restam ".max(0, $livres).'.';
        }

        return $p;
    }

    /** Iniciada em Haki (Kuja): PA de Haki igual ao nível ao aprender, +2 por nível par depois, no máximo 10. */
    public static function paDeHaki(array $ficha): int
    {
        $a = null;
        foreach (self::tr($ficha)['aprendidos'] as $x) {
            if (($x['id'] ?? null) === 'iniciada-em-haki') {
                $a = $x;
            }
        }
        if (! $a) {
            return 0;
        }
        $nivel = max(1, (int) ($ficha['nivel'] ?? 1));
        $pa = (int) $a['nivel'];
        for ($n = (int) $a['nivel'] + 1; $n <= $nivel; $n++) {
            if ($n % 2 === 0) {
                $pa += 2;
            }
        }

        return min(10, $pa);
    }
}
