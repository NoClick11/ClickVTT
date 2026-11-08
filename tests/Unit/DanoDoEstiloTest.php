<?php

namespace Tests\Unit;

use App\Nucleo\Combate\Dano;
use App\Sistemas\OnePiece\FichaOnePiece;
use App\Sistemas\OnePiece\Regras;
use PHPUnit\Framework\TestCase;

/** Características de estilo que mudam o dano causado: Golpe Moral, Tiro Oportunista e Tiro Sem Paciência. */
class DanoDoEstiloTest extends TestCase
{
    private function ficha(array $caracteristicas, int $nivel = 5): array
    {
        return [...FichaOnePiece::padrao(), 'nivel' => $nivel, 'caracteristicas' => $caracteristicas];
    }

    private function car(string $nome, array $extra = []): array
    {
        return ['nome' => $nome, 'origem' => 'Estilo', 'tipo' => 'passiva', 'descricao' => '', ...$extra];
    }

    public function test_tem_caracteristica_confere_nome_nivel_e_se_a_ativa_esta_ligada(): void
    {
        $f = $this->ficha([$this->car('Estilo Arriscado: Errar com Vontade', ['nivelMin' => 3]), $this->car('X: Tiro Sem Paciência', ['tipo' => 'ativa', 'ativa' => false])], 2);
        $this->assertFalse(Regras::temCaracteristica($f, 'Errar com Vontade')); // nível 2 < 3
        $f['nivel'] = 3;
        $this->assertTrue(Regras::temCaracteristica($f, 'Errar com Vontade'));
        $this->assertFalse(Regras::temCaracteristica($f, 'Tiro Sem Paciência')); // ativa desligada
        $f['caracteristicas'][1]['ativa'] = true;
        $this->assertTrue(Regras::temCaracteristica($f, 'Tiro Sem Paciência'));
    }

    public function test_golpe_moral_ignora_resistencia_a_cortante_e_corta_a_invulnerabilidade_pela_metade(): void
    {
        $f = $this->ficha([$this->car('Whip and Gun: Chicote')]);
        $this->assertSame(['resistencia', 'imunidade_metade'], Regras::golpeMoral($f, 'Cortante'));
        $this->assertSame(['imunidade_metade'], Regras::golpeMoral($f, 'Trovejante'));
        $this->assertSame([], Regras::golpeMoral($this->ficha([]), 'Cortante'));

        $alvo = ['resistencias' => ['Cortante'], 'imunidades' => ['Fogo']];
        $this->assertSame(10, Dano::calcular($alvo, 20, 'Cortante')['final']);
        $this->assertSame(20, Dano::calcular($alvo, 20, 'Cortante', ['resistencia'])['final']);
        $this->assertSame(0, Dano::calcular($alvo, 20, 'Fogo')['final']);
        $r = Dano::calcular($alvo, 20, 'Fogo', ['imunidade_metade']);
        $this->assertSame([10, 'imune_metade'], [$r['final'], $r['modo']]);
    }

    private function critico(array $f, array $municao = null, int $rodada = 1): array
    {
        $itens = [1 => ['nome' => 'Pistola', 'dados' => ['catalogo' => ['id' => 'pistola'], 'arma' => ['municao' => true, 'atributo' => 'des', 'tipoDano' => 'Perfurante', 'distancia' => true]]]];
        $termos = [['tipo' => 'dados', 'faces' => 20, 'resultados' => [20], 'descartados' => []], ['tipo' => 'variavel', 'nome' => 'arma.1.ataque']];

        return Regras::metadadosDaRolagem($termos, ['arma.1.margem' => 20, 'arma.1.dano' => 0], $itens, $f, $municao, $rodada);
    }

    public function test_tiro_oportunista_rola_os_dados_3_vezes_no_critico_da_pistola(): void
    {
        $municao = ['item_id' => 2, 'id' => 'municao-esferica', 'nome' => 'Esférica', 'nota' => '', 'dano' => '1d8', 'tipo' => 'Contundente'];
        $com = $this->critico($this->ficha([$this->car('Whip and Gun: Pistola')]), $municao);
        $sem = $this->critico($this->ficha([]), $municao);
        $this->assertSame('critico', $com['destaque']);
        $this->assertSame('3d8', collect($com['acoes'])->firstWhere('id', 'dano-critico')['resumo']);
        $this->assertSame('2d8', collect($sem['acoes'])->firstWhere('id', 'dano-critico')['resumo']);
    }

    public function test_tiro_sem_paciencia_soma_um_dado_por_rodada_ate_2_vezes_o_nivel(): void
    {
        $municao = ['item_id' => 2, 'id' => 'municao-esferica', 'nome' => 'Esférica', 'nota' => '', 'dano' => '1d8', 'tipo' => 'Contundente'];
        $f = $this->ficha([$this->car('Estilo Arriscado: Tiro Sem Paciência', ['tipo' => 'ativa', 'ativa' => true])], 3);
        $normal = fn (int $rodada) => collect($this->critico($f, $municao, $rodada)['acoes'])->firstWhere('id', 'dano-critico')['resumo'];
        // rodada 4: o dado da munição + 4 extras = 5 dados de 1d8; o crítico dobra cada um
        $this->assertSame('2d8+2d8+2d8+2d8+2d8', $normal(4));
        $this->assertSame(5, $this->critico($f, $municao, 5)['tiroSemPaciencia']);
        $this->assertSame(6, $this->critico($f, $municao, 40)['tiroSemPaciencia']); // 2 × nível 3
    }
}
