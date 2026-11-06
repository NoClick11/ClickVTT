<?php

namespace Tests\Unit\Nucleo;

use App\Sistemas\OnePiece\Condicoes;
use App\Sistemas\OnePiece\FichaOnePiece;
use App\Sistemas\OnePiece\OnePiece;
use App\Sistemas\OnePiece\Regras;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Os mesmos casos rodam no TS (`npm run test:regras`): as duas implementações têm de bater com o esperado. */
class OnePieceRegrasTest extends TestCase
{
    public static function casos(): array
    {
        $casos = json_decode(file_get_contents(__DIR__.'/../../paridade/onepiece.json'), true, flags: JSON_THROW_ON_ERROR);

        return array_column(array_map(fn ($c) => [$c['nome'], $c], $casos), null, 0);
    }

    #[DataProvider('casos')]
    public function test_calculo_confere_com_o_caso_de_paridade(string $nome, array $caso): void
    {
        $calculado = Regras::calcular($caso['ficha'], []);

        foreach ($caso['esperado'] as $chave => $valor) {
            $this->assertArrayHasKey($chave, $calculado, "{$nome}: falta {$chave}");
            $this->assertEqualsWithDelta($valor, $calculado[$chave], 0.0001, "{$nome}: {$chave}");
        }
    }

    public function test_ficha_padrao_tem_os_seis_atributos_e_as_dezenove_pericias(): void
    {
        $f = FichaOnePiece::padrao();

        $this->assertSame(['for', 'des', 'con', 'sab', 'pre', 'von'], array_keys($f['atributos']));
        $this->assertCount(19, $f['pericias']);
        $this->assertSame('von', FichaOnePiece::PERICIAS['haki']);
        $this->assertSame('pre', FichaOnePiece::PERICIAS['provocacao']);
        $this->assertArrayNotHasKey('morte', $f);
        $this->assertArrayNotHasKey('magias', $f);
        $this->assertArrayNotHasKey('moedas', $f);
        $this->assertSame(['atual' => 0, 'porNivel' => 4], $f['pp']);
    }

    public function test_pontos_de_poder_sao_quatro_ou_cinco_por_nivel(): void
    {
        $f = FichaOnePiece::padrao();
        $f['nivel'] = 10;
        $this->assertSame(40, Regras::calcular($f)['pp.max']);

        $f['pp']['porNivel'] = 5;
        $this->assertSame(50, Regras::calcular($f)['pp.max']);
    }

    public function test_regras_aceitam_so_quatro_ou_cinco_pp_por_nivel_e_recompensa_inteira(): void
    {
        $r = FichaOnePiece::regras();

        $this->assertArrayHasKey('pp.porNivel', $r);
        $this->assertArrayHasKey('recompensa', $r);
        $this->assertArrayHasKey('belly', $r);
        $this->assertArrayHasKey('tecnicas.lista.*.custo', $r);
        $this->assertArrayHasKey('akuma.lista.*.custo', $r);
        $this->assertArrayHasKey('akuma.tipo', $r);
        $this->assertArrayNotHasKey('morte.sucessos', $r);
        $this->assertArrayNotHasKey('moedas.po', $r);
    }

    public function test_catalogo_de_condicoes_confere_com_a_referencia(): void
    {
        $esperado = json_decode(file_get_contents(__DIR__.'/../../paridade/condicoes-onepiece.json'), true, flags: JSON_THROW_ON_ERROR);

        $this->assertSame($esperado, Condicoes::catalogo());
    }

    public function test_alvos_de_efeito_conferem_com_a_referencia(): void
    {
        $esperado = json_decode(file_get_contents(__DIR__.'/../../paridade/alvos-onepiece.json'), true, flags: JSON_THROW_ON_ERROR);
        $alvos = (new OnePiece)->alvosDeEfeito();
        sort($alvos);

        $this->assertSame($esperado, $alvos);
        $this->assertContains('pp.max', $alvos);
        $this->assertSame($alvos, array_values(array_unique($alvos)), 'alvos repetidos');
    }

    public function test_slug_do_modulo(): void
    {
        $this->assertSame('one-piece', OnePiece::slug());
    }
}
