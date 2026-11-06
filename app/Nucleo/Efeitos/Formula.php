<?php

namespace App\Nucleo\Efeitos;

/**
 * Avaliador de fórmulas numéricas dos efeitos (SEM dados). ESPELHA `resources/js/app/nucleo/efeitos/formula.ts`:
 * o cliente calcula ao vivo e o servidor decide as rolagens; os casos de `tests/paridade/formula.json` rodam
 * nas duas implementações.
 *
 * Gramática (espaços e maiúsculas são ignorados):
 *   expr   := termo (('+' | '-') termo)*
 *   termo  := fator (('*' | '/') fator)*          (divisão arredonda para baixo)
 *   fator  := ('-' | '+') fator | '(' expr ')' | INTEIRO | '@' variavel | funcao '(' expr (',' expr)* ')'
 *   funcao := 'min' | 'max' | 'floor'
 *
 * Exemplos: `2`, `@mod.sab`, `14+min(@mod.des,2)`, `max(1,@mod.car)`, `floor(@nivel/2)`.
 */
final class Formula
{
    public const MAX_TAMANHO = 100;

    public const MAX_PROFUNDIDADE = 10;

    public const MAX_ARGUMENTOS = 8;

    private string $s = '';

    private int $i = 0;

    private int $profundidade = 0;

    /** @var array<string, int|float> */
    private array $variaveis = [];

    /** @var (callable(string): (int|float))|null */
    private $resolvedor = null;

    private function __construct() {}

    /**
     * @param  array<string, int|float>  $variaveis  nome (sem `@`, minúsculo) => valor
     *
     * @throws FormulaInvalida
     */
    public static function avaliar(string $expressao, array $variaveis = []): int|float
    {
        $f = new self;
        foreach ($variaveis as $nome => $valor) {
            $f->variaveis[strtolower((string) $nome)] = $valor;
        }

        return $f->executar($expressao);
    }

    /** Só a sintaxe (qualquer variável vale 1): para validar o que o mestre digita antes de salvar. */
    public static function sintaxeValida(string $expressao): bool
    {
        $f = new self;
        $f->resolvedor = fn (string $nome) => 1;
        try {
            $f->executar($expressao);

            return true;
        } catch (FormulaInvalida) {
            return false;
        }
    }

    private function executar(string $expressao): int|float
    {
        $limpa = strtolower((string) preg_replace('/\s+/', '', $expressao));
        if ($limpa === '') {
            throw new FormulaInvalida('Informe uma fórmula.');
        }
        if (strlen($limpa) > self::MAX_TAMANHO) {
            throw new FormulaInvalida('Fórmula longa demais (máximo '.self::MAX_TAMANHO.' caracteres).');
        }
        $this->s = $limpa;
        $this->i = 0;
        $this->profundidade = 0;

        $valor = $this->expr();
        if ($this->i < strlen($this->s)) {
            throw new FormulaInvalida("Não entendi \"{$this->s[$this->i]}\" na posição ".($this->i + 1).' da fórmula.');
        }

        return $valor;
    }

    private function expr(): int|float
    {
        $valor = $this->termo();
        while (($op = $this->olhar()) === '+' || $op === '-') {
            $this->i++;
            $direita = $this->termo();
            $valor = $this->normalizar($op === '+' ? $valor + $direita : $valor - $direita);
        }

        return $valor;
    }

    private function termo(): int|float
    {
        $valor = $this->fator();
        while (($op = $this->olhar()) === '*' || $op === '/') {
            $this->i++;
            $direita = $this->fator();
            if ($op === '*') {
                $valor = $this->normalizar($valor * $direita);
            } else {
                if ($direita == 0) {
                    throw new FormulaInvalida('Divisão por zero na fórmula.');
                }
                $valor = $this->normalizar(floor($valor / $direita));
            }
        }

        return $valor;
    }

    private function fator(): int|float
    {
        $c = $this->olhar();
        if ($c === '-' || $c === '+') {
            $this->i++;
            if (++$this->profundidade > self::MAX_PROFUNDIDADE) {
                throw new FormulaInvalida('Fórmula aninhada demais.');
            }
            $valor = $this->fator();
            $this->profundidade--;

            return $this->normalizar($c === '-' ? -$valor : $valor);
        }
        if ($c === '(') {
            $this->i++;

            return $this->entreParenteses();
        }
        if ($c === '@') {
            return $this->variavel();
        }
        if ($c !== null && ctype_digit($c)) {
            preg_match('/\G\d+/', $this->s, $m, 0, $this->i);
            $this->i += strlen($m[0]);

            return (int) $m[0];
        }
        if ($c !== null && ctype_alpha($c)) {
            return $this->funcao();
        }

        throw new FormulaInvalida($c === null ? 'A fórmula terminou antes do esperado.' : "Não entendi \"{$c}\" na posição ".($this->i + 1).' da fórmula.');
    }

    private function entreParenteses(): int|float
    {
        if (++$this->profundidade > self::MAX_PROFUNDIDADE) {
            throw new FormulaInvalida('Parênteses aninhados demais.');
        }
        $valor = $this->expr();
        $this->fechar();
        $this->profundidade--;

        return $valor;
    }

    private function fechar(): void
    {
        if ($this->olhar() !== ')') {
            throw new FormulaInvalida('Faltou fechar um parêntese.');
        }
        $this->i++;
    }

    private function variavel(): int|float
    {
        $this->i++; // '@'
        if (! preg_match('/\G[a-z0-9_.]+/', $this->s, $m, 0, $this->i)) {
            throw new FormulaInvalida('Variável sem nome depois de "@".');
        }
        $nome = $m[0];
        $this->i += strlen($nome);
        if ($this->resolvedor) {
            return ($this->resolvedor)($nome);
        }
        if (! array_key_exists($nome, $this->variaveis)) {
            throw new FormulaInvalida("Variável @{$nome} desconhecida.");
        }

        return $this->variaveis[$nome];
    }

    private function funcao(): int|float
    {
        preg_match('/\G[a-z]+/', $this->s, $m, 0, $this->i);
        $nome = $m[0];
        $this->i += strlen($nome);
        if (! in_array($nome, ['min', 'max', 'floor'], true)) {
            throw new FormulaInvalida("Função desconhecida: {$nome}.");
        }
        if ($this->olhar() !== '(') {
            throw new FormulaInvalida("Faltou \"(\" depois de {$nome}.");
        }
        $this->i++;
        if (++$this->profundidade > self::MAX_PROFUNDIDADE) {
            throw new FormulaInvalida('Parênteses aninhados demais.');
        }
        $args = [$this->expr()];
        while ($this->olhar() === ',') {
            $this->i++;
            if (count($args) >= self::MAX_ARGUMENTOS) {
                throw new FormulaInvalida('Argumentos demais na função.');
            }
            $args[] = $this->expr();
        }
        $this->fechar();
        $this->profundidade--;

        if ($nome === 'floor') {
            if (count($args) !== 1) {
                throw new FormulaInvalida('floor() recebe um único valor.');
            }

            return $this->normalizar(floor($args[0]));
        }

        return $this->normalizar($nome === 'min' ? min($args) : max($args));
    }

    private function olhar(): ?string
    {
        return $this->s[$this->i] ?? null;
    }

    /** Inteiros ficam inteiros (o JSON não guarda `3.0`). */
    private function normalizar(int|float $v): int|float
    {
        return is_float($v) && is_finite($v) && $v == floor($v) && abs($v) < 1e15 ? (int) $v : $v;
    }
}
