<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Técnicas: o ataque oferece o dano depois do acerto; a Salvaguarda coletiva é rolada por alvo e o dano é aplicado no servidor. */
class TecnicaTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(int $vonDoAtacante, int $desDosAlvos): object
    {
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $bia = $mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
        $personagem = function (string $nome, array $atributos, ?Jogador $dono) use ($mesa) {
            $p = $mesa->personagens()->create(['nome' => $nome, 'cor' => '#0ea5e9']);
            $f = FichaOnePiece::padrao();
            $f['atributos'] = [...$f['atributos'], ...$atributos];
            $f['pv'] = ['max' => 100, 'atual' => 100, 'temp' => 0];
            $p->ficha = $f;
            $p->save();
            if ($dono) {
                $p->jogadores()->attach($dono);
            }

            return $p;
        };
        $atirador = $personagem('Atirador', ['von' => $vonDoAtacante], $ana);
        $alvoA = $personagem('Alvo A', ['des' => $desDosAlvos], null); // NPC: sem fogo amigo, jogador não machuca jogador
        $alvoB = $personagem('Alvo B', ['des' => $desDosAlvos], null);

        return (object) compact('mesa', 'mestre', 'ana', 'bia', 'atirador', 'alvoA', 'alvoB');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    private function abrir($c, array $extra = [])
    {
        return $this->como($c->ana)->postJson(route('jogo.tecnicas.salvaguarda.abrir', $c->mesa->id), [
            'personagem_id' => $c->atirador->id, 'nome' => 'Death Blossom', 'atributo' => 'des', 'ao_passar' => 'metade',
            'alvos' => [$c->alvoA->id, $c->alvoB->id], 'dano' => ['expressao' => '10', 'tipo' => 'perfurante'], ...$extra,
        ]);
    }

    private function rolar($c, int $mensagemId, $como, int $alvo)
    {
        return $this->como($como)->postJson(route('jogo.tecnicas.salvaguarda.rolar', [$c->mesa->id, $mensagemId]), ['personagem_id' => $alvo]);
    }

    public function test_quem_falha_toma_todo_o_dano_so_depois_que_todos_rolam(): void
    {
        $c = $this->cenario(30, 1); // CD 20; os alvos (Des 1, mod -5) não passam nunca
        $r = $this->abrir($c)->assertCreated()->json();
        $this->assertSame('tecnica', $r['tipo']);
        $this->assertSame(20, $r['dados']['tecnica']['cd']);
        $this->assertCount(2, $r['dados']['alvos']);

        $r = $this->rolar($c, $r['id'], $c->mestre, $c->alvoA->id)->assertOk()->json();
        $this->assertSame('aguardando', $r['dados']['estado']);
        $this->assertSame(100, $c->alvoA->fresh()->ficha['pv']['atual'], 'sem dano até todos rolarem');
        $this->rolar($c, $r['id'], $c->mestre, $c->alvoA->id)->assertStatus(422); // não rola duas vezes

        $r = $this->rolar($c, $r['id'], $c->mestre, $c->alvoB->id)->assertOk()->json(); // o mestre rola pelo NPC
        $this->assertSame('resolvido', $r['dados']['estado']);
        $this->assertSame(10, $r['dados']['dano']['total']);
        foreach ($r['dados']['alvos'] as $a) {
            $this->assertFalse($a['passou']);
            $this->assertSame(10, $a['final']);
        }
        $this->assertSame(90, $c->alvoA->fresh()->ficha['pv']['atual']);
        $this->assertSame(90, $c->alvoB->fresh()->ficha['pv']['atual']);
    }

    public function test_quem_passa_toma_metade_ou_nada(): void
    {
        $c = $this->cenario(1, 30); // CD 5; os alvos (Des 30, mod +10) passam sempre
        $r = $this->abrir($c)->assertCreated()->json();
        $this->rolar($c, $r['id'], $c->mestre, $c->alvoA->id)->assertOk();
        $r = $this->rolar($c, $r['id'], $c->mestre, $c->alvoB->id)->assertOk()->json();
        $this->assertSame(5, $r['dados']['alvos'][0]['final']); // 10 / 2
        $this->assertSame(95, $c->alvoA->fresh()->ficha['pv']['atual']);

        $c2 = $this->cenario(1, 30);
        $r = $this->abrir($c2, ['ao_passar' => 'nada'])->assertCreated()->json();
        $this->rolar($c2, $r['id'], $c2->mestre, $c2->alvoA->id)->assertOk();
        $this->rolar($c2, $r['id'], $c2->mestre, $c2->alvoB->id)->assertOk();
        $this->assertSame(100, $c2->alvoA->fresh()->ficha['pv']['atual']);
    }

    public function test_so_o_dono_ou_o_mestre_rola_e_a_cd_vem_do_servidor(): void
    {
        $c = $this->cenario(30, 1);
        $r = $this->abrir($c, ['cd' => 1])->assertCreated()->json(); // a CD mandada pelo cliente é ignorada
        $this->assertSame(20, $r['dados']['tecnica']['cd']);
        $this->rolar($c, $r['id'], $c->ana, $c->alvoA->id)->assertForbidden(); // a Ana não controla o Alvo A
        $this->como($c->bia)->postJson(route('jogo.tecnicas.salvaguarda.abrir', $c->mesa->id), [
            'personagem_id' => $c->atirador->id, 'nome' => 'X', 'atributo' => 'des', 'alvos' => [$c->alvoA->id],
        ])->assertStatus(422); // a Bia não controla o Atirador
    }

    public function test_salvaguarda_do_efeito_abre_para_quem_falhou_e_expressao_invalida_e_recusada(): void
    {
        $c = $this->cenario(30, 1);
        $r = $this->abrir($c, ['secundaria' => ['atributo' => 'con', 'efeito' => 'Sangramento']])->assertCreated()->json();
        $this->rolar($c, $r['id'], $c->mestre, $c->alvoA->id)->assertOk();
        $this->rolar($c, $r['id'], $c->mestre, $c->alvoB->id)->assertOk();
        $segunda = $c->mesa->mensagens()->where('tipo', 'tecnica')->orderByDesc('id')->first();
        $this->assertSame('Death Blossom: efeito', $segunda->dados['rotulo']);
        $this->assertSame('Sangramento', $segunda->dados['tecnica']['efeito']);
        $this->assertCount(2, $segunda->dados['alvos']);
        $this->assertNull($segunda->dados['tecnica']['dano']);

        $this->abrir($c, ['dano' => ['expressao' => '3dx']])->assertStatus(422);
    }

    public function test_o_ataque_da_tecnica_oferece_o_dano_e_o_critico_dobra_os_dados(): void
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $c = $this->cenario(10, 10);
        $dano = ['expressao' => '3d10+2', 'tipo' => 'perfurante'];
        $enviar = fn () => $this->como($c->ana)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => '1d20+@ataque', 'rotulo' => 'Tiro Certeiro', 'visibilidade' => 'todos', 'personagem_id' => $c->atirador->id,
            'tecnica' => ['nome' => 'Tiro Certeiro', 'dano' => $dano, 'secundaria' => ['atributo' => 'con', 'efeito' => 'Impedido']],
        ])->assertCreated()->json();
        $viuCritico = false;
        for ($i = 0; $i < 80 && ! $viuCritico; $i++) {
            $r = $enviar();
            $sis = $r['dados']['sistema'];
            $this->assertSame('Tiro Certeiro', $sis['tecnica']['nome']);
            if (($sis['destaque'] ?? null) === 'critico') {
                $viuCritico = true;
                $this->assertSame('6d10+2', $sis['acoes'][0]['expressao']);
                $this->assertSame('3d10+2', $sis['acoes'][1]['expressao']);
            } elseif (($sis['destaque'] ?? null) === 'falha') {
                $this->assertArrayNotHasKey('acoes', $sis);
            } else {
                $this->assertSame('3d10+2', $sis['acoes'][0]['expressao']);
                $this->assertSame('perfurante', $sis['acoes'][0]['dano']['tipo']);
            }
        }
        $this->assertTrue(\App\Sistemas\OnePiece\Regras::dobrarDadosDaExpressao('d8+2d6+3') === '2d8+4d6+3');
    }

    public function test_a_condicao_da_tecnica_vai_sozinha_para_quem_falhou_com_a_duracao(): void
    {
        $c = $this->cenario(30, 1); // quem falha: todos
        $r = $this->abrir($c, ['dano' => null, 'aplica' => ['condicao' => 'caido'], 'ao_passar' => 'nada'])->assertCreated()->json();
        $this->rolar($c, $r['id'], $c->mestre, $c->alvoA->id)->assertOk();
        $r = $this->rolar($c, $r['id'], $c->mestre, $c->alvoB->id)->assertOk()->json();
        $this->assertSame('aplicada', $r['dados']['alvos'][0]['condicao']['situacao']);
        $this->assertContains('caido', $c->alvoA->fresh()->ficha['condicoes']);
        $this->assertContains('caido', $c->alvoB->fresh()->ficha['condicoes']);

        // com duração e a segunda Salvaguarda (efeito): Atordoado por 1 turno
        $c2 = $this->cenario(30, 1);
        $f = $c2->alvoA->ficha;
        $f['atributos']['con'] = 1; // Con -5: o máximo é 15, abaixo da CD 20
        $c2->alvoA->ficha = $f;
        $c2->alvoA->save();
        $r = $this->abrir($c2, ['secundaria' => ['atributo' => 'con', 'efeito' => 'Atordoado', 'aplica' => ['condicao' => 'atordoado', 'turnos' => 1]]])->assertCreated()->json();
        $this->rolar($c2, $r['id'], $c2->mestre, $c2->alvoA->id)->assertOk();
        $this->rolar($c2, $r['id'], $c2->mestre, $c2->alvoB->id)->assertOk();
        $segunda = $c2->mesa->mensagens()->where('tipo', 'tecnica')->orderByDesc('id')->first();
        $this->assertSame(['condicao' => 'atordoado', 'turnos' => 1], $segunda->dados['tecnica']['aplica']);
        $this->rolar($c2, $segunda->id, $c2->mestre, $c2->alvoA->id)->assertOk(); // Con 1: a CD 20 não passa
        $this->rolar($c2, $segunda->id, $c2->mestre, $c2->alvoB->id)->assertOk(); // o card resolve quando todos rolam
        $ficha = $c2->alvoA->fresh()->ficha;
        $this->assertContains('atordoado', $ficha['condicoes']);
        $this->assertSame(1, $ficha['duracoes']['atordoado']['turnos']);
    }
}
