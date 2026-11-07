<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Efeitos de Técnicas que a mesa comanda por botão: Execução, Zona do Atirador, Headshot, Covering, Mira Cruel, Defesa Improvisada e Execução Perfeita. */
class TecnicasEspeciaisTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(): object
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
        $tec = fn (string $nome) => ['nome' => $nome, 'origem' => 'Atirador', 'custo' => 1, 'alcance' => 'Arma, Linha', 'efeito' => '', 'descricao' => 'Requisito: arma favorita.', 'rolagem' => '1d6', 'tipoDano' => 'perfurante', 'builder' => 'estilo'];
        $f = FichaOnePiece::padrao();
        $f['atributos'] = [...$f['atributos'], 'des' => 30];
        $f['pp'] = ['atual' => 10, 'porNivel' => 4];
        $f['tecnicas']['lista'] = array_map($tec, ['Execução', 'Zona do Atirador', 'Headshot', 'Covering', 'Mira Cruel', 'Defesa Improvisada']);
        $f['caracteristicas'] = [['nome' => 'Rei Atirador: Execução Perfeita', 'origem' => '', 'tipo' => 'passiva', 'descricao' => '', 'efeitos' => [], 'usos' => ['atual' => 3, 'max' => 3, 'descanso' => 'longo']]];
        $atirador = $mesa->personagens()->create(['nome' => 'Atirador', 'cor' => '#0ea5e9']);
        $atirador->ficha = $f;
        $atirador->save();
        $atirador->jogadores()->attach($ana);
        $alvo = $mesa->personagens()->create(['nome' => 'Alvo', 'cor' => '#ef4444']);
        $fa = FichaOnePiece::padrao();
        $fa['pv'] = ['max' => 400, 'atual' => 100, 'temp' => 0];
        $alvo->ficha = $fa;
        $alvo->save();

        return (object) compact('mesa', 'mestre', 'ana', 'atirador', 'alvo');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    /** O d20 fixo (acerta; 20 = crítico) e o ataque da Técnica com o alvo mirado. */
    private function atacar($c, string $tecnica, int $d20 = 15)
    {
        $this->app->instance(\App\Nucleo\Rolagem\Rolador::class, new \App\Nucleo\Rolagem\Rolador(fn (int $faces) => $faces === 20 ? $d20 : 3));

        return $this->como($c->ana)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => '1d20+@ataque', 'visibilidade' => 'todos', 'personagem_id' => $c->atirador->id, 'alvo_personagem_id' => $c->alvo->id,
            'tecnica' => ['nome' => $tecnica, 'dano' => ['expressao' => '1d6', 'tipo' => 'perfurante']],
        ])->assertCreated()->json();
    }

    private function especial($c, array $msg, string $efeito, ?Jogador $quem = null)
    {
        return ($quem ? $this->como($quem) : $this->como($c->ana))->postJson(route('jogo.tecnicas.especial', [$c->mesa->id, $msg['id']]), ['efeito' => $efeito, 'alvo_id' => $c->alvo->id]);
    }

    public function test_execucao_mata_quem_tem_150_pv_ou_menos_e_so_uma_vez(): void
    {
        $c = $this->cenario();
        $msg = $this->atacar($c, 'Execução');
        $this->assertSame('executar', $msg['dados']['sistema']['tecnica']['especiais'][0]['id']);
        $f = $c->alvo->ficha;
        $f['pv']['atual'] = 151;
        $c->alvo->ficha = $f;
        $c->alvo->save();
        $this->especial($c, $msg, 'executar')->assertStatus(422)->assertJsonValidationErrors('efeito'); // 151 PV: não mata
        $f['pv']['atual'] = 150;
        $c->alvo->ficha = $f;
        $c->alvo->save();
        $this->especial($c, $msg, 'executar')->assertOk();
        $this->assertSame(0, $c->alvo->fresh()->ficha['pv']['atual']);
        $this->especial($c, $msg, 'executar')->assertStatus(422); // já usado
    }

    public function test_so_existem_os_botoes_da_tecnica_e_so_para_quem_a_tem(): void
    {
        $c = $this->cenario();
        $msg = $this->atacar($c, 'Execução');
        $this->especial($c, $msg, 'zona')->assertStatus(422);        // outro botão
        $this->especial($c, $msg, 'inventado')->assertStatus(422);
        $outra = $c->mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $this->especial($c, $msg, 'executar', $outra)->assertForbidden(); // o ataque é da Ana
        $sem = $this->atacar($c, 'Técnica Inventada');
        $this->assertArrayNotHasKey('especiais', $sem['dados']['sistema']['tecnica']);
    }

    public function test_zona_do_atirador_da_60_pv_temporarios_a_quem_atacou(): void
    {
        $c = $this->cenario();
        $msg = $this->atacar($c, 'Zona do Atirador');
        $this->como($c->ana)->postJson(route('jogo.tecnicas.especial', [$c->mesa->id, $msg['id']]), ['efeito' => 'zona'])->assertOk();
        $this->assertSame(60, $c->atirador->fresh()->ficha['pv']['temp']);
    }

    public function test_headshot_exige_critico_e_a_cabeca_e_so_do_narrador(): void
    {
        $c = $this->cenario();
        $normal = $this->atacar($c, 'Headshot', 15);
        $this->assertArrayNotHasKey('especiais', $normal['dados']['sistema']['tecnica']); // sem crítico, sem botões
        $critico = $this->atacar($c, 'Headshot', 20);
        $ids = array_column($critico['dados']['sistema']['tecnica']['especiais'], 'id');
        $this->assertEqualsCanonicalizing(['cabeca', 'extra'], $ids);
        $this->especial($c, $critico, 'cabeca')->assertStatus(422);                       // o jogador não decide: é do Narrador
        $this->especial($c, $critico, 'extra')->assertOk();                                // 6d10 (3 em cada dado = 18) Perfurante
        $this->assertLessThan(100, $c->alvo->fresh()->ficha['pv']['atual']);
        $this->como($c->mestre)->postJson(route('jogo.tecnicas.especial', [$c->mesa->id, $critico['id']]), ['efeito' => 'cabeca', 'alvo_id' => $c->alvo->id])->assertOk();
        $this->assertSame(0, $c->alvo->fresh()->ficha['pv']['atual']);
    }

    public function test_covering_aplica_a_condicao_de_desvantagem_por_um_turno(): void
    {
        $c = $this->cenario();
        $msg = $this->atacar($c, 'Covering');
        $this->especial($c, $msg, 'desvantagem')->assertOk();
        $f = $c->alvo->fresh()->ficha;
        $this->assertContains('covering', $f['condicoes']);
        $this->assertSame(1, $f['duracoes']['covering']['turnos']);
    }

    public function test_mira_cruel_reduz_o_movimento_pela_metade_no_combate(): void
    {
        $c = $this->cenario();
        $mesa = $c->mesa;
        $mesa->combate = ['ativo' => true, 'fase' => 'em_curso', 'rodada' => 1, 'atual' => 'b', 'itens' => [
            ['id' => 'b', 'nome' => 'Alvo', 'cor' => '#000', 'personagem_id' => $c->alvo->id, 'objeto_id' => null, 'disposicao' => 'inimigo', 'iniciativa' => 1, 'acoes' => [], 'movimento' => ['usado' => 0.0, 'bonus' => 0.0, 'base' => 9.0]],
        ]];
        $mesa->save();
        $msg = $this->atacar($c, 'Mira Cruel');
        $this->especial($c, $msg, 'metade_movimento')->assertOk();
        $this->assertEquals(4.5, $c->mesa->fresh()->combate['itens'][0]['movimento']['base']);
    }

    public function test_defesa_improvisada_soma_2d8_por_pp_ate_20d8(): void
    {
        $c = $this->cenario();
        $this->app->instance(\App\Nucleo\Rolagem\Rolador::class, new \App\Nucleo\Rolagem\Rolador(fn (int $faces) => 4));
        $msg = $this->como($c->ana)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => '6d8', 'visibilidade' => 'todos', 'personagem_id' => $c->atirador->id, 'tecnica' => ['nome' => 'Defesa Improvisada'],
        ])->assertCreated()->json();
        $this->assertSame(['dados' => 6, 'total' => 24], $msg['dados']['sistema']['reducao']);
        $rota = route('jogo.tecnicas.especial', [$c->mesa->id, $msg['id']]);
        $r = $this->como($c->ana)->postJson($rota, ['efeito' => 'reducao_extra'])->assertOk()->json();
        $this->assertSame(['dados' => 8, 'total' => 32], $r['dados']['sistema']['reducao']); // +2d8 = 8 (4 em cada dado)
        $this->assertSame(9, $c->atirador->fresh()->ficha['pp']['atual']);                      // 1 PP
        for ($i = 0; $i < 6; $i++) {
            $this->como($c->ana)->postJson($rota, ['efeito' => 'reducao_extra'])->assertOk();
        }
        $this->assertSame(20, $c->mesa->mensagens()->find($msg['id'])->dados['sistema']['reducao']['dados']);
        $this->como($c->ana)->postJson($rota, ['efeito' => 'reducao_extra'])->assertStatus(422); // 20d8 é o limite
        $f = $c->atirador->fresh()->ficha;
        $f['pp']['atual'] = 0;
        $c->atirador->ficha = $f;
        $c->atirador->save();
    }

    public function test_execucao_perfeita_gasta_um_uso_da_caracteristica_ao_rolar_duas_vezes(): void
    {
        $c = $this->cenario();
        $this->app->instance(\App\Nucleo\Rolagem\Rolador::class, new \App\Nucleo\Rolagem\Rolador(fn (int $faces) => 3));
        $rolar = fn () => $this->como($c->ana)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => '11d10^2', 'visibilidade' => 'todos', 'personagem_id' => $c->atirador->id, 'dano' => ['tipo' => 'perfurante'],
        ]);
        $rolar()->assertCreated();
        $this->assertSame(2, $c->atirador->fresh()->ficha['caracteristicas'][0]['usos']['atual']);
        $rolar()->assertCreated();
        $rolar()->assertCreated();
        $rolar()->assertStatus(422)->assertJsonValidationErrors('expressao'); // os 3 usos acabaram
        $this->assertSame(0, $c->atirador->fresh()->ficha['caracteristicas'][0]['usos']['atual']);
    }
}
