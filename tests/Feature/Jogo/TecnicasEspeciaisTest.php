<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Efeitos de Técnicas que a mesa comanda por botão: Execução, Headshot e Covering (aplicação de dano e condição). */
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
        $f['tecnicas']['lista'] = array_map($tec, ['Execução', 'Headshot', 'Covering']);
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
        $this->especial($c, $msg, 'desvantagem')->assertStatus(422); // botão de outra Técnica
        $this->especial($c, $msg, 'inventado')->assertStatus(422);
        $outra = $c->mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $this->especial($c, $msg, 'executar', $outra)->assertForbidden(); // o ataque é da Ana
        $sem = $this->atacar($c, 'Técnica Inventada');
        $this->assertArrayNotHasKey('especiais', $sem['dados']['sistema']['tecnica']);
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

}
