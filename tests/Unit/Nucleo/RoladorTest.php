<?php

namespace Tests\Unit\Nucleo;

use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Rolagem\RolagemInvalida;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

class RoladorTest extends TestCase
{
    /** Rolador que devolve os valores da fila, na ordem (limitados às faces). */
    private function fixo(int ...$valores): Rolador
    {
        return new Rolador(function (int $faces) use (&$valores): int {
            return min($faces, array_shift($valores) ?? 1);
        });
    }

    public function test_soma_dados_e_modificador(): void
    {
        $r = $this->fixo(12)->rolar('1d20 + 5');

        $this->assertSame('1d20+5', $r['expressao']);
        $this->assertSame(17, $r['total']);
        $this->assertSame('dados', $r['termos'][0]['tipo']);
        $this->assertSame([12], $r['termos'][0]['resultados']);
        $this->assertSame(20, $r['termos'][0]['faces']);
        $this->assertSame(['tipo' => 'numero', 'valor' => 5, 'sinal' => 1], $r['termos'][1]);
    }

    public function test_dado_sem_quantidade_vale_um_e_maiusculas_sao_ignoradas(): void
    {
        $r = $this->fixo(4)->rolar('D8');

        $this->assertSame(4, $r['total']);
        $this->assertSame('d8', $r['termos'][0]['expressao']);
    }

    public function test_subtracao_marca_o_sinal_do_termo(): void
    {
        $r = $this->fixo(10)->rolar('1d20-3');

        $this->assertSame(7, $r['total']);
        $this->assertSame(-1, $r['termos'][1]['sinal']);
    }

    public function test_vantagem_mantem_o_maior_e_descarta_o_outro(): void
    {
        $r = $this->fixo(7, 15)->rolar('2d20kh1');

        $this->assertSame(15, $r['total']);
        $this->assertSame([0], $r['termos'][0]['descartados']);
        $this->assertSame(15, $r['termos'][0]['subtotal']);
    }

    public function test_desvantagem_mantem_o_menor(): void
    {
        $r = $this->fixo(7, 15)->rolar('2d20kl');

        $this->assertSame(7, $r['total']);
        $this->assertSame([1], $r['termos'][0]['descartados']);
    }

    public function test_4d6_descartando_o_menor(): void
    {
        $r = $this->fixo(3, 6, 2, 5)->rolar('4d6kh3');

        $this->assertSame(14, $r['total']);
        $this->assertSame([2], $r['termos'][0]['descartados']);

        $r = $this->fixo(3, 6, 2, 5)->rolar('4d6dl1');
        $this->assertSame(14, $r['total']);
    }

    public function test_dados_explosivos_rolam_de_novo_no_valor_maximo(): void
    {
        $r = $this->fixo(6, 3, 4)->rolar('2d6!');

        $this->assertSame([6, 3, 4], $r['termos'][0]['resultados']);
        $this->assertSame(13, $r['total']);
    }

    public function test_variaveis_vem_do_chamador(): void
    {
        $r = $this->fixo(10)->rolar('1d20+@For+@pericia.percepcao', ['for' => 3, 'pericia.percepcao' => 5]);

        $this->assertSame(18, $r['total']);
        $this->assertSame(['tipo' => 'variavel', 'nome' => 'for', 'valor' => 3, 'sinal' => 1], $r['termos'][1]);
    }

    public function test_variavel_desconhecida_e_rejeitada(): void
    {
        $this->expectException(RolagemInvalida::class);
        $this->expectExceptionMessage('@for');

        $this->fixo(1)->rolar('1d20+@for');
    }

    public function test_precedencia_parenteses_e_divisao_inteira(): void
    {
        $this->assertSame(14, $this->fixo()->rolar('2+3*4')['total']);
        $this->assertSame(20, $this->fixo()->rolar('(2+3)*4')['total']);
        $this->assertSame(3, $this->fixo()->rolar('7/2')['total']);
        $this->assertSame(-4, $this->fixo()->rolar('-7/2')['total']); // para baixo
        $this->assertSame(-3, $this->fixo()->rolar('-(1+2)')['total']);
    }

    public function test_sorteio_real_fica_dentro_do_intervalo(): void
    {
        $rolador = new Rolador;
        for ($n = 0; $n < 200; $n++) {
            $r = $rolador->rolar('3d6');
            foreach ($r['termos'][0]['resultados'] as $v) {
                $this->assertGreaterThanOrEqual(1, $v);
                $this->assertLessThanOrEqual(6, $v);
            }
            $this->assertSame(array_sum($r['termos'][0]['resultados']), $r['total']);
        }
    }

    #[DataProvider('invalidas')]
    public function test_expressoes_invalidas_sao_rejeitadas(string $expressao): void
    {
        $this->expectException(RolagemInvalida::class);

        (new Rolador)->rolar($expressao);
    }

    public static function invalidas(): array
    {
        return [
            'vazia' => [''],
            'so espacos' => ['   '],
            'sem faces' => ['2d'],
            'faces demais' => ['1d1001'],
            'um so lado' => ['1d1'],
            'dados demais no termo' => ['101d6'],
            'zero dados' => ['0d6'],
            'lixo' => ['abc'],
            'operador solto' => ['1d20+'],
            'parentese aberto' => ['(1d20+2'],
            'parentese sobrando' => ['1d20)'],
            'divisao por zero' => ['1d20/0'],
            'variavel sem nome' => ['1d20+@'],
            'longa demais' => [str_repeat('1+', 60).'1'],
            'dados demais no total' => ['100d6+100d6+1d6'],
        ];
    }
}
