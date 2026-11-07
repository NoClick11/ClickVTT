<?php

namespace App\Nucleo\Rolagem;

use Closure;

/**
 * Núcleo de rolagem, independente de sistema: interpreta uma expressão de dados e a avalia.
 *
 * Gramática (espaços e maiúsculas são ignorados):
 *   rolagem := expr ('|' NUMERO)? ('^' 2|3)?    (`|N`: a soma dos DADOS não passa de N; `^2`: rola tudo 2 vezes e fica a maior)
 *   expr    := termo (('+' | '-') termo)*
 *   termo   := fator (('*' | '/') fator)*        (divisão inteira, arredondada para baixo)
 *   fator   := '-' fator | '(' expr ')' | NUMERO | dados | '@' variavel
 *   dados   := NUMERO? 'd' FACES modificador*
 *   modif.  := 'kh' N? | 'k' N? | 'kl' N? | 'dh' N? | 'dl' N? | '!'
 *
 * Exemplos: `1d20+5`, `2d20kh1` (vantagem), `4d6kh3`, `1d8+@for`, `2d6!`, `6d10+3|40` (dados limitados a 40, mais 3).
 * As variáveis (`@for`, `@pericia.percepcao`) vêm do SISTEMA, nunca do cliente: o núcleo só as substitui.
 *
 * O resultado é uma lista de `termos` (cada dado, número e variável, na ordem em que aparecem) e o `total`.
 */
class Rolador
{
    public const MAX_EXPRESSAO = 100;

    public const MAX_DADOS_POR_TERMO = 100;

    public const MAX_DADOS_TOTAL = 200;

    public const MIN_FACES = 2;

    public const MAX_FACES = 1000;

    public const MAX_EXPLOSOES = 20;

    private string $s = '';

    private int $i = 0;

    private int $dadosRolados = 0;

    private int $profundidade = 0;

    /** @var array<int, array<string, mixed>> */
    private array $termos = [];

    /** @var array<string, int> */
    private array $variaveis = [];

    /** @param Closure(int): int|null $sorteio devolve um inteiro de 1 a $faces (injetável nos testes) */
    public function __construct(private readonly ?Closure $sorteio = null) {}

    /**
     * @param  array<string, int|float>  $variaveis  nome (sem `@`, minúsculo) => valor
     * @return array{expressao: string, termos: array<int, array<string, mixed>>, total: int, limite?: array{max: int, soma: int}, repeticoes?: list<int>, escolhida?: int}
     *
     * @throws RolagemInvalida
     */
    public function rolar(string $expressao, array $variaveis = []): array
    {
        $limpa = strtolower((string) preg_replace('/\s+/', '', $expressao));
        if ($limpa === '') {
            throw new RolagemInvalida('Informe uma expressão de rolagem.');
        }
        if (strlen($limpa) > self::MAX_EXPRESSAO) {
            throw new RolagemInvalida('Expressão longa demais (máximo '.self::MAX_EXPRESSAO.' caracteres).');
        }

        // `^N` no fim (2 ou 3): a expressão inteira é rolada N vezes e fica a MAIOR (ex.: a Saijo Ô Wazamono rola o dano duas vezes).
        $vezes = 1;
        if (preg_match('/\^(\d)$/', $limpa, $m)) {
            $vezes = (int) $m[1];
            if ($vezes < 2 || $vezes > 3) {
                throw new RolagemInvalida('Use "^2" ou "^3" para rolar a expressão 2 ou 3 vezes e ficar com a maior.');
            }
            $limpa = substr($limpa, 0, -2);
        }
        $this->dadosRolados = 0;
        $this->variaveis = [];
        foreach ($variaveis as $nome => $valor) {
            $this->variaveis[strtolower((string) $nome)] = (int) round($valor);
        }
        $tentativas = [];
        for ($n = 0; $n < $vezes; $n++) {
            $tentativas[] = $this->avaliar($limpa);
        }
        $melhor = 0;
        foreach ($tentativas as $idx => $t) {
            if ($t['total'] > $tentativas[$melhor]['total']) {
                $melhor = $idx;
            }
        }
        $r = $tentativas[$melhor];

        return [
            'expressao' => $limpa.($vezes > 1 ? "^{$vezes}" : ''), 'termos' => $r['termos'], 'total' => $r['total'],
            ...($r['limite'] ? ['limite' => $r['limite']] : []),
            ...($vezes > 1 ? ['repeticoes' => array_column($tentativas, 'total'), 'escolhida' => $melhor] : []),
        ];
    }

    /** @return array{termos: array<int, array<string, mixed>>, total: int, limite: array{max: int, soma: int}|null} */
    private function avaliar(string $limpa): array
    {
        $this->s = $limpa;
        $this->i = 0;
        $this->profundidade = 0;
        $this->termos = [];

        $total = $this->expr(1);
        // `|N` no fim: a soma dos dados fica limitada a N (o bônus fixo não conta). Ex.: os dados extras de uma arma Meito só
        // ajudam a Técnica a chegar ao máximo dela.
        $limite = null;
        if ($this->olhar() === '|') {
            $this->i++;
            $max = $this->digitos();
            if ($max === '') {
                throw new RolagemInvalida('Faltou o número depois de "|".');
            }
            $soma = 0;
            foreach ($this->termos as $t) {
                if (($t['tipo'] ?? null) === 'dados') {
                    $soma += $t['sinal'] * $t['subtotal'];
                }
            }
            $limite = ['max' => (int) $max, 'soma' => $soma];
            if ($soma > (int) $max) {
                $total -= $soma - (int) $max;
            }
        }
        if ($this->i < strlen($this->s)) {
            throw new RolagemInvalida("Não entendi \"{$this->s[$this->i]}\" na posição ".($this->i + 1).' da expressão.');
        }

        return ['termos' => $this->termos, 'total' => $total, 'limite' => $limite];
    }

    private function expr(int $sinal): int
    {
        $valor = $this->termo($sinal);
        while (($op = $this->olhar()) === '+' || $op === '-') {
            $this->i++;
            $direita = $this->termo($op === '-' ? -$sinal : $sinal);
            $valor = $op === '+' ? $valor + $direita : $valor - $direita;
        }

        return $valor;
    }

    private function termo(int $sinal): int
    {
        $valor = $this->fator($sinal);
        while (($op = $this->olhar()) === '*' || $op === '/') {
            $this->i++;
            $direita = $this->fator($sinal);
            if ($op === '*') {
                $valor *= $direita;
            } else {
                if ($direita === 0) {
                    throw new RolagemInvalida('Divisão por zero na expressão.');
                }
                $valor = (int) floor($valor / $direita);
            }
        }

        return $valor;
    }

    private function fator(int $sinal): int
    {
        $c = $this->olhar();
        if ($c === '-') {
            $this->i++;

            return -$this->fator(-$sinal);
        }
        if ($c === '(') {
            $this->i++;
            if (++$this->profundidade > 10) {
                throw new RolagemInvalida('Parênteses aninhados demais.');
            }
            $valor = $this->expr($sinal);
            if ($this->olhar() !== ')') {
                throw new RolagemInvalida('Faltou fechar um parêntese.');
            }
            $this->i++;
            $this->profundidade--;

            return $valor;
        }
        if ($c === '@') {
            return $this->variavel($sinal);
        }

        $inicio = $this->i;
        $digitos = $this->digitos();
        if ($this->olhar() === 'd') {
            return $this->dados($digitos === '' ? 1 : (int) $digitos, $inicio, $sinal);
        }
        if ($digitos === '') {
            throw new RolagemInvalida($c === null ? 'A expressão terminou antes do esperado.' : "Não entendi \"{$c}\" na posição ".($this->i + 1).' da expressão.');
        }
        $valor = (int) $digitos;
        $this->termos[] = ['tipo' => 'numero', 'valor' => $valor, 'sinal' => $sinal];

        return $valor;
    }

    private function variavel(int $sinal): int
    {
        $this->i++; // '@'
        if (! preg_match('/\G[a-z0-9_.]+/', $this->s, $m, 0, $this->i)) {
            throw new RolagemInvalida('Variável sem nome depois de "@".');
        }
        $nome = $m[0];
        $this->i += strlen($nome);
        if (! array_key_exists($nome, $this->variaveis)) {
            throw new RolagemInvalida("Variável @{$nome} desconhecida neste sistema.");
        }
        $valor = $this->variaveis[$nome];
        $this->termos[] = ['tipo' => 'variavel', 'nome' => $nome, 'valor' => $valor, 'sinal' => $sinal];

        return $valor;
    }

    private function dados(int $quantidade, int $inicio, int $sinal): int
    {
        $this->i++; // 'd'
        $faces = $this->digitos();
        if ($faces === '') {
            throw new RolagemInvalida('Faltou o número de faces depois de "d".');
        }
        $faces = (int) $faces;
        if ($quantidade < 1 || $quantidade > self::MAX_DADOS_POR_TERMO) {
            throw new RolagemInvalida('Use de 1 a '.self::MAX_DADOS_POR_TERMO.' dados por termo.');
        }
        if ($faces < self::MIN_FACES || $faces > self::MAX_FACES) {
            throw new RolagemInvalida('Um dado precisa ter de '.self::MIN_FACES.' a '.self::MAX_FACES.' faces.');
        }

        $manter = null; // ['alto'|'baixo', n]
        $explode = false;
        while (true) {
            if ($this->consome('!')) {
                $explode = true;
            } elseif ($this->consome('kh') || $this->consome('k')) {
                $manter = ['alto', $this->numeroOpcional(1)];
            } elseif ($this->consome('kl')) {
                $manter = ['baixo', $this->numeroOpcional(1)];
            } elseif ($this->consome('dh')) {
                $manter = ['baixo', max(0, $quantidade - $this->numeroOpcional(1))]; // descarta os maiores
            } elseif ($this->consome('dl')) {
                $manter = ['alto', max(0, $quantidade - $this->numeroOpcional(1))]; // descarta os menores
            } else {
                break;
            }
        }

        $resultados = [];
        for ($n = 0; $n < $quantidade; $n++) {
            $resultados[] = $this->sortear($faces);
        }
        if ($explode) {
            $extras = 0;
            for ($n = 0; $n < count($resultados) && $extras < self::MAX_EXPLOSOES; $n++) {
                if ($resultados[$n] === $faces) {
                    $resultados[] = $this->sortear($faces);
                    $extras++;
                }
            }
        }

        $descartados = [];
        if ($manter !== null) {
            [$lado, $n] = $manter;
            $indices = array_keys($resultados);
            usort($indices, fn ($a, $b) => $lado === 'alto' ? $resultados[$b] <=> $resultados[$a] : $resultados[$a] <=> $resultados[$b]);
            $descartados = array_slice($indices, min($n, count($indices)));
            sort($descartados);
        }
        $subtotal = 0;
        foreach ($resultados as $idx => $v) {
            if (! in_array($idx, $descartados, true)) {
                $subtotal += $v;
            }
        }

        $this->termos[] = [
            'tipo' => 'dados',
            'expressao' => substr($this->s, $inicio, $this->i - $inicio),
            'faces' => $faces,
            'resultados' => $resultados,
            'descartados' => $descartados,
            'subtotal' => $subtotal,
            'sinal' => $sinal,
        ];

        return $subtotal;
    }

    private function sortear(int $faces): int
    {
        if (++$this->dadosRolados > self::MAX_DADOS_TOTAL) {
            throw new RolagemInvalida('Dados demais na mesma rolagem (máximo '.self::MAX_DADOS_TOTAL.').');
        }

        return $this->sorteio ? ($this->sorteio)($faces) : random_int(1, $faces);
    }

    private function olhar(): ?string
    {
        return $this->s[$this->i] ?? null;
    }

    private function digitos(): string
    {
        return preg_match('/\G\d+/', $this->s, $m, 0, $this->i) ? tap($m[0], fn ($d) => $this->i += strlen($d)) : '';
    }

    private function consome(string $texto): bool
    {
        if (substr($this->s, $this->i, strlen($texto)) !== $texto) {
            return false;
        }
        // "k"/"d" só valem como modificador; "kh" e "kl" têm prioridade sobre "k".
        if ($texto === 'k' && in_array(substr($this->s, $this->i + 1, 1), ['h', 'l'], true)) {
            return false;
        }
        $this->i += strlen($texto);

        return true;
    }

    private function numeroOpcional(int $padrao): int
    {
        $d = $this->digitos();

        return $d === '' ? $padrao : (int) $d;
    }
}
