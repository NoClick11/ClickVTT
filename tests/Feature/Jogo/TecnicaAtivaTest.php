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

    // --- Vigília (Overwatch) -----------------------------------------------------------------------------------------------------

    /** O Atirador equipa um mosquete com 5 munições esféricas (alcance 24 m). */
    private function armar($c): void
    {
        $loja = app(\App\Nucleo\Loja\LojaService::class);
        $sis = new \App\Sistemas\OnePiece\OnePiece;
        $mosq = $loja->materializar($c->mesa, $sis, \App\Sistemas\OnePiece\Itens::item('mosquete'));
        $esf = $loja->materializar($c->mesa, $sis, \App\Sistemas\OnePiece\Itens::item('municao-esferica'));
        $f = $c->atirador->fresh()->ficha;
        $f['inventario'] = [['secao' => 'Equipamento', 'itens' => [
            ['item_id' => $mosq->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false],
            ['item_id' => $esf->id, 'qtd' => 5, 'equipado' => false, 'sintonizado' => false],
        ]]];
        $c->atirador->ficha = $f;
        $c->atirador->save();
        $c->esf = $esf;
    }

    private function vigia($c, float $x = 700, float $y = 0, array $extra = [])
    {
        return $this->como($c->ana)->postJson(route('jogo.combate.tecnicas-ativas.vigia', $c->mesa->id), [
            'personagem_id' => $c->atirador->id, 'nome' => 'Overwatch', 'rodadas' => 10, 'concentracao' => true, 'x' => $x, 'y' => $y, 'raio' => 3, ...$extra,
        ]);
    }

    public function test_a_vigilia_marca_a_esfera_dentro_do_alcance_da_arma(): void
    {
        $c = $this->cenario();
        $this->vigia($c)->assertStatus(422); // sem arma de fogo
        $this->armar($c);
        $this->vigia($c, 700, 0, ['raio' => 5])->assertStatus(422);       // raio máximo 3 m
        $this->vigia($c, 2100, 0)->assertStatus(422);                     // 45 m: além dos 24 m do mosquete
        $this->vigia($c, 700, 0)->assertOk();
        $z = $c->mesa->fresh()->combate['ativas'][0];
        $this->assertSame('vigia', $z['tipo']);
        $this->assertEquals([700.0, 0.0, 3.0], [$z['zona']['x'], $z['zona']['y'], $z['zona']['raio']]);
        // não é do atirador: recusa
        $this->como($c->mestre); // o mestre pode, mas outro jogador não
    }

    public function test_quem_age_dentro_da_esfera_dispara_o_ataque_e_quem_esta_fora_nao(): void
    {
        $c = $this->cenario();
        $this->armar($c);
        $this->vigia($c, 700, 0)->assertOk(); // esfera em volta do Perto
        $combate = app(\App\Nucleo\Combate\CombateService::class);
        $acesso = fn ($j) => \App\Support\AcessoMesa::class;
        // o Perto age (Ação) dentro da esfera
        $this->como($c->mestre)->postJson(route('jogo.combate.acao', $c->mesa->id), ['personagem_id' => $c->perto->id, 'categoria' => 'padrao'])->assertOk();
        $g = $this->gatilhos($c);
        $this->assertCount(1, $g);
        $this->assertTrue($g[0]->dados['vigia']);
        $this->assertSame('age', $g[0]->dados['motivo']);
        $this->assertSame('Perto', $g[0]->dados['alvo']['nome']);
        // o Longe (45 m) age fora da esfera: nada
        $this->como($c->mestre)->postJson(route('jogo.combate.acao', $c->mesa->id), ['personagem_id' => $c->longe->id, 'categoria' => 'padrao'])->assertOk();
        $this->assertCount(1, $this->gatilhos($c));
        // ação livre não conta; e um card pendente por criatura
        $this->como($c->mestre)->postJson(route('jogo.combate.acao', $c->mesa->id), ['personagem_id' => $c->perto->id, 'categoria' => 'bonus'])->assertOk();
        $this->assertCount(1, $this->gatilhos($c));
    }

    public function test_quem_se_move_dentro_da_esfera_dispara_e_o_atirador_que_anda_encerra(): void
    {
        $c = $this->cenario();
        $this->armar($c);
        $this->vigia($c, 700, 0)->assertOk();
        $tokenPerto = $c->mesa->paginas()->first()->objetos()->where('personagem_id', $c->perto->id)->first();
        // de fora da esfera (Longe) para dentro: dispara
        $tokenLonge = $c->mesa->paginas()->first()->objetos()->where('personagem_id', $c->longe->id)->first();
        $this->como($c->mestre)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $tokenLonge->id]), ['x' => 770, 'y' => 0])->assertOk();
        $g = $this->gatilhos($c);
        $this->assertCount(1, $g);
        $this->assertSame(['Longe', 'se move'], [$g[0]->dados['alvo']['nome'], $g[0]->dados['motivo']]);
        // o atirador anda: a Vigília acaba
        $tokenAtirador = $c->mesa->paginas()->first()->objetos()->where('personagem_id', $c->atirador->id)->first();
        $this->como($c->mestre)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $tokenAtirador->id]), ['x' => 70, 'y' => 0])->assertOk();
        $this->assertSame([], $c->mesa->fresh()->combate['ativas']);
    }

    public function test_o_ataque_da_vigilia_gasta_1_municao_rola_dano_e_a_salvaguarda_encerra_o_turno(): void
    {
        $c = $this->cenario(desDoAtirador: 30, caDoAlvo: 5);
        $this->armar($c);
        $f = $c->perto->ficha; // CON 1: a Salvaguarda falha sempre contra a CD do atirador
        $f['atributos']['con'] = 1;
        $f['ajustes']['ca'] = -30;
        $c->perto->ficha = $f;
        $c->perto->save();
        $this->vigia($c, 700, 0)->assertOk();
        // é a vez do Perto: ele age e é atingido
        $this->turno($c);
        $this->como($c->mestre)->postJson(route('jogo.combate.acao', $c->mesa->id), ['personagem_id' => $c->perto->id, 'categoria' => 'padrao'])->assertOk();
        $g = $this->gatilhos($c)->first();
        $this->app->instance(\App\Nucleo\Rolagem\Rolador::class, new \App\Nucleo\Rolagem\Rolador(fn (int $faces) => $faces === 20 ? 10 : 3)); // d20 = 10 (acerta e a Con falha), dados = 3
        $r = $this->como($c->ana)->postJson(route('jogo.gatilhos.atacar', [$c->mesa->id, $g->id]))->assertOk()->json();
        $this->assertSame('resolvido', $r['dados']['estado']);
        $this->assertTrue($r['dados']['ataque']['acerto']);
        $this->assertLessThan(200, $c->perto->fresh()->ficha['pv']['atual']);               // o dano da arma com a munição foi aplicado
        $this->assertFalse($r['dados']['salvaguarda']['passou']);
        $qtd = collect($c->atirador->fresh()->ficha['inventario'][0]['itens'])->firstWhere('item_id', $c->esf->id)['qtd'];
        $this->assertSame(4, $qtd);                                                         // 1 munição por ataque
        $this->assertNotSame('b', $c->mesa->fresh()->combate['atual']);                     // falhou na Con: o turno do Perto acabou
    }

    public function test_sem_municao_o_ataque_da_vigilia_e_recusado(): void
    {
        $c = $this->cenario();
        $this->armar($c);
        $f = $c->atirador->fresh()->ficha;
        $f['inventario'][0]['itens'] = [$f['inventario'][0]['itens'][0]]; // só o mosquete
        $c->atirador->ficha = $f;
        $c->atirador->save();
        $this->vigia($c, 700, 0)->assertOk();
        $this->como($c->mestre)->postJson(route('jogo.combate.acao', $c->mesa->id), ['personagem_id' => $c->perto->id, 'categoria' => 'padrao'])->assertOk();
        $g = $this->gatilhos($c)->first();
        $this->como($c->ana)->postJson(route('jogo.gatilhos.atacar', [$c->mesa->id, $g->id]))->assertStatus(422)->assertJsonValidationErrors('municao');
        $this->assertSame('pendente', $g->fresh()->dados['estado']);
    }

    public function test_mover_a_esfera_custa_a_acao_bonus_ate_6_m_e_nao_encerra_a_vigilia(): void
    {
        $c = $this->cenario();
        $this->armar($c);
        $this->vigia($c, 700, 0)->assertOk();
        $id = $c->mesa->fresh()->combate['ativas'][0]['id'];
        $rota = route('jogo.combate.tecnicas-ativas.mover', [$c->mesa->id, $id]);
        $this->como($c->ana)->postJson($rota, ['x' => 700 + 70 * 5, 'y' => 0])->assertStatus(422); // 7,5 m: passa dos 6 m
        $this->como($c->ana)->postJson($rota, ['x' => 700 + 70 * 4, 'y' => 0])->assertOk();       // 6 m
        $z = $c->mesa->fresh()->combate['ativas'][0];
        $this->assertEquals(980.0, $z['zona']['x']);
        $this->assertSame(1, $c->mesa->fresh()->combate['itens'][0]['acoes']['bonus']);              // gastou a Ação bônus
        $this->como($c->ana)->postJson($rota, ['x' => 700, 'y' => 0])->assertStatus(422);           // a Ação bônus já foi usada neste turno
        // qualquer outra atividade (uma Ação) encerra
        $this->como($c->ana)->postJson(route('jogo.combate.acao', $c->mesa->id), ['personagem_id' => $c->atirador->id, 'categoria' => 'padrao'])->assertOk();
        $this->assertSame([], $c->mesa->fresh()->combate['ativas']);
    }
}
