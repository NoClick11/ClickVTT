<?php

namespace Tests\Unit\Nucleo;

use App\Nucleo\Combate\Dano;
use App\Sistemas\OnePiece\FichaOnePiece;
use App\Sistemas\OnePiece\Forja;
use App\Sistemas\OnePiece\Regras;
use PHPUnit\Framework\TestCase;

/** Meito, Fio, Expertise e custo de PF no servidor (os mesmos números de `tests/paridade/forja.test.mjs`). */
class ForjaTest extends TestCase
{
    public function test_dano_com_meito_e_fio(): void
    {
        $this->assertSame('1d6', Forja::danoComForja('1d4', ['meito' => 'wazamono']));
        $this->assertSame('1d8', Forja::danoComForja('1d8', ['meito' => 'wazamono']));
        $this->assertSame('2d6', Forja::danoComForja('2d6', ['meito' => 'ryo-wazamono']));
        $this->assertSame('1d12', Forja::danoComForja('1d6', ['meito' => 'saijo-o-wazamono']));
        $this->assertSame('1d8', Forja::danoComForja('1d6', ['fio' => 1]));
        $this->assertSame('3d6', Forja::danoComForja('1d6', ['fio' => 7]));
        $this->assertSame('1d12', Forja::danoComForja('1d4', ['meito' => 'ryo-wazamono', 'fio' => 2]));
        $this->assertSame('3d10', Forja::danoComForja('3d10', ['fio' => 2]));
    }

    public function test_custo_em_pf_igual_ao_ts(): void
    {
        $this->assertSame(2, Forja::custoEmPF(null, ['meito' => 'wazamono'])['total']);
        $this->assertSame(2, Forja::custoEmPF(['meito' => 'wazamono'], ['meito' => 'ryo-wazamono'])['total']);
        $this->assertSame(10, Forja::custoEmPF([], ['meito' => 'saijo-o-wazamono'])['total']);
        $this->assertSame(1, Forja::custoEmPF(['expertise' => ['katana']], ['expertise' => ['sangramento']])['total']);
        $this->assertSame(2, Forja::custoEmPF(['expertise' => ['sangramento']], ['expertise' => ['sangramento', 'caido']])['total']);
        $this->assertSame(1, Forja::custoEmPF([], ['expertise' => ['caido']])['total']);
        $this->assertSame(8, Forja::custoEmPF([], ['densidade' => 'cortante', 'dureza' => true, 'balanco' => true, 'fio' => 2])['total']);
        $this->assertNull(Forja::custoEmPF(['meito' => 'o-wazamono'], ['meito' => 'wazamono']));
        $this->assertNull(Forja::custoEmPF(['fio' => 2], ['fio' => 1]));
        $this->assertSame(20000, Forja::custoEmDinheiro(70000));
        $this->assertSame(30000, Forja::custoEmDinheiro(150000));
    }

    public function test_validacao_da_forja(): void
    {
        $this->assertSame([], Forja::problemas(['meito' => 'wazamono', 'yoto' => 'azar-mortal', 'expertise' => ['caido', 'sangramento'], 'densidade' => 'cortante', 'balanco' => true, 'fio' => 3]));
        $this->assertNotEmpty(Forja::problemas(['meito' => 'wazamono'], false));
        $this->assertNotEmpty(Forja::problemas(['kokuto' => true]));
        $this->assertNotEmpty(Forja::problemas(['yoto' => 'azar-mortal']));
        $this->assertNotEmpty(Forja::problemas(['balanco' => true]));
        $this->assertNotEmpty(Forja::problemas(['expertise' => ['caido', 'sangramento', 'impedido']]));
    }

    private function cenario(array $arma): array
    {
        $ficha = array_replace_recursive(FichaOnePiece::padrao(), [
            'nivel' => 5, 'atributos' => ['for' => 14, 'des' => 16],
            'inventario' => [['secao' => 'Equipamento', 'itens' => [['item_id' => 1, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false]]]],
        ]);
        $itens = [1 => ['nome' => 'Lâmina', 'peso' => 1, 'equipavel' => true, 'dados' => ['arma' => $arma]]];

        return [$ficha, $itens, Regras::calcular($ficha, $itens)];
    }

    public function test_arma_equipada_muda_acerto_margem_e_dano(): void
    {
        $arma = ['dano' => '1d4', 'atributo' => 'acuidade', 'tipoDano' => 'Cortante', 'proficiente' => true, 'forja' => ['meito' => 'o-wazamono', 'fio' => 1, 'expertise' => ['maximizar']]];
        [$ficha, $itens, $v] = $this->cenario($arma);
        $this->assertSame(3 + 3 + 2, $v['arma.1.ataque']);
        $this->assertSame(19, $v['arma.1.margem']);
        $this->assertSame('1d12', Regras::dadosDeDano($ficha, $itens, 1, $v)[0]);
        [, , $v2] = $this->cenario([...$arma, 'bonusAtaque' => 3]);
        $this->assertSame(3 + 3 + 3, $v2['arma.1.ataque']);
        [, , $v3] = $this->cenario([...$arma, 'distancia' => true, 'atributo' => 'des']);
        $this->assertSame(3 + 3, $v3['arma.1.ataque']);
        $this->assertSame(20, $v3['arma.1.margem']);
    }

    public function test_critico_oferece_a_expertise_e_so_com_proficiencia(): void
    {
        $arma = ['dano' => '1d6', 'atributo' => 'for', 'tipoDano' => 'Cortante', 'proficiente' => true, 'forja' => ['expertise' => ['maximizar', 'contundente-1d12']]];
        [$ficha, $itens, $v] = $this->cenario($arma);
        $termos = [['tipo' => 'variavel', 'nome' => 'arma.1.ataque'], ['tipo' => 'dados', 'faces' => 20, 'resultados' => [20], 'descartados' => []]];
        $meta = Regras::metadadosDaRolagem($termos, $v, $itens, $ficha);
        $this->assertSame('critico', $meta['destaque']);
        $this->assertSame(['maximizar', 'contundente-1d12'], array_column($meta['expertise'], 'id'));
        $botoes = array_column($meta['acoes'], null, 'id');
        $this->assertSame('6+@arma.1.dano', $botoes['expertise-maximizar']['expressao']); // 1d6 maximizado (não dobrado: os dados normais)
        $this->assertSame('1d12', $botoes['expertise-contundente-1d12']['expressao']);
        $this->assertSame('Contundente', $botoes['expertise-contundente-1d12']['dano']['tipo']);
        // sem crítico ou sem proficiência: nada de expertise
        $semCrit = Regras::metadadosDaRolagem([$termos[0], ['tipo' => 'dados', 'faces' => 20, 'resultados' => [10], 'descartados' => []]], $v, $itens, $ficha);
        $this->assertArrayNotHasKey('expertise', $semCrit);
        [$f2, $i2, $v2] = $this->cenario([...$arma, 'proficiente' => false]);
        $this->assertArrayNotHasKey('expertise', Regras::metadadosDaRolagem($termos, $v2, $i2, $f2));
    }

    public function test_densidade_e_balanco_passam_por_cima_das_defesas(): void
    {
        $this->assertSame([], Forja::ignoraDoDano(['tipoDano' => 'Cortante']));
        $this->assertSame([], Forja::ignoraDoDano(['tipoDano' => 'Contundente', 'forja' => ['densidade' => 'cortante']])); // tipo diferente
        $this->assertSame(['resistencia'], Forja::ignoraDoDano(['tipoDano' => 'Cortante', 'forja' => ['densidade' => 'cortante']]));
        $this->assertSame(['resistencia', 'imunidade'], Forja::ignoraDoDano(['tipoDano' => 'Cortante ou Perfurante', 'forja' => ['densidade' => 'cortante', 'balanco' => true]]));
        $alvo = ['resistencias' => ['Cortante'], 'imunidades' => []];
        $this->assertSame(5, Dano::calcular($alvo, 10, 'Cortante')['final']);
        $this->assertSame(10, Dano::calcular($alvo, 10, 'Cortante', ['resistencia'])['final']);
        $imune = ['imunidades' => ['Cortante']];
        $this->assertSame(0, Dano::calcular($imune, 10, 'Cortante', ['resistencia'])['final']);
        $this->assertSame(10, Dano::calcular($imune, 10, 'Cortante', ['resistencia', 'imunidade'])['final']);
    }
}
