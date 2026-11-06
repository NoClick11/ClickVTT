<?php

namespace Tests\Unit\Nucleo;

use App\Sistemas\Dnd5e\Condicoes;
use App\Sistemas\Dnd5e\Dnd5e;
use App\Sistemas\Dnd5e\FichaDnd5e;
use App\Sistemas\Dnd5e\Regras;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Os mesmos casos rodam no TS (`npm run test:regras`): as duas implementações têm de bater com o esperado. */
class Dnd5eRegrasTest extends TestCase
{
    public static function casos(): array
    {
        $casos = json_decode(file_get_contents(__DIR__.'/../../paridade/dnd5e.json'), true, flags: JSON_THROW_ON_ERROR);

        return array_column(array_map(fn ($c) => [$c['nome'], $c], $casos), null, 0);
    }

    #[DataProvider('casos')]
    public function test_calculo_confere_com_o_caso_de_paridade(string $nome, array $caso): void
    {
        $itens = [];
        foreach ($caso['itens'] ?? [] as $id => $item) {
            $itens[(int) $id] = $item + ['id' => (int) $id];
        }
        $calculado = Regras::calcular($caso['ficha'], $itens);

        if (! ($caso['parcial'] ?? false)) {
            $this->assertEqualsCanonicalizing(array_keys($caso['esperado']), array_keys($calculado), 'chaves diferentes');
        }
        if (isset($caso['efeitosAtivos'])) {
            $this->assertEquals($caso['efeitosAtivos'], Regras::efeitosAtivos($caso['ficha'], $itens), "{$nome}: efeitos ativos");
        }
        foreach ($caso['esperado'] as $chave => $valor) {
            $this->assertArrayHasKey($chave, $calculado, "{$nome}: falta {$chave}");
            $this->assertEqualsWithDelta($valor, $calculado[$chave], 0.0001, "{$nome}: {$chave}");
        }
    }

    public function test_modificador_arredonda_para_baixo(): void
    {
        $this->assertSame([-5, -1, 0, 0, 1, 10], array_map(Regras::modificador(...), [1, 8, 10, 11, 12, 30]));
    }

    public function test_ficha_padrao_calcula_sem_erro_e_tem_o_basico(): void
    {
        $r = Regras::calcular(FichaDnd5e::padrao());

        $this->assertSame(2, $r['prof']);
        $this->assertSame(10, $r['ca']);
        $this->assertSame(0, $r['iniciativa']);
        $this->assertSame(150, $r['carga.max']);
        $this->assertSame(300, $r['xp.proximo']);
    }

    private static function d20(int ...$resultados): array
    {
        return ['tipo' => 'dados', 'faces' => 20, 'resultados' => $resultados, 'descartados' => [], 'subtotal' => 0, 'sinal' => 1];
    }

    private static function ataque(int $arma = 7): array
    {
        return ['tipo' => 'variavel', 'nome' => "arma.{$arma}.ataque", 'valor' => 5, 'sinal' => 1];
    }

    public function test_d20_puro_na_margem_da_arma_e_critico(): void
    {
        $vars = ['arma.7.margem' => 19];

        $this->assertSame(['arma' => 7, 'margem' => 19, 'destaque' => 'critico'], Regras::metadadosDaRolagem([self::d20(19), self::ataque()], $vars));
        $this->assertSame(['arma' => 7, 'margem' => 19, 'destaque' => 'critico'], Regras::metadadosDaRolagem([self::d20(20), self::ataque()], $vars));
        $this->assertSame(['arma' => 7, 'margem' => 19], Regras::metadadosDaRolagem([self::d20(18), self::ataque()], $vars)); // arma, mas sem crítico
    }

    public function test_margem_padrao_e_20_e_o_1_e_falha(): void
    {
        $this->assertSame(['arma' => 7, 'margem' => 20], Regras::metadadosDaRolagem([self::d20(19), self::ataque()], ['arma.7.margem' => 20]));
        $this->assertSame('critico', Regras::metadadosDaRolagem([self::d20(20), self::ataque()], ['arma.7.margem' => 20])['destaque']);
        $this->assertSame('falha', Regras::metadadosDaRolagem([self::d20(1), self::ataque()], ['arma.7.margem' => 18])['destaque']);
        $this->assertSame(20, Regras::metadadosDaRolagem([self::d20(10), self::ataque()], [])['margem']); // sem a variável: 20
    }

    public function test_vantagem_e_desvantagem_olham_o_dado_mantido(): void
    {
        $vars = ['arma.7.margem' => 19];
        // 2d20kh1: o 19 foi mantido (o 4 descartado) → crítico. 2d20kl1: ficou o 4 (o 19 descartado) → não é.
        $vantagem = ['tipo' => 'dados', 'faces' => 20, 'resultados' => [4, 19], 'descartados' => [0], 'subtotal' => 19, 'sinal' => 1];
        $desvantagem = ['tipo' => 'dados', 'faces' => 20, 'resultados' => [4, 19], 'descartados' => [1], 'subtotal' => 4, 'sinal' => 1];

        $this->assertSame('critico', Regras::metadadosDaRolagem([$vantagem, self::ataque()], $vars)['destaque']);
        $this->assertArrayNotHasKey('destaque', Regras::metadadosDaRolagem([$desvantagem, self::ataque()], $vars));
    }

    public function test_so_ataque_com_arma_e_marcado(): void
    {
        $this->assertSame([], Regras::metadadosDaRolagem([self::d20(20), ['tipo' => 'variavel', 'nome' => 'pericia.percepcao', 'valor' => 3, 'sinal' => 1]], []));
        $this->assertSame([], Regras::metadadosDaRolagem([self::d20(20), ['tipo' => 'variavel', 'nome' => 'arma.7.dano', 'valor' => 3, 'sinal' => 1]], []));
        $this->assertSame([], Regras::metadadosDaRolagem([self::d20(20)], []));
    }

    public function test_catalogo_de_condicoes_confere_com_a_referencia(): void
    {
        $esperado = json_decode(file_get_contents(__DIR__.'/../../paridade/condicoes-dnd5e.json'), true, flags: JSON_THROW_ON_ERROR);

        $this->assertSame($esperado, Condicoes::catalogo());
    }

    public function test_condicao_desconhecida_nao_gera_efeito_e_usa_o_id_como_nome(): void
    {
        $this->assertSame([], Condicoes::efeitosDe('zumbificado'));
        $this->assertSame('zumbificado', Condicoes::nomeDe('zumbificado'));
        $this->assertSame('Enfeitiçado', Condicoes::nomeDe('enfeiticado'));
    }

    public function test_alvos_de_efeito_conferem_com_a_referencia(): void
    {
        $esperado = json_decode(file_get_contents(__DIR__.'/../../paridade/alvos-dnd5e.json'), true, flags: JSON_THROW_ON_ERROR);
        $alvos = (new Dnd5e)->alvosDeEfeito();
        sort($alvos);

        $this->assertSame($esperado, $alvos);
        $this->assertSame($alvos, array_values(array_unique($alvos)), 'alvos repetidos');
    }
}
