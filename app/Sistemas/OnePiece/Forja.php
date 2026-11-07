<?php

namespace App\Sistemas\OnePiece;

/**
 * Armas Meito, Kokuto e Yoto, a Expertise das armas e as melhorias dos Pontos de Forja (profissão Ferreiro) no servidor.
 * Espelho de `itens/forja.ts` (catálogo em `dados/forja.json`, gerado do TS e conferido por teste). Os dados de forja de uma
 * arma ficam em `dados.arma.forja` do item.
 */
class Forja
{
    private const SEQUENCIA_DE_DADOS = '/^(\d+)d(\d+)$/';

    /** @var array<string, mixed>|null */
    private static ?array $catalogo = null;

    /** @return array<string, mixed> */
    public static function catalogo(): array
    {
        return self::$catalogo ??= json_decode(file_get_contents(__DIR__.'/dados/forja.json'), true);
    }

    /** @return array<string, mixed>|null */
    public static function meito(?string $id): ?array
    {
        foreach (self::catalogo()['meito'] as $m) {
            if ($m['id'] === $id) {
                return $m;
            }
        }

        return null;
    }

    /** @return array<string, mixed>|null */
    public static function expertise(?string $id): ?array
    {
        foreach (self::catalogo()['expertises'] as $e) {
            if ($e['id'] === $id) {
                return $e;
            }
        }

        return null;
    }

    /** @return list<string> */
    public static function ids(string $lista): array
    {
        return array_column(self::catalogo()[$lista], 'id');
    }

    private static function maximo(string $dano): int
    {
        if (preg_match(self::SEQUENCIA_DE_DADOS, $dano, $m)) {
            return (int) $m[1] * (int) $m[2];
        }

        return $dano === '1' ? 1 : 0;
    }

    public static function sobeFio(string $dano, int $passos): string
    {
        if ($passos <= 0) {
            return $dano;
        }
        $seq = self::catalogo()['passosDoFio'];
        $i = array_search($dano, $seq, true);
        if ($i === false) {
            return $dano;
        }

        return $seq[min(count($seq) - 1, $i + $passos)];
    }

    /** O dano da arma com a forja: o dado mínimo da Meito e os passos do Fio. @param array<string, mixed>|null $forja */
    public static function danoComForja(string $dano, ?array $forja): string
    {
        if (! $forja) {
            return $dano;
        }
        $m = self::meito($forja['meito'] ?? null);
        if ($m && self::maximo($m['danoMinimo']) > self::maximo($dano)) {
            $dano = $m['danoMinimo'];
        }

        return self::sobeFio($dano, max(0, min((int) self::catalogo()['maxFio'], (int) ($forja['fio'] ?? 0))));
    }

    public static function bonusDeAtaque(?array $forja): int
    {
        return (int) (self::meito($forja['meito'] ?? null)['bonusAtaque'] ?? 0);
    }

    public static function margem(?array $forja): int
    {
        return (int) (self::meito($forja['meito'] ?? null)['margem'] ?? 20);
    }

    public static function dadosDeTecnica(?array $forja): int
    {
        return (int) (self::meito($forja['meito'] ?? null)['dadosDeTecnica'] ?? 0);
    }

    /**
     * Do que o dano da arma passa por cima no alvo: a Densidade ignora a resistência ao tipo (se o dano da arma é desse tipo) e o
     * Balanço, a invulnerabilidade a ele. @param array<string, mixed>|null $arma `dados.arma` do item
     *
     * @return list<'resistencia'|'imunidade'>
     */
    public static function ignoraDoDano(?array $arma): array
    {
        $forja = $arma['forja'] ?? null;
        $tipo = \App\Nucleo\Combate\Dano::normalizar($arma['tipoDano'] ?? '');
        if (! $forja || empty($forja['densidade']) || ! str_contains($tipo, (string) $forja['densidade'])) {
            return [];
        }

        return empty($forja['balanco']) ? ['resistencia'] : ['resistencia', 'imunidade'];
    }

    /**
     * Problemas dos dados de forja de uma arma (o servidor confere ao salvar o item e ao aprimorar).
     *
     * @param  array<string, mixed>|null  $forja
     * @return list<string>
     */
    public static function problemas(?array $forja, bool $cortante = true): array
    {
        $p = [];
        if (! $forja) {
            return $p;
        }
        $c = self::catalogo();
        if (! empty($forja['meito']) && self::meito($forja['meito']) === null) {
            $p[] = 'Qualidade Meito desconhecida.';
        }
        if (! empty($forja['meito']) && ! $cortante) {
            $p[] = 'Meito são espadas e outras armas cortantes.';
        }
        if (! empty($forja['kokuto']) && empty($forja['meito'])) {
            $p[] = 'Espadas Kokuto são Meito.';
        }
        if (! empty($forja['yoto']) && ! in_array($forja['yoto'], self::ids('yoto'), true)) {
            $p[] = 'Maldição Yoto desconhecida.';
        }
        if (! empty($forja['yoto']) && empty($forja['meito'])) {
            $p[] = 'Armas Yoto sempre pertencem às Meito.';
        }
        $ex = array_values((array) ($forja['expertise'] ?? []));
        if (count($ex) > $c['maxExpertises']) {
            $p[] = "No máximo {$c['maxExpertises']} Expertises (a segunda é a Supremacia).";
        }
        if (count(array_unique($ex)) !== count($ex)) {
            $p[] = 'Expertises repetidas.';
        }
        if (array_diff($ex, self::ids('expertises'))) {
            $p[] = 'Expertise desconhecida.';
        }
        if (! empty($forja['densidade']) && ! in_array($forja['densidade'], $c['tiposFisicos'], true)) {
            $p[] = 'A Densidade vale para dano Contundente, Cortante ou Perfurante.';
        }
        if (! empty($forja['balanco']) && empty($forja['densidade'])) {
            $p[] = 'O Balanço exige a Densidade (ignora a invulnerabilidade ao mesmo tipo).';
        }
        $fio = (int) ($forja['fio'] ?? 0);
        if ($fio < 0 || $fio > $c['maxFio']) {
            $p[] = "O Fio sobe de 0 a {$c['maxFio']} passos.";
        }

        return $p;
    }

    /**
     * PF gastos para ir da forja `$de` à `$para` (só os acréscimos). Null = pedido inválido (voltar atrás).
     *
     * @param  array<string, mixed>|null  $de
     * @param  array<string, mixed>  $para
     * @return array{total: int, itens: list<string>}|null
     */
    public static function custoEmPF(?array $de, array $para): ?array
    {
        $a = $de ?? [];
        $c = self::catalogo();
        $total = 0;
        $itens = [];
        $meitoDe = (int) (self::meito($a['meito'] ?? null)['pf'] ?? 0);
        $meitoPara = (int) (self::meito($para['meito'] ?? null)['pf'] ?? 0);
        if ($meitoPara < $meitoDe) {
            return null;
        }
        if ($meitoPara > $meitoDe) {
            $total += $meitoPara - $meitoDe;
            $itens[] = self::meito($para['meito'])['nome'].' ('.($meitoPara - $meitoDe).' PF)';
        }
        $exA = array_values((array) ($a['expertise'] ?? []));
        $exB = array_values((array) ($para['expertise'] ?? []));
        if (count($exB) < count($exA)) {
            return null;
        }
        foreach ($exA as $i => $x) {
            if (($exB[$i] ?? null) !== $x) {
                $total += $c['custo']['expertise'];
                $itens[] = 'Troca de Expertise';
            }
        }
        for ($i = count($exA); $i < count($exB); $i++) {
            $total += $i === 0 ? $c['custo']['expertise'] : $c['custo']['supremacia'];
            $itens[] = $i === 0 ? 'Expertise' : 'Supremacia';
        }
        if (! empty($para['densidade']) && ($para['densidade'] ?? null) !== ($a['densidade'] ?? null)) {
            $total += $c['custo']['densidade'];
            $itens[] = 'Densidade';
        }
        if (! empty($para['dureza']) && empty($a['dureza'])) {
            $total += $c['custo']['dureza'];
            $itens[] = 'Dureza';
        }
        if (! empty($para['balanco']) && empty($a['balanco'])) {
            $total += $c['custo']['balanco'];
            $itens[] = 'Balanço';
        }
        $passos = (int) ($para['fio'] ?? 0) - (int) ($a['fio'] ?? 0);
        if ($passos < 0) {
            return null;
        }
        if ($passos > 0) {
            $total += $c['custo']['fio'] * $passos;
            $itens[] = "Fio ×{$passos}";
        }

        return ['total' => $total, 'itens' => $itens];
    }

    /** Custo em dinheiro de uma forja/melhoria: ฿ 20.000 ou 20% do valor de compra (o maior), mais 1 lingote de metal. */
    public static function custoEmDinheiro(?int $preco): int
    {
        return max(20000, (int) ceil(($preco ?? 0) * 0.2));
    }
}
