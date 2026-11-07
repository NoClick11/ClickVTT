<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Combate no servidor: fases, iniciativa, turnos, ordem e bloqueio de movimento fora do turno. */
class CombateTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(string $sistema = 'one-piece'): object
    {
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', $sistema)->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $bia = $mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $aria->jogadores()->attach($ana);
        $bruno = $mesa->personagens()->create(['nome' => 'Bruno', 'cor' => '#ef4444']);
        $bruno->jogadores()->attach($bia);
        $orc = $mesa->personagens()->create(['nome' => 'Orc', 'cor' => '#555555']); // NPC: sem jogadores
        $pagina = $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
        $token = fn ($p, $x) => $pagina->objetos()->create(['camada' => 'jogadores', 'tipo' => 'token', 'personagem_id' => $p->id, 'nome' => $p->nome, 'x' => $x, 'y' => 0, 'largura' => 50, 'altura' => 50, 'z' => 1]);

        return (object) ['mesa' => $mesa, 'mestre' => $mestre, 'ana' => $ana, 'bia' => $bia, 'aria' => $aria, 'bruno' => $bruno, 'orc' => $orc, 'pagina' => $pagina,
            'tAria' => $token($aria, 0), 'tBruno' => $token($bruno, 100), 'tOrc' => $token($orc, 200)];
    }

    private function como(Jogador $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => [$p->id => true]]])->withHeader('X-Jogador', (string) $p->id);
    }

    private function cmd($c, Jogador $quem, string $comando, array $d = [])
    {
        return $this->como($quem)->postJson(route('jogo.combate.comando', $c->mesa->id), ['comando' => $comando, ...$d]);
    }

    private function item(array $combate, string $nome): array
    {
        return collect($combate['itens'])->firstWhere('nome', $nome);
    }

    public function test_iniciar_abre_a_fase_de_iniciativa_com_os_tokens_da_pagina(): void
    {
        $c = $this->cenario();
        $e = $this->cmd($c, $c->mestre, 'iniciar', ['pagina_id' => $c->pagina->id])->assertOk()->json('combate');

        $this->assertSame('iniciativa', $e['fase']);
        $this->assertTrue($e['ativo']);
        $this->assertSame(['Aria', 'Bruno', 'Orc'], array_column($e['itens'], 'nome'));
        $this->assertSame(['jogadores', 'jogadores', 'inimigo'], array_column($e['itens'], 'disposicao'));
        $this->assertSame($c->tAria->id, $e['itens'][0]['objeto_id']);
    }

    public function test_jogador_rola_so_a_propria_iniciativa_uma_vez_e_o_mestre_rola_os_npcs(): void
    {
        $c = $this->cenario();
        $e = $this->cmd($c, $c->mestre, 'iniciar', ['pagina_id' => $c->pagina->id])->json('combate');
        $aria = $this->item($e, 'Aria');
        $bruno = $this->item($e, 'Bruno');

        $this->cmd($c, $c->ana, 'iniciativa', ['item_id' => $bruno['id']])->assertForbidden(); // personagem de outro jogador
        $r = $this->cmd($c, $c->ana, 'iniciativa', ['item_id' => $aria['id']])->assertOk()->json('combate');
        $total = $this->item($r, 'Aria')['iniciativa'];
        $this->assertGreaterThanOrEqual(1, $total);
        $this->cmd($c, $c->ana, 'iniciativa', ['item_id' => $aria['id']])->assertStatus(422); // só uma vez

        $r = $this->cmd($c, $c->mestre, 'rolar_npcs')->assertOk()->json('combate');
        $this->assertNotNull($this->item($r, 'Orc')['iniciativa']);
        $this->assertNull($this->item($r, 'Bruno')['iniciativa']); // o jogador rola a dele, o mestre não rola por ele aqui
        $this->assertSame($total, $this->item($r, 'Aria')['iniciativa']);

        $this->assertSame(2, $c->mesa->mensagens()->where('tipo', 'rolagem')->count()); // cartões de iniciativa no chat
    }

    public function test_comecar_ordena_por_iniciativa_e_abre_o_turno_do_primeiro(): void
    {
        $c = $this->cenario();
        $e = $this->cmd($c, $c->mestre, 'iniciar', ['pagina_id' => $c->pagina->id])->json('combate');
        $this->cmd($c, $c->mestre, 'comecar')->assertOk()->json(); // todos sem valor: ordem de entrada
        $this->cmd($c, $c->mestre, 'encerrar');
        $e = $this->cmd($c, $c->mestre, 'iniciar', ['pagina_id' => $c->pagina->id])->json('combate');
        foreach (['Aria' => 8, 'Bruno' => 17, 'Orc' => 12] as $nome => $v) {
            $this->cmd($c, $c->mestre, 'definir_iniciativa', ['item_id' => $this->item($e, $nome)['id'], 'iniciativa' => $v])->assertOk();
        }
        $r = $this->cmd($c, $c->mestre, 'comecar')->assertOk()->json('combate');

        $this->assertSame('em_curso', $r['fase']);
        $this->assertSame(['Bruno', 'Orc', 'Aria'], array_column($r['itens'], 'nome'));
        $this->assertSame($this->item($r, 'Bruno')['id'], $r['atual']);
        $this->cmd($c, $c->mestre, 'comecar')->assertStatus(422); // já em curso
    }

    public function test_mestre_passa_volta_escolhe_o_turno_e_a_rodada_muda_ao_dar_a_volta(): void
    {
        $c = $this->cenario();
        $e = $this->cmd($c, $c->mestre, 'iniciar', ['pagina_id' => $c->pagina->id])->json('combate');
        foreach (['Aria' => 20, 'Bruno' => 15, 'Orc' => 10] as $nome => $v) {
            $this->cmd($c, $c->mestre, 'definir_iniciativa', ['item_id' => $this->item($e, $nome)['id'], 'iniciativa' => $v]);
        }
        $this->cmd($c, $c->mestre, 'comecar');
        $nome = fn (array $r) => $this->item(['itens' => $r['itens']], collect($r['itens'])->firstWhere('id', $r['atual'])['nome'])['nome'];

        $r = $this->cmd($c, $c->mestre, 'turno')->json('combate');
        $this->assertSame(['Bruno', 1], [$nome($r), $r['rodada']]);
        $r = $this->cmd($c, $c->mestre, 'turno')->json('combate');
        $r = $this->cmd($c, $c->mestre, 'turno')->json('combate'); // deu a volta
        $this->assertSame(['Aria', 2], [$nome($r), $r['rodada']]);
        $r = $this->cmd($c, $c->mestre, 'turno', ['sentido' => 'anterior'])->json('combate'); // volta para o Orc da rodada 1
        $this->assertSame(['Orc', 1], [$nome($r), $r['rodada']]);
        $r = $this->cmd($c, $c->mestre, 'turno', ['sentido' => 'escolher', 'item_id' => $this->item($r, 'Bruno')['id']])->json('combate');
        $this->assertSame('Bruno', $nome($r));
        $this->cmd($c, $c->ana, 'turno')->assertForbidden(); // jogador não passa a vez
    }

    public function test_mestre_reordena_remove_e_adiciona_participantes(): void
    {
        $c = $this->cenario();
        $e = $this->cmd($c, $c->mestre, 'iniciar', ['pagina_id' => $c->pagina->id])->json('combate');
        $ids = array_column($e['itens'], 'id');

        $r = $this->cmd($c, $c->mestre, 'ordem', ['ids' => array_reverse($ids)])->assertOk()->json('combate');
        $this->assertSame(['Orc', 'Bruno', 'Aria'], array_column($r['itens'], 'nome'));
        $this->cmd($c, $c->mestre, 'ordem', ['ids' => [$ids[0]]])->assertStatus(422); // ordem incompleta

        $r = $this->cmd($c, $c->mestre, 'remover', ['item_id' => $ids[0]])->json('combate');
        $this->assertSame(2, count($r['itens']));
        $r = $this->cmd($c, $c->mestre, 'adicionar', ['nome' => 'Capanga', 'disposicao' => 'inimigo', 'iniciativa' => 5])->json('combate');
        $this->assertSame('Capanga', $this->item($r, 'Capanga')['nome']);
        $this->cmd($c, $c->mestre, 'definir_disposicao', ['item_id' => $this->item($r, 'Capanga')['id'], 'disposicao' => 'aliado'])->assertOk();
        $this->cmd($c, $c->mestre, 'adicionar', ['personagem_id' => $c->bruno->id])->assertStatus(422); // já está no combate
    }

    public function test_em_combate_so_o_token_de_quem_esta_no_turno_se_move(): void
    {
        $c = $this->cenario();
        $e = $this->cmd($c, $c->mestre, 'iniciar', ['pagina_id' => $c->pagina->id])->json('combate');
        $mover = fn (Jogador $j, $token) => $this->como($j)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $token->id]), ['x' => 5, 'y' => 5]);
        // Fora de combate em curso (iniciativa) ainda se move livremente
        $mover($c->ana, $c->tAria)->assertOk();

        foreach (['Aria' => 10, 'Bruno' => 20, 'Orc' => 1] as $nome => $v) {
            $this->cmd($c, $c->mestre, 'definir_iniciativa', ['item_id' => $this->item($e, $nome)['id'], 'iniciativa' => $v]);
        }
        $this->cmd($c, $c->mestre, 'comecar'); // turno do Bruno

        $mover($c->ana, $c->tAria)->assertForbidden(); // não é o turno da Aria
        $mover($c->bia, $c->tBruno)->assertOk();
        $this->como($c->mestre)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $c->tOrc->id]), ['x' => 9, 'y' => 9])->assertOk(); // o mestre sempre pode

        $this->cmd($c, $c->mestre, 'encerrar');
        $mover($c->ana, $c->tAria)->assertOk(); // sem combate, livre
    }

    public function test_sem_modulo_de_combate_a_iniciativa_e_1d20_e_dnd_tambem_participa(): void
    {
        $c = $this->cenario('dnd-5e');
        $e = $this->cmd($c, $c->mestre, 'iniciar', ['pagina_id' => $c->pagina->id])->assertOk()->json('combate');
        $r = $this->cmd($c, $c->ana, 'iniciativa', ['item_id' => $this->item($e, 'Aria')['id']])->assertOk()->json('combate');

        // ficha padrão: iniciativa +0 (DES 10): o total é o d20 puro
        $this->assertGreaterThanOrEqual(1, $this->item($r, 'Aria')['iniciativa']);
        $this->assertLessThanOrEqual(20, $this->item($r, 'Aria')['iniciativa']);
    }

    public function test_combate_no_formato_antigo_continua_valido(): void
    {
        $c = $this->cenario();
        $c->mesa->forceFill(['combate' => ['ativo' => true, 'rodada' => 3, 'atual' => 'a', 'itens' => [['id' => 'a', 'nome' => 'Velho', 'iniciativa' => 10, 'cor' => null, 'personagem_id' => null]]]])->save();

        $r = $this->cmd($c, $c->mestre, 'rodada', ['rodada' => 4])->assertOk()->json('combate');
        $this->assertSame('em_curso', $r['fase']);
        $this->assertEquals(['usado' => 0, 'bonus' => 0, 'base' => null], $r['itens'][0]['movimento']);
        $this->assertSame('inimigo', $r['itens'][0]['disposicao']);
    }

    /** Combate em curso: Bruno (20) no turno, depois Aria (10) e o Orc (1). */
    private function emCurso($c): array
    {
        $e = $this->cmd($c, $c->mestre, 'iniciar', ['pagina_id' => $c->pagina->id])->json('combate');
        foreach (['Aria' => 10, 'Bruno' => 20, 'Orc' => 1] as $nome => $v) {
            $this->cmd($c, $c->mestre, 'definir_iniciativa', ['item_id' => $this->item($e, $nome)['id'], 'iniciativa' => $v]);
        }

        return $this->cmd($c, $c->mestre, 'comecar')->json('combate');
    }

    private function agir($c, Jogador $quem, $personagem, string $categoria, bool $tecnica = false)
    {
        return $this->como($quem)->postJson(route('jogo.combate.acao', $c->mesa->id), ['personagem_id' => $personagem->id, 'categoria' => $categoria, 'tecnica' => $tecnica]);
    }

    public function test_fora_do_combate_em_curso_nada_e_bloqueado_nem_gasto(): void
    {
        $c = $this->cenario();
        $this->agir($c, $c->ana, $c->aria, 'padrao')->assertOk();
        $this->agir($c, $c->ana, $c->aria, 'padrao')->assertOk(); // sem limite fora do combate
        $this->assertSame([], $c->mesa->fresh()->combate['itens'] ?? []);
    }

    public function test_so_quem_esta_no_turno_gasta_acao_e_cada_categoria_tem_o_seu_limite(): void
    {
        $c = $this->cenario();
        $this->emCurso($c);

        $this->agir($c, $c->ana, $c->aria, 'padrao')->assertStatus(422)->assertJsonValidationErrors('acao'); // não é o turno da Aria
        $r = $this->agir($c, $c->bia, $c->bruno, 'padrao')->assertOk()->json('combate');
        $this->assertSame(1, $this->item($r, 'Bruno')['acoes']['padrao']);
        $this->agir($c, $c->bia, $c->bruno, 'padrao')->assertStatus(422); // só 1 ação por turno
        $this->agir($c, $c->bia, $c->bruno, 'bonus')->assertOk();
        $this->agir($c, $c->bia, $c->bruno, 'bonus')->assertStatus(422);
        foreach (range(1, 4) as $_) {
            $this->agir($c, $c->bia, $c->bruno, 'livre')->assertOk(); // livre não tem limite
        }
        $this->agir($c, $c->bia, $c->bruno, 'poderosa', false)->assertStatus(422); // poderosa só para técnicas
        $this->agir($c, $c->bia, $c->bruno, 'poderosa', true)->assertOk();
        $this->agir($c, $c->bia, $c->bruno, 'poderosa', true)->assertStatus(422);
        $this->agir($c, $c->ana, $c->bruno, 'livre')->assertForbidden(); // personagem de outro jogador
    }

    public function test_reacao_serve_fora_do_turno_uma_vez_por_rodada_e_volta_na_rodada_nova(): void
    {
        $c = $this->cenario();
        $this->emCurso($c);

        $this->agir($c, $c->ana, $c->aria, 'reacao')->assertOk(); // Aria reage no turno do Bruno
        $this->agir($c, $c->ana, $c->aria, 'reacao')->assertStatus(422); // 1 por rodada
        foreach (range(1, 3) as $_) {
            $this->cmd($c, $c->mestre, 'turno')->assertOk();
        }
        $this->agir($c, $c->ana, $c->aria, 'reacao')->assertOk(); // rodada 2: a reação voltou
    }

    public function test_acoes_voltam_ao_entrar_no_proprio_turno_e_o_mestre_devolve(): void
    {
        $c = $this->cenario();
        $e = $this->emCurso($c);
        $this->agir($c, $c->bia, $c->bruno, 'padrao')->assertOk();
        $this->cmd($c, $c->mestre, 'turno'); // Aria
        $this->cmd($c, $c->mestre, 'turno'); // Orc
        $this->cmd($c, $c->mestre, 'turno'); // volta ao Bruno: ações novas
        $this->agir($c, $c->bia, $c->bruno, 'padrao')->assertOk();

        $this->agir($c, $c->bia, $c->bruno, 'padrao')->assertStatus(422);
        $bruno = $this->item($e, 'Bruno');
        $r = $this->cmd($c, $c->mestre, 'devolver', ['item_id' => $bruno['id'], 'categoria' => 'padrao'])->assertOk()->json('combate');
        $this->assertArrayNotHasKey('padrao', $this->item($r, 'Bruno')['acoes']);
        $this->agir($c, $c->bia, $c->bruno, 'padrao')->assertOk();
        $this->cmd($c, $c->mestre, 'devolver', ['item_id' => $bruno['id'], 'categoria' => 'todas'])->assertOk();
        $this->cmd($c, $c->ana, 'devolver', ['item_id' => $bruno['id'], 'categoria' => 'todas'])->assertForbidden();
    }

    public function test_mestre_nao_e_recusado_e_participante_fora_do_encontro_age_livremente(): void
    {
        $c = $this->cenario();
        $this->emCurso($c);
        $this->agir($c, $c->mestre, $c->orc, 'padrao')->assertOk(); // o Orc não está no turno, mas o mestre manda
        $this->agir($c, $c->mestre, $c->orc, 'padrao')->assertOk();

        $c->mesa->personagens()->create(['nome' => 'Visitante', 'cor' => '#fff'])->jogadores()->attach($c->ana);
        $visitante = $c->mesa->personagens()->where('nome', 'Visitante')->first();
        $this->agir($c, $c->ana, $visitante, 'padrao')->assertOk(); // fora do encontro: não bloqueia
    }

    public function test_rolagem_com_acao_gasta_a_categoria_e_recusa_fora_do_turno(): void
    {
        $c = $this->cenario();
        $this->emCurso($c);
        $rolar = fn (Jogador $j, $personagem) => $this->como($j)->postJson(route('jogo.rolagens.store', $c->mesa->id), ['expressao' => '1d20', 'visibilidade' => 'todos', 'personagem_id' => $personagem->id, 'acao' => ['categoria' => 'padrao']]);

        $rolar($c->ana, $c->aria)->assertStatus(422); // não é o turno dela
        $rolar($c->bia, $c->bruno)->assertCreated();
        $rolar($c->bia, $c->bruno)->assertStatus(422); // a ação padrão já foi
        $this->assertSame(1, $c->mesa->mensagens()->where('tipo', 'rolagem')->count()); // a recusada não gerou rolagem
    }

    public function test_pagina_envia_as_categorias_de_acao_do_sistema(): void
    {
        $c = $this->cenario();
        $r = $this->como($c->ana)->get(route('jogo', [$c->mesa->slug, $c->ana->id]));
        $r->assertInertia(fn ($p) => $p->where('categoriasDeAcao.0.id', 'padrao')->where('categoriasDeAcao.1.id', 'poderosa')->where('categoriasDeAcao.4.porRodada', 1));
    }

    /** A página do cenário: quadrado de 100 px = 1,5 m. Bruno (turno): ficha padrão do One Piece = 9 m de deslocamento. */
    private function escala($c): void
    {
        $c->pagina->update(['tamanho_quadrado' => 100, 'distancia_quadrado' => 1.5, 'unidade' => 'm']);
    }

    private function mover($c, Jogador $j, $token, float $x, float $y)
    {
        return $this->como($j)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $token->id]), ['x' => $x, 'y' => $y]);
    }

    public function test_o_turno_comeca_com_o_deslocamento_do_sistema_na_base(): void
    {
        $c = $this->cenario();
        $e = $this->emCurso($c);

        $this->assertEquals(9.0, $this->item($e, 'Bruno')['movimento']['base']); // ficha padrão: 9 m
        $this->assertEquals(0.0, $this->item($e, 'Bruno')['movimento']['usado']);
    }

    public function test_o_movimento_conta_em_metros_pela_escala_da_pagina_e_trava_no_limite(): void
    {
        $c = $this->cenario();
        $this->escala($c);
        $this->emCurso($c);
        $c->tBruno->update(['x' => 0, 'y' => 0]);

        // 300 px = 3 quadrados = 4,5 m
        $this->mover($c, $c->bia, $c->tBruno, 300, 0)->assertOk()->assertJsonPath('x', 300);
        $item = $this->item($c->mesa->fresh()->combate, 'Bruno');
        $this->assertEqualsWithDelta(4.5, $item['movimento']['usado'], 0.01);

        // mais 600 px (9 m) passaria dos 9 m: trava a 4,5 m restantes = 300 px (chega em x = 600)
        $r = $this->mover($c, $c->bia, $c->tBruno, 900, 0)->assertOk()->json();
        $this->assertEqualsWithDelta(600, $r['x'], 0.5);
        $this->assertEqualsWithDelta(9.0, $this->item($c->mesa->fresh()->combate, 'Bruno')['movimento']['usado'], 0.01);

        // esgotado: qualquer passo trava no lugar
        $r = $this->mover($c, $c->bia, $c->tBruno, 700, 0)->assertOk()->json();
        $this->assertEqualsWithDelta(600, $r['x'], 0.5);
    }

    public function test_mestre_move_alem_do_limite_mas_o_movimento_do_turno_atual_fica_anotado(): void
    {
        $c = $this->cenario();
        $this->escala($c);
        $this->emCurso($c);
        $c->tBruno->update(['x' => 0, 'y' => 0]);

        $r = $this->mover($c, $c->mestre, $c->tBruno, 1500, 0)->assertOk()->json(); // 22,5 m, sem trava
        $this->assertEqualsWithDelta(1500, $r['x'], 0.5);
        $this->assertEqualsWithDelta(22.5, $this->item($c->mesa->fresh()->combate, 'Bruno')['movimento']['usado'], 0.01);

        $this->mover($c, $c->mestre, $c->tOrc, 50, 50)->assertOk(); // outro participante: nada é anotado
        $this->assertEquals(0.0, $this->item($c->mesa->fresh()->combate, 'Orc')['movimento']['usado']);
    }

    public function test_disparada_gasta_a_acao_padrao_e_soma_outro_deslocamento_uma_vez_por_turno(): void
    {
        $c = $this->cenario();
        $this->escala($c);
        $this->emCurso($c);
        $disparar = fn (Jogador $j, $p) => $this->como($j)->postJson(route('jogo.combate.disparada', $c->mesa->id), ['personagem_id' => $p->id]);

        $disparar($c->ana, $c->aria)->assertStatus(422); // não é o turno da Aria
        $r = $disparar($c->bia, $c->bruno)->assertOk()->json('combate');
        $this->assertEquals(9.0, $this->item($r, 'Bruno')['movimento']['bonus']);
        $this->assertSame(1, $this->item($r, 'Bruno')['acoes']['padrao']);
        $disparar($c->bia, $c->bruno)->assertStatus(422); // a ação padrão já foi

        // com 18 m no turno, anda 15 m sem travar (1000 px = 15 m)
        $c->tBruno->update(['x' => 0, 'y' => 0]);
        $this->mover($c, $c->bia, $c->tBruno, 1000, 0)->assertOk()->assertJsonPath('x', 1000);
    }

    public function test_mestre_zera_o_movimento_e_define_valores(): void
    {
        $c = $this->cenario();
        $this->escala($c);
        $e = $this->emCurso($c);
        $bruno = $this->item($e, 'Bruno');
        $c->tBruno->update(['x' => 0, 'y' => 0]);
        $this->mover($c, $c->bia, $c->tBruno, 300, 0)->assertOk();

        $r = $this->cmd($c, $c->mestre, 'devolver', ['item_id' => $bruno['id'], 'categoria' => 'movimento'])->assertOk()->json('combate');
        $this->assertEquals(0.0, $this->item($r, 'Bruno')['movimento']['usado']);
        $r = $this->cmd($c, $c->mestre, 'definir_movimento', ['item_id' => $bruno['id'], 'bonus' => 3])->assertOk()->json('combate');
        $this->assertEquals(3.0, $this->item($r, 'Bruno')['movimento']['bonus']);
        $this->cmd($c, $c->ana, 'definir_movimento', ['item_id' => $bruno['id'], 'bonus' => 99])->assertForbidden();
    }

    public function test_unidade_em_pes_converte_para_metros_e_a_base_renova_a_cada_turno(): void
    {
        $c = $this->cenario();
        $c->pagina->update(['tamanho_quadrado' => 100, 'distancia_quadrado' => 5, 'unidade' => 'ft']); // 5 ft = 1,524 m por quadrado
        $this->emCurso($c);
        $c->tBruno->update(['x' => 0, 'y' => 0]);
        $this->mover($c, $c->bia, $c->tBruno, 100, 0)->assertOk();
        $this->assertEqualsWithDelta(1.524, $this->item($c->mesa->fresh()->combate, 'Bruno')['movimento']['usado'], 0.01);

        foreach (range(1, 3) as $_) {
            $this->cmd($c, $c->mestre, 'turno');
        }
        $this->assertEquals(0.0, $this->item($c->mesa->fresh()->combate, 'Bruno')['movimento']['usado']); // turno novo: zerado
    }

    public function test_adicionar_varios_personagens_de_uma_vez_pula_os_que_ja_estao_e_liga_aos_tokens(): void
    {
        $c = $this->cenario();
        $e = $this->cmd($c, $c->mestre, 'iniciar', ['pagina_id' => $c->pagina->id])->json('combate');
        $this->cmd($c, $c->mestre, 'remover', ['item_id' => $this->item($e, 'Aria')['id']]);
        $this->cmd($c, $c->mestre, 'remover', ['item_id' => $this->item($e, 'Orc')['id']]);

        $r = $this->cmd($c, $c->mestre, 'adicionar_varios', ['personagem_ids' => [$c->aria->id, $c->bruno->id, $c->orc->id], 'pagina_id' => $c->pagina->id])->assertOk()->json('combate');

        $this->assertSame(3, count($r['itens'])); // o Bruno já estava: não duplica
        $this->assertSame(['jogadores', 'inimigo'], [$this->item($r, 'Aria')['disposicao'], $this->item($r, 'Orc')['disposicao']]);
        $this->assertSame($c->tAria->id, $this->item($r, 'Aria')['objeto_id']);
        $this->cmd($c, $c->mestre, 'adicionar_varios', ['personagem_ids' => []])->assertStatus(422);
        $this->cmd($c, $c->ana, 'adicionar_varios', ['personagem_ids' => [$c->aria->id]])->assertForbidden();
    }
}
