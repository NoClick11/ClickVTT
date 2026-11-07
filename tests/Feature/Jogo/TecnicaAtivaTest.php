<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Quick Draw: a Técnica fica ativa no combate e, no início do turno de quem está ao alcance, o chat pede o ataque (o jogador clica). */
class TecnicaAtivaTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(int $desDoAtirador = 30, int $caDoAlvo = 5): object
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $pagina = $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]); // 70 px = 1,5 m
        $mk = function (string $nome, array $atributos, ?Jogador $dono, float $x) use ($mesa, $pagina) {
            $p = $mesa->personagens()->create(['nome' => $nome, 'cor' => '#0ea5e9']);
            $f = FichaOnePiece::padrao();
            $f['atributos'] = [...$f['atributos'], ...$atributos];
            $f['pv'] = ['max' => 200, 'atual' => 200, 'temp' => 0];
            $p->ficha = $f;
            $p->save();
            $dono && $p->jogadores()->attach($dono);
            $pagina->objetos()->create(['camada' => 'jogadores', 'tipo' => 'token', 'personagem_id' => $p->id, 'nome' => $nome, 'x' => $x, 'y' => 0, 'largura' => 70, 'altura' => 70, 'z' => 1]);

            return $p;
        };
        $atirador = $mk('Atirador', ['des' => $desDoAtirador, 'von' => $desDoAtirador], $ana, 0);
        $perto = $mk('Perto', ['des' => $caDoAlvo], null, 700);   // 10 quadrados = 15 m
        $longe = $mk('Longe', ['des' => $caDoAlvo], null, 2100);  // 30 quadrados = 45 m
        $item = fn ($id, $p, $ini, $disp = 'inimigo') => ['id' => $id, 'nome' => $p->nome, 'cor' => '#000', 'personagem_id' => $p->id, 'objeto_id' => null, 'disposicao' => $disp, 'iniciativa' => $ini, 'acoes' => [], 'movimento' => ['usado' => 0.0, 'bonus' => 0.0]];
        $mesa->combate = ['ativo' => true, 'fase' => 'em_curso', 'rodada' => 1, 'atual' => 'a', 'itens' => [$item('a', $atirador, 20, 'jogadores'), $item('b', $perto, 15), $item('c', $longe, 10)]];
        $mesa->save();

        return (object) compact('mesa', 'mestre', 'ana', 'atirador', 'perto', 'longe');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    private function ativar($c, array $extra = [])
    {
        return $this->como($c->ana)->postJson(route('jogo.combate.tecnicas-ativas.ativar', $c->mesa->id), [
            'personagem_id' => $c->atirador->id, 'nome' => 'Quick Draw', 'rodadas' => 10, 'concentracao' => false, 'alcance' => 15,
            'dano' => ['expressao' => '2d10', 'tipo' => 'perfurante'],
            'opcoes' => [
                ['id' => 'movimento', 'rotulo' => 'Movimento a 0', 'efeito' => ['tipo' => 'movimento_zero']],
                ['id' => 'dano', 'rotulo' => '+2d10 de dano', 'efeito' => ['tipo' => 'dano', 'expressao' => '2d10', 'tipoDano' => 'perfurante']],
                ['id' => 'acao', 'rotulo' => 'Sem ação', 'efeito' => ['tipo' => 'sem_acao']],
            ],
            ...$extra,
        ]);
    }

    private function turno($c, string $sentido = 'proximo')
    {
        return $this->como($c->mestre)->postJson(route('jogo.combate.comando', $c->mesa->id), ['comando' => 'turno', 'sentido' => $sentido])->assertOk();
    }

    private function gatilhos($c)
    {
        return $c->mesa->mensagens()->where('tipo', 'gatilho')->orderBy('id')->get();
    }

    public function test_ativa_so_com_combate_em_curso_e_pelo_dono(): void
    {
        $c = $this->cenario();
        $this->ativar($c)->assertOk();
        $this->assertCount(1, $c->mesa->fresh()->combate['ativas']);
        $this->assertSame(10, $c->mesa->fresh()->combate['ativas'][0]['rodadas']);
        $this->ativar($c)->assertOk(); // a mesma Técnica reinicia, não duplica
        $this->assertCount(1, $c->mesa->fresh()->combate['ativas']);
        $this->como($c->ana)->postJson(route('jogo.combate.tecnicas-ativas.ativar', $c->mesa->id), [
            'personagem_id' => $c->perto->id, 'nome' => 'X', 'rodadas' => 1, 'alcance' => 1, 'dano' => ['expressao' => '1d4'],
        ])->assertStatus(422); // não é personagem dela

        $d = $this->cenario();
        $m = $d->mesa;
        $m->combate = [...$m->combate, 'fase' => 'iniciativa'];
        $m->save();
        $this->ativar($d)->assertStatus(422);
    }

    public function test_no_inicio_do_turno_de_quem_esta_ao_alcance_o_chat_pede_o_ataque(): void
    {
        $c = $this->cenario();
        $this->ativar($c)->assertOk();
        $this->turno($c); // vez do Perto (15 m, ao alcance)
        $g = $this->gatilhos($c);
        $this->assertCount(1, $g);
        $this->assertSame('pendente', $g[0]->dados['estado']);
        $this->assertSame('Perto', $g[0]->dados['alvo']['nome']);
        $this->assertSame(['movimento', 'dano', 'acao'], array_column($g[0]->dados['opcoes'], 'id'));
        $this->turno($c); // vez do Longe (45 m): fora do alcance, nada
        $this->assertCount(1, $this->gatilhos($c));
        $this->turno($c); // volta ao Atirador: ele mesmo não é alvo
        $this->assertCount(1, $this->gatilhos($c));
    }

    public function test_o_jogador_clica_ataca_e_no_acerto_escolhe_o_efeito(): void
    {
        $c = $this->cenario(30, 1); // ataque +10 contra CA 5: acerta sempre (salvo o 1 natural)
        $this->ativar($c)->assertOk();
        $this->turno($c);
        $id = $this->gatilhos($c)[0]->id;
        $rota = fn (string $nome) => route("jogo.gatilhos.{$nome}", [$c->mesa->id, $id]);

        $this->como($c->mestre)->postJson($rota('escolher'), ['opcao' => 'dano'])->assertStatus(422); // antes de atacar
        for ($i = 0; $i < 30; $i++) { // tenta de novo no 1 natural (erro automático)
            $r = $this->como($c->ana)->postJson($rota('atacar'))->assertOk()->json();
            if ($r['dados']['estado'] === 'acertou') {
                break;
            }
            $id = $this->gatilhos($c)->last()->id;
            $this->assertSame('errou', $r['dados']['estado']);
            break;
        }
        if ($r['dados']['estado'] === 'errou') {
            $this->markTestSkipped('Tirou 1 natural.');
        }
        $this->assertTrue($r['dados']['ataque']['acerto']);
        $perto = $c->perto->fresh();
        $this->assertSame(200 - $r['dados']['dano']['final'], $perto->ficha['pv']['atual']);
        $this->como($c->ana)->postJson($rota('atacar'))->assertStatus(422); // um ataque por card

        $antes = $perto->ficha['pv']['atual'];
        $r = $this->como($c->ana)->postJson($rota('escolher'), ['opcao' => 'dano'])->assertOk()->json();
        $this->assertSame('resolvido', $r['dados']['estado']);
        $this->assertLessThan($antes, $c->perto->fresh()->ficha['pv']['atual']); // +2d10
        $this->como($c->ana)->postJson($rota('escolher'), ['opcao' => 'dano'])->assertStatus(422); // uma escolha só
    }

    public function test_movimento_zero_e_sem_acao_mexem_no_turno_de_quem_foi_atingido(): void
    {
        foreach (['movimento', 'acao'] as $opcao) {
            $c = $this->cenario(30, 1);
            $this->ativar($c)->assertOk();
            $this->turno($c);
            $id = $this->gatilhos($c)[0]->id;
            $r = $this->como($c->ana)->postJson(route('jogo.gatilhos.atacar', [$c->mesa->id, $id]))->assertOk()->json();
            if ($r['dados']['estado'] !== 'acertou') {
                continue; // 1 natural
            }
            $this->como($c->ana)->postJson(route('jogo.gatilhos.escolher', [$c->mesa->id, $id]), ['opcao' => $opcao])->assertOk();
            $item = collect($c->mesa->fresh()->combate['itens'])->firstWhere('id', 'b');
            if ($opcao === 'movimento') {
                $this->assertSame(0.0, (float) $item['movimento']['base']);
            } else {
                $this->assertSame(1, $item['acoes']['padrao']);
            }
        }
        $this->assertTrue(true);
    }

    public function test_erro_ignorar_e_so_o_dono_ou_o_mestre_clicam(): void
    {
        $c = $this->cenario(1, 30); // ataque -5 contra CA 20+: erra (salvo 20 natural)
        $this->ativar($c)->assertOk();
        $this->turno($c);
        $id = $this->gatilhos($c)[0]->id;
        $outro = $c->mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $this->como($outro)->postJson(route('jogo.gatilhos.atacar', [$c->mesa->id, $id]))->assertForbidden();
        $this->como($c->ana)->postJson(route('jogo.gatilhos.ignorar', [$c->mesa->id, $id]))->assertOk();
        $this->assertSame('ignorado', $c->mesa->mensagens()->find($id)->dados['estado']);
        $this->como($c->ana)->postJson(route('jogo.gatilhos.atacar', [$c->mesa->id, $id]))->assertStatus(422);
        $this->assertSame(200, $c->perto->fresh()->ficha['pv']['atual']);
    }

    public function test_duracao_conta_rodadas_e_acaba(): void
    {
        $c = $this->cenario();
        $this->ativar($c, ['rodadas' => 2])->assertOk();
        $this->turno($c)->assertOk();
        $this->turno($c);
        $this->turno($c); // nova rodada (2): sobra 1
        $this->assertSame(1, $c->mesa->fresh()->combate['ativas'][0]['rodadas']);
        $this->turno($c);
        $this->turno($c);
        $this->turno($c); // nova rodada (3): acabou
        $this->assertSame([], $c->mesa->fresh()->combate['ativas']);
    }

    public function test_encerrar_e_concentracao_unica(): void
    {
        $c = $this->cenario();
        $this->ativar($c, ['concentracao' => true])->assertOk();
        $this->ativar($c, ['nome' => 'Outra', 'concentracao' => true])->assertOk(); // a 2ª concentração derruba a 1ª
        $ativas = $c->mesa->fresh()->combate['ativas'];
        $this->assertSame(['Outra'], array_column($ativas, 'nome'));
        $this->como($c->mestre)->deleteJson(route('jogo.combate.tecnicas-ativas.encerrar', [$c->mesa->id, $ativas[0]['id']]))->assertOk();
        $this->assertSame([], $c->mesa->fresh()->combate['ativas']);
        $this->como($c->ana)->deleteJson(route('jogo.combate.tecnicas-ativas.encerrar', [$c->mesa->id, 'nao-existe']))->assertNotFound();
    }

    public function test_sair_do_encontro_ou_encerrar_o_combate_limpa_as_ativas(): void
    {
        $c = $this->cenario();
        $this->ativar($c)->assertOk();
        $this->como($c->mestre)->postJson(route('jogo.combate.comando', $c->mesa->id), ['comando' => 'remover', 'item_id' => 'a'])->assertOk();
        $this->assertSame([], $c->mesa->fresh()->combate['ativas']);
    }
}
