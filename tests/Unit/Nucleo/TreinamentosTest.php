<?php

namespace Tests\Unit\Nucleo;

use App\Sistemas\OnePiece\Haki;
use App\Sistemas\OnePiece\Treinamentos;
use PHPUnit\Framework\TestCase;

/** O espelho PHP das regras de Treinamentos: roda os mesmos casos de `tests/paridade/treinamentos.json` que o TS. */
class TreinamentosTest extends TestCase
{
    /** @return array{resumo: list<array<string, mixed>>, pedidos: list<array<string, mixed>>} */
    private static function casos(): array
    {
        return json_decode(file_get_contents(__DIR__.'/../../paridade/treinamentos.json'), true, flags: JSON_THROW_ON_ERROR);
    }

    /** @return iterable<string, array{0: array<string, mixed>}> */
    public static function resumos(): iterable
    {
        foreach (self::casos()['resumo'] as $c) {
            yield $c['nome'] => [$c];
        }
    }

    /** @return iterable<string, array{0: array<string, mixed>}> */
    public static function pedidos(): iterable
    {
        foreach (self::casos()['pedidos'] as $c) {
            yield $c['nome'] => [$c];
        }
    }

    /** @param array<string, mixed> $caso */
    #[\PHPUnit\Framework\Attributes\DataProvider('resumos')]
    public function test_resumo_confere_com_a_referencia(array $caso): void
    {
        $r = Treinamentos::resumoDosPT($caso['ficha']);
        foreach ($caso['esperado'] as $chave => $valor) {
            $this->assertSame($valor, $r[$chave], $chave);
        }
    }

    /** @param array<string, mixed> $caso */
    #[\PHPUnit\Framework\Attributes\DataProvider('pedidos')]
    public function test_pedido_confere_com_a_referencia(array $caso): void
    {
        $m = Treinamentos::problemasDoPedido($caso['ficha'], $caso['id'], $caso['opcao']);
        $this->assertSame($caso['invalido'], $m !== [], implode(' | ', $m));
    }

    public function test_iniciada_em_haki_entra_no_saldo_de_pa(): void
    {
        $ficha = ['nivel' => 8, 'haki' => Haki::padrao(), 'treinamento' => ['aprendidos' => [['id' => 'iniciada-em-haki', 'nivel' => 5]]]];
        $this->assertSame(9, Treinamentos::paDeHaki($ficha));
        $this->assertSame(5 + 9, Haki::resumoDosPA($ficha)['ganhosGerais']);
    }

    public function test_o_catalogo_tem_51_treinamentos(): void
    {
        $this->assertCount(51, Treinamentos::catalogo()['treinamentos']);
        $this->assertNull(Treinamentos::treinamento('inventado'));
    }
}
