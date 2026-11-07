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

    public function test_ficha_padrao_tem_os_seis_atributos_e_as_vinte_pericias(): void
    {
        $f = FichaOnePiece::padrao();

        $this->assertSame(['for', 'des', 'con', 'sab', 'pre', 'von'], array_keys($f['atributos']));
        $this->assertCount(20, $f['pericias']);
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

    public function test_arma_de_gigante_so_cabe_em_gigante_e_a_comum_so_nos_demais(): void
    {
        $this->assertTrue(Regras::armaCabe(['tamanho' => 'gigante'], 'Enorme'));
        $this->assertFalse(Regras::armaCabe([], 'Enorme'));
        $this->assertFalse(Regras::armaCabe(['tamanho' => 'gigante'], 'Médio'));
        $this->assertTrue(Regras::armaCabe(['tamanho' => 'padrao'], 'Pequeno'));
    }

    public function test_acao_de_dano_leva_o_tipo_e_o_fator_da_arma_a_distancia_do_anao(): void
    {
        $ficha = FichaOnePiece::padrao();
        $ficha['inventario'] = [['secao' => 'E', 'itens' => [['item_id' => 7, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false]]]];
        $item = ['nome' => 'Pistola', 'peso' => 1, 'dados' => ['arma' => ['dano' => '1d10', 'atributo' => 'des', 'tipoDano' => 'perfurante', 'distancia' => true, 'proficiente' => true]]];
        $variaveis = ['arma.7.ataque' => 5, 'arma.7.dano' => 2, 'arma.7.margem' => 20, 'dano.distancia.pct' => 50];
        $termos = [['tipo' => 'variavel', 'nome' => 'arma.7.ataque', 'valor' => 5, 'sinal' => 1], ['tipo' => 'dados', 'faces' => 20, 'resultados' => [12], 'descartados' => [], 'subtotal' => 12, 'sinal' => 1]];

        $meta = Regras::metadadosDaRolagem($termos, $variaveis, [7 => $item], $ficha);

        $this->assertSame(['tipo' => 'perfurante', 'fator' => 0.5], $meta['acoes'][0]['dano']);
        $normal = Regras::metadadosDaRolagem($termos, [...$variaveis, 'dano.distancia.pct' => 100], [7 => $item], $ficha);
        $this->assertSame(['tipo' => 'perfurante'], $normal['acoes'][0]['dano']); // sem fator quando vale o dano inteiro
    }

    public function test_calcula_alcance_movimento_e_percentual_de_dano_a_distancia(): void
    {
        $f = FichaOnePiece::padrao();
        $f['movimento'] = ['normal' => 9, 'nado' => 4.5, 'escalada' => 0, 'voo' => 0];
        $r = Regras::calcular($f);

        $this->assertSame([15, 90, 45, 0, 100], [$r['alcance.corpo'], $r['movimento.normal'], $r['movimento.nado'], $r['movimento.voo'], $r['dano.distancia.pct']]);
    }
}
