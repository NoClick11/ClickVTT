<?php

namespace App\Nucleo\Efeitos;

/**
 * Motor de efeitos, independente de sistema. ESPELHA `resources/js/app/nucleo/efeitos/efeitos.ts`
 * (casos de `tests/paridade/efeitos.json` rodam nas duas implementações).
 *
 * Um EFEITO é `{alvo, modo, valor}`; ao ser ativado por uma fonte (item equipado, condição...) ganha `fonte`
 * (o nome, para mostrar de onde vem cada número). O `alvo` é a chave de um valor calculado do sistema
 * (`ca`, `pericia.percepcao`, `atributos.for`...); `pericia.*` casa todos os alvos que começam por `pericia.`.
 *
 * Modos, aplicados nesta ordem dentro de um alvo:
 *  - `base`: substitui o valor de partida (entre vários, vale o maior). Ex.: armadura define a CA base.
 *  - `soma`: soma ao valor. Ex.: anel de proteção +1.
 *  - `min` / `max`: eleva ao mínimo / limita ao máximo. Ex.: Cinto de Força (`min 21`).
 *  - `vantagem` / `desvantagem`: não mexem no valor; o botão de rolagem do alvo usa 2 dados (as duas anulam).
 *  - `dados`: dano EXTRA em dados (`valor` = `3d6`), que o sistema acrescenta à rolagem do alvo (ex.: Ataque Furtivo no
 *    dano das armas) e que dobra no crítico. Não mexe no valor calculado: quem monta a rolagem lê estes efeitos.
 * `valor` é um número ou uma fórmula (`Formula`) avaliada com as variáveis informadas por quem chama.
 * Efeito com fórmula inválida/variável desconhecida é ignorado (não derruba a ficha).
 */
final class Efeitos
{
    public const MODOS = ['soma', 'base', 'min', 'max', 'vantagem', 'desvantagem', 'dados'];

    /** Dados extras: 1 a 20 dados de 2 a 100 faces (`3d6`). Sem modificadores: eles vão em efeitos de soma. */
    public const REGEX_DADOS = '/^(?:[1-9]|1\d|20)d(?:[2-9]|[1-9]\d|100)$/';

    private const NUMERICOS = ['base', 'soma', 'min', 'max'];

    public const MAX_POR_FONTE = 30;

    /** Acrescenta a `fonte` a cada efeito (a lista vinda do item, da condição...). */
    public static function deFonte(string $fonte, array $efeitos): array
    {
        return array_values(array_map(fn (array $e) => ['fonte' => $fonte, 'alvo' => (string) $e['alvo'], 'modo' => (string) $e['modo'], 'valor' => $e['valor'] ?? null], $efeitos));
    }

    /** `pericia.*` casa `pericia.percepcao`; sem curinga, só o próprio alvo. */
    public static function casa(string $padrao, string $alvo): bool
    {
        if (str_ends_with($padrao, '.*')) {
            return str_starts_with($alvo, substr($padrao, 0, -1));
        }

        return $padrao === $alvo;
    }

    /**
     * Aplica ao valor-base do `$alvo` os efeitos que o casam.
     *
     * @param  list<array{fonte?: string, alvo: string, modo: string, valor?: mixed}>  $efeitos
     * @param  array<string, int|float>  $variaveis  para as fórmulas
     * @return array{valor: int|float, origens: list<array{fonte: string, modo: string, valor: int|float}>}
     */
    public static function aplicar(string $alvo, int|float $base, array $efeitos, array $variaveis = []): array
    {
        $porModo = array_fill_keys(self::NUMERICOS, []);
        foreach ($efeitos as $e) {
            if (! in_array($e['modo'], self::NUMERICOS, true) || ! self::casa($e['alvo'], $alvo)) {
                continue;
            }
            $v = self::valorDe($e['valor'] ?? null, $variaveis);
            if ($v !== null) {
                $porModo[$e['modo']][] = ['fonte' => $e['fonte'] ?? '', 'valor' => $v];
            }
        }

        $valor = $base;
        $origens = [];
        $registrar = function (array $item, string $modo) use (&$origens) {
            $origens[] = ['fonte' => $item['fonte'], 'modo' => $modo, 'valor' => $item['valor']];
        };

        if ($porModo['base']) {
            $vencedor = $porModo['base'][0];
            foreach ($porModo['base'] as $c) {
                if ($c['valor'] > $vencedor['valor']) {
                    $vencedor = $c;
                }
            }
            $valor = $vencedor['valor'];
            $registrar($vencedor, 'base');
        }
        foreach ($porModo['soma'] as $c) {
            $valor += $c['valor'];
            $registrar($c, 'soma');
        }
        foreach ($porModo['min'] as $c) {
            if ($c['valor'] > $valor) {
                $valor = $c['valor'];
                $registrar($c, 'min');
            }
        }
        foreach ($porModo['max'] as $c) {
            if ($c['valor'] < $valor) {
                $valor = $c['valor'];
                $registrar($c, 'max');
            }
        }

        return ['valor' => self::inteiro($valor), 'origens' => $origens];
    }

    /** `vantagem`, `desvantagem` ou null (nenhuma, ou as duas — que se anulam). */
    public static function rolagem(string $alvo, array $efeitos): ?string
    {
        $vantagem = $desvantagem = false;
        foreach ($efeitos as $e) {
            if (! self::casa($e['alvo'], $alvo)) {
                continue;
            }
            $vantagem = $vantagem || $e['modo'] === 'vantagem';
            $desvantagem = $desvantagem || $e['modo'] === 'desvantagem';
        }

        return $vantagem === $desvantagem ? null : ($vantagem ? 'vantagem' : 'desvantagem');
    }

    /**
     * Regras de validação do Laravel para uma lista de efeitos em `$caminho` (ex.: `efeitos`).
     * `$alvosValidos`: padrões aceitos pelo sistema (`ca`, `pericia.*`...); null = qualquer alvo bem formado.
     *
     * @param  list<string>|null  $alvosValidos
     * @return array<string, mixed>
     */
    public static function regras(string $caminho = 'efeitos', ?array $alvosValidos = null): array
    {
        return [
            $caminho => ['array', 'max:'.self::MAX_POR_FONTE],
            "{$caminho}.*" => ['array', function (string $atributo, mixed $efeito, \Closure $fail) use ($alvosValidos) {
                $erro = self::erroDoEfeito($efeito, $alvosValidos);
                if ($erro !== null) {
                    $fail($erro);
                }
            }],
        ];
    }

    private static function erroDoEfeito(mixed $e, ?array $alvosValidos): ?string
    {
        if (! is_array($e)) {
            return 'Efeito inválido.';
        }
        $alvo = $e['alvo'] ?? null;
        if (! is_string($alvo) || ! preg_match('/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)*(\.\*)?$/', $alvo) || strlen($alvo) > 60) {
            return 'Alvo do efeito inválido.';
        }
        if ($alvosValidos !== null && ! in_array($alvo, $alvosValidos, true)) {
            return "O alvo \"{$alvo}\" não existe neste sistema.";
        }
        $modo = $e['modo'] ?? null;
        if (! in_array($modo, self::MODOS, true)) {
            return 'Modo do efeito inválido.';
        }
        if ($modo === 'dados') {
            return self::dadosValidos($e['valor'] ?? null) ? null : 'Dano extra precisa de dados (ex.: 3d6, até 20 dados de 2 a 100 faces).';
        }
        if (! in_array($modo, self::NUMERICOS, true)) {
            return null; // vantagem/desvantagem não têm valor
        }
        $valor = $e['valor'] ?? null;
        if (is_int($valor) || is_float($valor)) {
            return is_finite($valor) && abs($valor) <= 1_000_000 ? null : 'Valor do efeito fora do intervalo.';
        }
        if (is_string($valor) && Formula::sintaxeValida($valor)) {
            return null;
        }

        return 'Informe um número ou uma fórmula válida (ex.: 2 ou 14+min(@mod.des,2)).';
    }

    /** `valor` é uma expressão de dados simples (`3d6`)? */
    public static function dadosValidos(mixed $valor): bool
    {
        return is_string($valor) && preg_match(self::REGEX_DADOS, $valor) === 1;
    }

    private static function valorDe(mixed $valor, array $variaveis): int|float|null
    {
        if (is_int($valor) || is_float($valor)) {
            return $valor;
        }
        if (is_string($valor)) {
            try {
                return Formula::avaliar($valor, $variaveis);
            } catch (FormulaInvalida) {
                return null;
            }
        }

        return null;
    }

    private static function inteiro(int|float $v): int|float
    {
        return is_float($v) && is_finite($v) && $v == floor($v) && abs($v) < 1e15 ? (int) $v : $v;
    }
}
