<?php

namespace Tests\Unit\Nucleo;

use App\Sistemas\OnePiece\Haki;
use PHPUnit\Framework\TestCase;

/** O espelho PHP das regras do Haki: roda os mesmos casos de `tests/paridade/haki.json` que o TS. */
class HakiTest extends TestCase
{
    /** @return iterable<string, array{0: array<string, mixed>}> */
    public static function casos(): iterable
    {
        foreach (json_decode(file_get_contents(__DIR__.'/../../paridade/haki.json'), true, flags: JSON_THROW_ON_ERROR) as $caso) {
            yield $caso['nome'] => [$caso];
        }
    }

    /** @param array<string, mixed> $caso */
    #[\PHPUnit\Framework\Attributes\DataProvider('casos')]
    public function test_confere_com_a_referencia(array $caso): void
    {
        $ficha = ['nivel' => $caso['nivel'], 'haki' => $caso['haki']];
        $r = Haki::resumoDosPA($ficha);

        $this->assertSame($caso['esperado']['ganhosGerais'], $r['ganhosGerais']);
        $this->assertSame($caso['esperado']['gastoGeral'], $r['gastoGeral']);
        $this->assertSame($caso['esperado']['disponiveis'], $r['disponiveis']);
        $this->assertSame($caso['esperado']['estagio'], Haki::estagio($ficha));
        $this->assertSame($caso['esperado']['invalido'], Haki::problemas($ficha) !== [], implode(' | ', Haki::problemas($ficha)));
    }

    public function test_o_catalogo_tem_os_40_talentos(): void
    {
        $this->assertCount(40, Haki::catalogo()['talentos']);
        $this->assertSame('armamento', Haki::talento('ataque-infuso')['tipo']);
        $this->assertNull(Haki::talento('inexistente'));
    }
}
