<?php

namespace Tests\Unit;

use App\Nucleo\Combate\Dano;
use App\Sistemas\OnePiece\FichaOnePiece;
use App\Sistemas\OnePiece\OnePiece;
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

    public function test_fogo_do_black_leg_ifrit_ignora_resistencia_e_hell_memories_vira_vulnerabilidade(): void
    {
        $this->assertSame([], Regras::fogoDoBlackLeg($this->ficha([$this->car('Ifrit Jambe', ['tipo' => 'ativa', 'ativa' => true])]), 'Contundente')); // só Fogo
        $ifrit = $this->ficha([$this->car('Ifrit Jambe', ['tipo' => 'ativa', 'ativa' => true])], 15);
        $this->assertSame(['resistencia'], Regras::fogoDoBlackLeg($ifrit, 'Fogo'));
        $this->assertSame([], Regras::fogoDoBlackLeg($this->ficha([$this->car('Ifrit Jambe', ['tipo' => 'ativa', 'ativa' => false])], 15), 'Fogo')); // desligado
        $hell = $this->ficha([$this->car('Hell Memories')], 19);
        $this->assertSame(['imunidade', 'vulneravel_se_nao_resiste'], Regras::fogoDoBlackLeg($hell, 'Fogo'));

        $comum = [];
        $this->assertSame(40, Dano::calcular($comum, 20, 'Fogo', ['vulneravel_se_nao_resiste'])['final']); // sem defesa: em dobro
        $resiste = ['resistencias' => ['Fogo']];
        $this->assertSame(10, Dano::calcular($resiste, 20, 'Fogo', ['vulneravel_se_nao_resiste'])['final']); // resiste: segue resistindo
        $this->assertSame(20, Dano::calcular($resiste, 20, 'Fogo', ['resistencia'])['final']); // Ifrit: ignora a resistência
        $imune = ['imunidades' => ['Fogo']];
        $this->assertSame(20, Dano::calcular($imune, 20, 'Fogo', ['imunidade', 'vulneravel_se_nao_resiste'])['final']); // Hell: ignora a invulnerabilidade
    }

    public function test_kick_festival_so_vale_com_shoot_e_d20_de_16_a_20(): void
    {
        $f = $this->ficha([$this->car('Shoot')], 6);
        $this->assertNull(Regras::kickFestival($f, 15));
        $this->assertNull(Regras::kickFestival($f, null));
        $this->assertNull(Regras::kickFestival($this->ficha([], 6), 20)); // sem o Shoot
        $esperado = [16 => 'letargico', 17 => 'caido', 18 => 'contido', 19 => 'cego', 20 => 'atordoado'];
        foreach ($esperado as $d20 => $condicao) {
            $k = Regras::kickFestival($f, $d20);
            $this->assertSame('con', $k['atributo']);
            $this->assertSame(['condicao' => $condicao, 'turnos' => 1], $k['aplica']);
        }
    }

    public function test_tecnica_principal_ignora_resistencias_e_invulnerabilidades_so_na_tecnica_escolhida(): void
    {
        $principal = $this->car('Técnica Principal', ['principal' => ['pp' => 'cima', 'dados' => 2, 'ignora' => true, 'grauMax' => 4]]);
        $f = [...$this->ficha([$principal], 5), 'tecnicaPrincipal' => 'Golpe'];
        $this->assertSame(['resistencia', 'imunidade'], Regras::ignoraDaPrincipal($f, 'Golpe'));
        $this->assertSame([], Regras::ignoraDaPrincipal($f, 'Outra'));
        $this->assertSame([], Regras::ignoraDaPrincipal([...$f, 'tecnicaPrincipal' => null], 'Golpe'));
        // Técnica Assinatura do Herói não ignora defesas
        $assinatura = $this->car('Técnica Assinatura', ['principal' => ['pp' => 'baixo', 'dados' => 2, 'grauMax' => 4]]);
        $this->assertSame([], Regras::ignoraDaPrincipal([...$this->ficha([$assinatura], 10), 'tecnicaPrincipal' => 'Golpe'], 'Golpe'));
        // o dano vem sem resistência nem invulnerabilidade
        $alvo = ['resistencias' => ['Fogo'], 'imunidades' => ['Gelo']];
        $this->assertSame(20, Dano::calcular($alvo, 20, 'Fogo', Regras::ignoraDaPrincipal($f, 'Golpe'))['final']);
        $this->assertSame(20, Dano::calcular($alvo, 20, 'Gelo', Regras::ignoraDaPrincipal($f, 'Golpe'))['final']);
    }

    public function test_margem_de_critico_da_tecnica_e_a_menor_entre_a_propria_e_a_dos_efeitos(): void
    {
        $f = [...$this->ficha([], 5), 'tecnicas' => ['lista' => [['nome' => 'Tamaito', 'margemCritica' => 19], ['nome' => 'Overheat']]], 'akuma' => ['lista' => [['nome' => 'God Thread', 'margemCritica' => 19]]]];
        $this->assertSame(19, Regras::margemDaTecnica($f, [], 'Tamaito'));
        $this->assertSame(20, Regras::margemDaTecnica($f, [], 'Overheat'));
        $this->assertSame(19, Regras::margemDaTecnica($f, ['margem.tecnica' => 19], 'Overheat')); // Fios Imperceptíveis
        $this->assertSame(18, Regras::margemDaTecnica($f, ['margem.tecnica' => 18], 'Tamaito')); // a menor
        $this->assertSame(19, Regras::margemDaTecnica($f, [], 'God Thread')); // técnica da Akuma
        $this->assertSame(20, Regras::margemDaTecnica($f, [], 'Inexistente'));
        $this->assertSame(2, Regras::margemDaTecnica($f, ['margem.tecnica' => -3], 'Overheat')); // nunca abaixo de 2
    }

    public function test_espadachim_lamina_gentil_ignora_resistencia_e_caranguejo_ignora_invulnerabilidade_a_cortante(): void
    {
        $f = $this->ficha([$this->car('Lâmina Gentil'), $this->car('Aura Bestial: Caranguejo')]);
        $this->assertSame(['resistencia', 'imunidade'], Regras::cortanteDoEspadachim($f, 'Cortante'));
        $this->assertSame([], Regras::cortanteDoEspadachim($f, 'Fogo')); // só dano Cortante
        $this->assertSame([], Regras::cortanteDoEspadachim($this->ficha([]), 'Cortante'));
        $this->assertSame(['resistencia'], Regras::cortanteDoEspadachim($this->ficha([$this->car('Lâmina Gentil')]), 'Cortante'));
        // a Técnica só vale se tiver arma cortante como requisito
        $f['tecnicas'] = ['lista' => [['nome' => 'Baki', 'armaCortante' => true], ['nome' => 'Soco']]];
        $this->assertSame(['resistencia', 'imunidade'], Regras::cortanteDaTecnica($f, 'Baki', 'Cortante'));
        $this->assertSame([], Regras::cortanteDaTecnica($f, 'Soco', 'Cortante'));
        $alvo = ['resistencias' => ['Cortante'], 'imunidades' => []];
        $this->assertSame(20, Dano::calcular($alvo, 20, 'Cortante', Regras::cortanteDoEspadachim($f, 'Cortante'))['final']);
    }

    public function test_espadachim_honra_reduz_10_uma_vez_por_rodada_e_blue_bird_e_kiai_protegem(): void
    {
        $honra = $this->ficha([$this->car('Honra de um Espadachim', ['nivelMin' => 5])], 5);
        $honra['pv'] = ['atual' => 30, 'max' => 30, 'temp' => 0];
        $r = (new OnePiece)->absorverDano($honra, 25, ['origem' => 'ataque']);
        $this->assertSame([15, ['honra']], [$r['final'], $r['marcar']]);
        $this->assertSame(0, (new OnePiece)->absorverDano($honra, 8, ['origem' => 'tecnica'])['final']); // não passa de 10
        $this->assertSame(25, (new OnePiece)->absorverDano($honra, 25, ['origem' => 'ataque', 'usados' => ['honra']])['final']); // já gastou na rodada
        $this->assertSame(25, (new OnePiece)->absorverDano($honra, 25, ['origem' => 'salvaguarda'])['final']); // só ataques
        $this->assertSame(25, (new OnePiece)->absorverDano([...$honra, 'nivel' => 4], 25, ['origem' => 'ataque'])['final']);

        // Blue Bird (barreira): a Técnica de reação já foi paga e nenhum dano passa
        $barreira = [...$this->ficha([]), 'pv' => ['atual' => 30, 'max' => 30, 'temp' => 0], 'reducao' => ['zerar' => true, 'zerarPago' => true]];
        $r = (new OnePiece)->absorverDano($barreira, 40, ['origem' => 'ataque']);
        $this->assertSame(0, $r['final']);
        $this->assertFalse($r['campos']['reducao.zerar']);
        $this->assertFalse($r['campos']['reducao.zerarPago']);

        // Kiai no Tate: o dano deixa 1 PV (contando os temporários) até o fim do turno e não se consome
        $kiai = [...$this->ficha([]), 'pv' => ['atual' => 12, 'max' => 30, 'temp' => 3], 'reducao' => ['piso' => true]];
        $this->assertSame(14, (new OnePiece)->absorverDano($kiai, 50, ['origem' => 'ataque'])['final']);
        $this->assertSame(5, (new OnePiece)->absorverDano($kiai, 5, ['origem' => 'ataque'])['final']);
        $zero = [...$kiai, 'pv' => ['atual' => 1, 'max' => 30, 'temp' => 0]];
        $this->assertSame(0, (new OnePiece)->absorverDano($zero, 9, ['origem' => 'ataque'])['final']);
    }
}
