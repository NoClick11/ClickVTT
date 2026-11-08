<?php

namespace Tests\Feature\Jogo;

use App\Events\EventoMesa;
use App\Models\EventoDeCombate;
use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Nucleo\Combate\Pipeline;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/** Ataque com alvo: janela de reação, modificadores redirecionados e resolução (acerto ou erro) no servidor. */
class ReacaoTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(): object
    {
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $bia = $mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $aria->jogadores()->attach($ana);
        $bruno = $mesa->personagens()->create(['nome' => 'Bruno', 'cor' => '#ef4444']);
        $bruno->jogadores()->attach($bia);
        $orc = $mesa->personagens()->create(['nome' => 'Orc', 'cor' => '#555555']);
        $pagina = $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
        foreach ([$aria, $bruno, $orc] as $i => $p) {
            $pagina->objetos()->create(['camada' => 'jogadores', 'tipo' => 'token', 'personagem_id' => $p->id, 'nome' => $p->nome, 'x' => $i * 100, 'y' => 0, 'largura' => 50, 'altura' => 50, 'z' => 1]);
        }

        return (object) compact('mesa', 'mestre', 'ana', 'bia', 'aria', 'bruno', 'orc', 'pagina');
    }

    private function como(Jogador $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => [$p->id => true]]])->withHeader('X-Jogador', (string) $p->id);
    }

    private function cmd($c, string $comando, array $d = [])
    {
        return $this->como($c->mestre)->postJson(route('jogo.combate.comando', $c->mesa->id), ['comando' => $comando, ...$d])->assertOk()->json('combate');
    }

    private function ficha($c, Jogador $dono, $personagem, array $campos): void
    {
        $this->como($dono)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $personagem->id]), ['campos' => $campos])->assertOk();
    }

    /** Combate em curso: Bruno (20), Aria (10), Orc (1); Aria com defesa 11 (CA 10 + ajuste 1). */
    private function combate($c): void
    {
        $e = $this->cmd($c, 'iniciar', ['pagina_id' => $c->pagina->id]);
        foreach (['Bruno' => 20, 'Aria' => 10, 'Orc' => 1] as $nome => $v) {
            $this->cmd($c, 'definir_iniciativa', ['item_id' => collect($e['itens'])->firstWhere('nome', $nome)['id'], 'iniciativa' => $v]);
        }
        $this->cmd($c, 'comecar');
        $this->ficha($c, $c->ana, $c->aria, ['ajustes.ca' => 1, 'pv.max' => 20, 'pv.atual' => 10]);
    }

    /** O Orc ataca a Aria: `10+@ataque` = 12 (ataque +2 na ficha padrão) contra defesa 11. */
    private function ataque($c, int $alvo = null)
    {
        return $this->como($c->mestre)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => '10+@ataque', 'visibilidade' => 'todos', 'personagem_id' => $c->orc->id, 'alvo_personagem_id' => $alvo ?? $c->aria->id, 'rotulo' => 'Machadada',
        ])->assertCreated();
    }

    /** O Bruno (aliado da Aria) tem a técnica "Proteger": reação a aliado, +3 na defesa de quem foi atacado, custa 2 PP. */
    private function protetor($c, array $extra = []): void
    {
        $this->ficha($c, $c->bia, $c->bruno, ['pp.atual' => 6, 'tecnicas.lista' => [[
            'nome' => 'Proteger', 'origem' => 'Estilo', 'custo' => 2, 'alcance' => '', 'efeito' => '+3 na defesa', 'rolagem' => '', 'descricao' => 'Cobre um aliado.', 'acao' => 'reacao',
            'reacao' => ['gatilho' => 'ataque_declarado', 'alcance' => 'aliado', 'defesa' => 3, ...$extra],
        ]]]);
    }

    private function resolucao($c, int $mensagemId): array
    {
        return $c->mesa->mensagens()->find($mensagemId)->dados['sistema']['resolucao'];
    }

    public function test_sem_reacao_disponivel_o_ataque_resolve_na_hora(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $m = $this->ataque($c)->json();

        $r = $this->resolucao($c, $m['id']);
        $this->assertSame('resolvido', $r['estado']);
        $this->assertTrue($r['acerto']); // 12 contra 11
        $this->assertSame(11, $r['defesa']);
        $this->assertSame(1, $c->mesa->mensagens()->where('tipo', 'texto')->where('texto', 'like', '%acerta%')->count());
        $this->assertSame('resolvido', EventoDeCombate::first()->estado);
    }

    public function test_reacao_de_um_aliado_sobe_a_defesa_de_quem_foi_atacado_e_o_ataque_erra(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $this->combate($c);
        $this->protetor($c);
        $m = $this->ataque($c)->json();

        $r = $this->resolucao($c, $m['id']);
        $this->assertSame('aguardando', $r['estado']); // a janela abriu
        $evento = EventoDeCombate::first();
        $this->assertSame([$c->bruno->id], $evento->aguardando()); // só o Bruno tem o que usar: a Aria (alvo) não tem reação 'si'
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->nome === 'reacao' && $e->canais === ["jogador.{$c->bia->id}"] && $e->payload['opcoes'][0]['defesa'] === 3);

        $this->como($c->bia)->postJson(route('jogo.combate.eventos.reagir', [$c->mesa->id, $evento->id]), ['personagem_id' => $c->bruno->id, 'opcao' => 't:0'])->assertOk()->assertJsonPath('estado', 'resolvido');

        $r = $this->resolucao($c, $m['id']);
        $this->assertSame('resolvido', $r['estado']);
        $this->assertFalse($r['acerto']); // 12 contra 11 + 3 = 14
        $this->assertSame(14, $r['defesa']);
        $this->assertSame([['fonte' => 'Proteger', 'valor' => 3]], $r['mods']);
        $this->assertSame(4, $c->bruno->fresh()->ficha['pp']['atual']); // pagou 2 PP
        $item = collect($c->mesa->fresh()->combate['itens'])->firstWhere('nome', 'Bruno');
        $this->assertSame(1, $item['acoes']['reacao']); // gastou a reação da rodada
    }

    public function test_passar_deixa_o_ataque_acertar_e_cada_um_so_responde_uma_vez(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $this->protetor($c);
        $this->ataque($c);
        $evento = EventoDeCombate::first();
        $rota = route('jogo.combate.eventos.reagir', [$c->mesa->id, $evento->id]);

        $this->como($c->ana)->postJson($rota, ['personagem_id' => $c->bruno->id, 'opcao' => 't:0'])->assertForbidden(); // não é o personagem dela
        $this->como($c->bia)->postJson($rota, ['personagem_id' => $c->bruno->id, 'opcao' => 'x:9'])->assertStatus(422); // opção inexistente
        $this->como($c->bia)->postJson($rota, ['personagem_id' => $c->bruno->id])->assertOk()->assertJsonPath('resultado.acerto', true);
        $this->como($c->bia)->postJson($rota, ['personagem_id' => $c->bruno->id])->assertStatus(422); // a janela já fechou
        $this->assertSame(6, $c->bruno->fresh()->ficha['pp']['atual']); // passar não custa nada
    }

    public function test_o_mestre_encerra_a_janela_e_quem_nao_respondeu_conta_como_passou(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $this->protetor($c);
        $m = $this->ataque($c)->json();
        $evento = EventoDeCombate::first();

        $this->como($c->bia)->postJson(route('jogo.combate.eventos.encerrar', [$c->mesa->id, $evento->id]))->assertForbidden();
        $this->como($c->mestre)->postJson(route('jogo.combate.eventos.encerrar', [$c->mesa->id, $evento->id]))->assertOk()->assertJsonPath('resultado.acerto', true);
        $this->assertSame('resolvido', $this->resolucao($c, $m['id'])['estado']);
    }

    public function test_a_reacao_e_uma_por_rodada_e_sem_pp_nao_e_oferecida(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $this->protetor($c);
        $this->ataque($c);
        $this->como($c->bia)->postJson(route('jogo.combate.eventos.reagir', [$c->mesa->id, EventoDeCombate::first()->id]), ['personagem_id' => $c->bruno->id, 'opcao' => 't:0'])->assertOk();

        $this->ataque($c); // mesma rodada: a reação do Bruno já foi, nada é oferecido de novo
        $this->assertSame('resolvido', EventoDeCombate::latest('id')->first()->estado);
        $this->assertSame([], EventoDeCombate::latest('id')->first()->ofertas);

        $this->cmd($c, 'turno'); $this->cmd($c, 'turno'); $this->cmd($c, 'turno'); // rodada 2: a reação volta
        $this->ficha($c, $c->bia, $c->bruno, ['pp.atual' => 1]); // mas sem PP (custa 2)
        $this->ataque($c);
        $this->assertSame([], EventoDeCombate::latest('id')->first()->ofertas);
        $this->ficha($c, $c->bia, $c->bruno, ['pp.atual' => 2]);
        $this->ataque($c);
        $this->assertNotSame([], EventoDeCombate::latest('id')->first()->ofertas);
    }

    public function test_alcance_si_so_serve_ao_alvo_e_o_inimigo_nao_reage_pelo_lado_do_alvo(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        // A própria Aria tem uma esquiva (só para si); o Orc (inimigo) tem uma proteção para aliados dele: não serve a quem ataca a Aria
        $this->ficha($c, $c->ana, $c->aria, ['pp.atual' => 4, 'tecnicas.lista' => [[
            'nome' => 'Esquiva', 'origem' => '', 'custo' => 1, 'alcance' => '', 'efeito' => '', 'rolagem' => '', 'descricao' => '', 'acao' => 'reacao', 'reacao' => ['gatilho' => 'ataque_declarado', 'alcance' => 'si', 'defesa' => 2],
        ]]]);
        // o Bruno passa para o lado dos inimigos (a Aria só é atacada por quem é do outro lado) e tem a proteção para aliados dele
        $itens = collect(\App\Nucleo\Combate\CombateService::normalizar(\App\Models\Mesa::find($c->mesa->id)->combate)['itens']);
        $this->cmd($c, 'definir_disposicao', ['item_id' => $itens->firstWhere('nome', 'Bruno')['id'], 'disposicao' => 'inimigo']);
        $this->como($c->mestre)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->bruno->id]), ['campos' => ['pp.atual' => 5, 'tecnicas.lista' => [[
            'nome' => 'Cobrir', 'origem' => '', 'custo' => 1, 'alcance' => '', 'efeito' => '', 'rolagem' => '', 'descricao' => '', 'acao' => 'reacao', 'reacao' => ['gatilho' => 'ataque_declarado', 'alcance' => 'ambos', 'defesa' => 5],
        ]]]])->assertOk();
        $this->como($c->mestre)->postJson(route('jogo.rolagens.store', $c->mesa->id), ['expressao' => '10+@ataque', 'visibilidade' => 'todos', 'personagem_id' => $c->orc->id, 'alvo_personagem_id' => $c->aria->id])->assertCreated();

        $evento = EventoDeCombate::first();
        $this->assertSame([$c->aria->id], $evento->aguardando()); // a Esquiva da Aria; o Bruno agora é do outro lado
    }

    public function test_reacao_de_cura_cura_quem_foi_atacado_ate_o_maximo(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $this->protetor($c, ['defesa' => 0, 'cura' => '5']);
        $this->ataque($c);
        $this->como($c->bia)->postJson(route('jogo.combate.eventos.reagir', [$c->mesa->id, EventoDeCombate::first()->id]), ['personagem_id' => $c->bruno->id, 'opcao' => 't:0'])->assertOk();

        $this->assertSame(15, $c->aria->fresh()->ficha['pv']['atual']); // 10 + 5
    }

    public function test_fora_do_combate_em_curso_resolve_na_hora_sem_janela_e_a_pagina_traz_as_ofertas_pendentes(): void
    {
        $c = $this->cenario();
        $this->ataque($c); // sem combate: o ataque contra o alvo travado rola contra a defesa na hora, sem janela de reação
        $this->assertSame(1, EventoDeCombate::count());
        $this->assertSame('resolvido', EventoDeCombate::first()->estado);
        $this->assertSame([], EventoDeCombate::first()->ofertas);

        $this->combate($c);
        $this->protetor($c);
        $this->ataque($c);
        $this->como($c->bia)->get(route('jogo', [$c->mesa->slug, $c->bia->id]))->assertInertia(fn ($p) => $p
            ->where('reacoes.eventos.0.estado', 'aguardando')->where('reacoes.ofertas.0.personagem_id', $c->bruno->id)->where('reacoes.ofertas.0.opcoes.0.id', 't:0'));
        $this->como($c->ana)->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->assertInertia(fn ($p) => $p->where('reacoes.ofertas', []));
    }

    public function test_d20_puro_do_ataque(): void
    {
        $termos = [['tipo' => 'dados', 'faces' => 20, 'resultados' => [3, 17], 'descartados' => [0]], ['tipo' => 'numero', 'valor' => 5]];
        $this->assertSame(17, Pipeline::naturalDoD20($termos)); // o mantido (vantagem)
        $this->assertNull(Pipeline::naturalDoD20([['tipo' => 'numero', 'valor' => 5]]));
    }

    private function aplicarDano($c, int $personagemId, int $dano, array $contexto = []): array
    {
        $sistema = app(\App\Nucleo\Sistemas\RegistroSistemas::class)->resolver('one-piece');

        return \Illuminate\Support\Facades\DB::transaction(fn () => app(\App\Nucleo\Combate\AplicarDano::class)->aplicar($c->mesa, $personagemId, $sistema, $dano, 'Contundente', [], null, $contexto));
    }

    private function traco($c, string $nome, int $nivelMin): void
    {
        $this->ficha($c, $c->ana, $c->aria, ['nivel' => 12, 'caracteristicas' => [[
            'nome' => $nome, 'origem' => 'Estilo', 'tipo' => 'passiva', 'descricao' => '', 'nivelMin' => $nivelMin,
        ]]]);
    }

    private function reagir($c, Jogador $dono, $personagem, string $opcao): void
    {
        $this->como($dono)->postJson(route('jogo.combate.eventos.reagir', [$c->mesa->id, EventoDeCombate::latest('id')->first()->id]), ['personagem_id' => $personagem->id, 'opcao' => $opcao])->assertOk();
    }

    public function test_yamantaka_arma_a_reserva_ao_ser_atacado_e_o_dano_seguinte_e_absorvido(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $this->ficha($c, $c->ana, $c->aria, ['pp.atual' => 8, 'tecnicas.lista' => [[
            'nome' => 'Yamantaka', 'origem' => 'Estilo', 'custo' => 4, 'alcance' => 'Pessoal', 'efeito' => 'reserva', 'rolagem' => '', 'descricao' => 'Reserva de redução.', 'acao' => 'reacao',
            'reacao' => ['gatilho' => 'ataque_declarado', 'alcance' => 'si', 'reducao' => ['reserva' => '10d8', 'mais' => '2d8', 'maximo' => 20]],
        ]]]);
        $this->ataque($c);
        $this->reagir($c, $c->ana, $c->aria, 't:0');

        $f = $c->aria->fresh()->fichaCompleta(app(\App\Nucleo\Sistemas\RegistroSistemas::class)->resolver('one-piece'));
        $reserva = $f['reducao']['reserva'];
        $this->assertGreaterThanOrEqual(10, $reserva);
        $this->assertLessThanOrEqual(80, $reserva);
        $this->assertSame(10, $f['reducao']['dados']);
        $this->assertSame(4, $f['pp']['atual']); // 8 - 4 PP

        $r = $this->aplicarDano($c, $c->aria->id, 200);
        $this->assertSame(200 - $reserva, $r['calculo']['final']);
        $this->assertStringContainsString('reserva de redução', (string) $r['aviso']);
        $f = $c->aria->fresh()->fichaCompleta(app(\App\Nucleo\Sistemas\RegistroSistemas::class)->resolver('one-piece'));
        $this->assertSame(0, $f['reducao']['reserva']);
    }

    public function test_corpo_de_criatura_so_gasta_o_uso_quando_zera_o_dano(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $this->ficha($c, $c->ana, $c->aria, ['caracteristicas' => [[
            'nome' => 'Corpo de Criatura', 'origem' => 'Brutamontes', 'tipo' => 'passiva', 'usos' => ['atual' => 3, 'max' => 3], 'descricao' => '',
            'reacao' => ['gatilho' => 'ataque_declarado', 'alcance' => 'si', 'reducao' => ['zerar' => true]],
        ]]]);
        $this->ataque($c);
        $this->reagir($c, $c->ana, $c->aria, 'c:0');
        $sis = app(\App\Nucleo\Sistemas\RegistroSistemas::class)->resolver('one-piece');
        $f = $c->aria->fresh()->fichaCompleta($sis);
        $this->assertTrue($f['reducao']['zerar']);
        $this->assertSame(3, $f['caracteristicas'][0]['usos']['atual']); // armar não gasta o uso

        $pvAntes = $f['pv']['atual'];
        $r = $this->aplicarDano($c, $c->aria->id, 20);
        $this->assertSame(0, $r['calculo']['final']);
        $f = $c->aria->fresh()->fichaCompleta($sis);
        $this->assertSame($pvAntes, $f['pv']['atual']);
        $this->assertSame(2, $f['caracteristicas'][0]['usos']['atual']);
        $this->assertFalse($f['reducao']['zerar']);
        // o dano seguinte volta ao normal
        $this->assertSame(5, $this->aplicarDano($c, $c->aria->id, 5)['calculo']['final']);
    }

    public function test_a_reducao_vence_no_fim_do_turno_do_dono_e_ao_encerrar_o_combate(): void
    {
        $c = $this->cenario();
        $this->combate($c); // vez do Bruno (20); a Aria é a seguinte
        $sis = app(\App\Nucleo\Sistemas\RegistroSistemas::class)->resolver('one-piece');
        $this->ficha($c, $c->ana, $c->aria, ['reducao' => ['reserva' => 30, 'dados' => 10, 'turnos' => 1]]);
        $this->cmd($c, 'turno'); // entra a Aria: ainda não acabou o turno dela
        $this->assertSame(30, $c->aria->fresh()->fichaCompleta($sis)['reducao']['reserva']);
        $this->cmd($c, 'turno'); // acaba o turno da Aria: a reserva vence
        $this->assertEmpty($c->aria->fresh()->fichaCompleta($sis)['reducao']);

        // ao encerrar o combate, condições com duração e reduções não ficam presas
        $this->ficha($c, $c->ana, $c->aria, ['reducao' => ['zerar' => true, 'turnos' => 2], 'condicoes' => ['atordoado'], 'duracoes' => ['atordoado' => ['turnos' => 3, 'aoDano' => false]]]);
        $this->cmd($c, 'encerrar');
        $f = $c->aria->fresh()->fichaCompleta($sis);
        $this->assertEmpty($f['reducao']);
        $this->assertSame([], $f['duracoes']);
        $this->assertNotContains('atordoado', $f['condicoes']);
    }

    public function test_parry_shot_e_reacao_defensiva_de_uso_unico_a_reserva_nao_sobra(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $sis = app(\App\Nucleo\Sistemas\RegistroSistemas::class)->resolver('one-piece');
        $this->ficha($c, $c->ana, $c->aria, ['pp.atual' => 6, 'tecnicas.lista' => [[
            'nome' => 'Parry Shot', 'origem' => 'Estilo', 'custo' => 3, 'alcance' => 'Pessoal', 'efeito' => 'reduz', 'rolagem' => '', 'descricao' => 'Reduz o dano.', 'acao' => 'reacao',
            'reacao' => ['gatilho' => 'ataque_declarado', 'alcance' => 'si', 'reducao' => ['reserva' => '8d8', 'mais' => '2d8', 'maximo' => 20, 'unica' => true]],
        ]]]);
        $this->ataque($c);
        $this->reagir($c, $c->ana, $c->aria, 't:0');
        $f = $c->aria->fresh()->fichaCompleta($sis);
        $this->assertSame(8, $f['reducao']['dados']);
        $this->assertTrue($f['reducao']['unica']);

        $primeiro = $this->aplicarDano($c, $c->aria->id, 1000);
        $this->assertSame(1000 - $f['reducao']['reserva'], $primeiro['calculo']['final']);
        $f = $c->aria->fresh()->fichaCompleta($sis);
        $this->assertSame(0, $f['reducao']['reserva']); // uso único: não sobra reserva
        $this->assertSame(7, $this->aplicarDano($c, $c->aria->id, 7)['calculo']['final']);
    }

    public function test_rompante_defensivo_corta_pela_metade_so_a_primeira_vez_da_rodada_e_volta_na_rodada_nova(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $this->traco($c, 'Guarda Astuta: Rompante Defensivo', 2);
        $this->assertSame(10, $this->aplicarDano($c, $c->aria->id, 20, ['origem' => 'ataque'])['calculo']['final']);
        $this->assertSame(20, $this->aplicarDano($c, $c->aria->id, 20, ['origem' => 'ataque'])['calculo']['final']); // já usou nesta rodada
        $this->assertSame(20, $this->aplicarDano($c, $c->aria->id, 20, ['origem' => 'tecnica'])['calculo']['final']); // só ataque (comum)
        foreach (range(1, 3) as $_) {
            $this->cmd($c, 'turno');
        }
        $this->assertSame(10, $this->aplicarDano($c, $c->aria->id, 20, ['origem' => 'ataque'])['calculo']['final']); // rodada 2
    }

    public function test_esquiva_fugaz_e_controle_do_ambiente_mudam_o_dano_das_salvaguardas(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $this->traco($c, 'Guarda Astuta: Esquiva Fugaz', 8);
        $des = fn (bool $passou, int $dano) => $this->aplicarDano($c, $c->aria->id, $dano, ['origem' => 'salvaguarda', 'atributo' => 'des', 'passou' => $passou])['calculo']['final'];
        $this->assertSame(0, $des(true, 10)); // passou: nada (o dano chega já pela metade)
        $this->assertSame(10, $des(false, 20)); // falhou: metade
        $this->assertSame(20, $this->aplicarDano($c, $c->aria->id, 20, ['origem' => 'salvaguarda', 'atributo' => 'con', 'passou' => false])['calculo']['final']);

        $this->traco($c, 'Controle do Ambiente', 11);
        $this->assertSame(0, $des(false, 20));
        $this->assertSame(0, $this->aplicarDano($c, $c->aria->id, 20, ['origem' => 'salvaguarda', 'atributo' => 'for', 'passou' => false])['calculo']['final']);
        $this->assertSame(20, $this->aplicarDano($c, $c->aria->id, 20, ['origem' => 'salvaguarda', 'atributo' => 'con', 'passou' => false])['calculo']['final']);
    }

    private function pool($c, int $dados = 10): array
    {
        return ['nome' => 'Dados Heroicos', 'origem' => 'Herói', 'tipo' => 'passiva', 'usos' => ['atual' => $dados, 'max' => 10], 'descricao' => ''];
    }

    public function test_virada_heroica_so_aparece_com_pv_abaixo_da_metade_e_gasta_5_dados_ao_zerar_o_dano(): void
    {
        $c = $this->cenario();
        $this->combate($c); // a Aria tem 10 de 20 PV (não é menos da metade)
        $sis = app(\App\Nucleo\Sistemas\RegistroSistemas::class)->resolver('one-piece');
        $virada = ['nome' => 'Guerreiro do Poder Oculto (5º): Virada Heroica', 'origem' => 'Herói', 'tipo' => 'passiva', 'descricao' => '',
            'reacao' => ['gatilho' => 'ataque_declarado', 'alcance' => 'si', 'reducao' => ['zerar' => true, 'gasta' => ['de' => 'Dados Heroicos', 'qtd' => 5], 'pvAbaixoDaMetade' => true]]];
        $this->ficha($c, $c->ana, $c->aria, ['caracteristicas' => [$this->pool($c), $virada]]);
        $this->ataque($c);
        $this->assertSame([], EventoDeCombate::latest('id')->first()->ofertas); // 10 de 20 PV: não está abaixo da metade

        $this->ficha($c, $c->ana, $c->aria, ['pv.atual' => 9]);
        $this->cmd($c, 'turno'); $this->cmd($c, 'turno'); $this->cmd($c, 'turno'); // outra rodada: a reação voltou
        $this->ataque($c);
        $this->assertNotSame([], EventoDeCombate::latest('id')->first()->ofertas);
        $this->reagir($c, $c->ana, $c->aria, 'c:1');
        $f = $c->aria->fresh()->fichaCompleta($sis);
        $this->assertTrue($f['reducao']['zerar']);
        $this->assertSame(10, $f['caracteristicas'][0]['usos']['atual']); // armar não gasta os dados

        $r = $this->aplicarDano($c, $c->aria->id, 30);
        $this->assertSame(0, $r['calculo']['final']);
        $f = $c->aria->fresh()->fichaCompleta($sis);
        $this->assertSame(5, $f['caracteristicas'][0]['usos']['atual']); // 5 Dados Heroicos gastos
        $this->assertFalse($f['reducao']['zerar']);
    }

    public function test_escudo_do_deus_da_arma_gasta_3_dados_ao_armar_e_reduz_so_o_proximo_dano(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $sis = app(\App\Nucleo\Sistemas\RegistroSistemas::class)->resolver('one-piece');
        $escudo = ['nome' => 'Escudo (5º): reduzir o dano', 'origem' => 'Herói', 'tipo' => 'passiva', 'descricao' => '',
            'reacao' => ['gatilho' => 'ataque_declarado', 'alcance' => 'si', 'reducao' => ['reserva' => '3d10', 'unica' => true, 'gasta' => ['de' => 'Dados Heroicos', 'qtd' => 3]]]];
        $this->ficha($c, $c->ana, $c->aria, ['caracteristicas' => [$this->pool($c), $escudo]]);
        $this->ataque($c);
        $this->reagir($c, $c->ana, $c->aria, 'c:1');
        $f = $c->aria->fresh()->fichaCompleta($sis);
        $this->assertSame(7, $f['caracteristicas'][0]['usos']['atual']); // 3 dados gastos ao armar
        $reserva = $f['reducao']['reserva'];
        $this->assertGreaterThanOrEqual(3, $reserva);
        $this->assertLessThanOrEqual(30, $reserva);
        $this->assertSame(500 - $reserva, $this->aplicarDano($c, $c->aria->id, 500)['calculo']['final']);
        $this->assertSame(9, $this->aplicarDano($c, $c->aria->id, 9)['calculo']['final']); // uso único
    }

    public function test_plot_armor_ligada_anula_qualquer_dano_inclusive_verdadeiro(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $plot = fn (bool $ativa) => ['nome' => 'Plot Armor', 'origem' => 'Herói', 'tipo' => 'ativa', 'ativa' => $ativa, 'interruptor' => true, 'descricao' => '', 'nivelMin' => 11];
        $this->ficha($c, $c->ana, $c->aria, ['nivel' => 11, 'caracteristicas' => [$plot(false)]]);
        $this->assertSame(10, $this->aplicarDano($c, $c->aria->id, 10)['calculo']['final']);
        $this->ficha($c, $c->ana, $c->aria, ['caracteristicas' => [$plot(true)]]);
        $this->assertSame(0, $this->aplicarDano($c, $c->aria->id, 999)['calculo']['final']);
    }

    public function test_costura_interna_da_pv_temporarios_ao_ser_atacado_sem_precisar_de_sangramento_e_acaba_no_inicio_do_turno(): void
    {
        $c = $this->cenario();
        $this->combate($c); // vez do Bruno; depois a Aria
        $sis = app(\App\Nucleo\Sistemas\RegistroSistemas::class)->resolver('one-piece');
        $costura = ['nome' => 'Costura Interna de Emergência', 'origem' => 'Fruta', 'tipo' => 'passiva', 'descricao' => '', 'builder' => 'fruta',
            'reacao' => ['gatilho' => 'ataque_declarado', 'alcance' => 'si', 'pvTemporarios' => '4d10']];
        $this->ficha($c, $c->ana, $c->aria, ['caracteristicas' => [$costura], 'condicoes' => ['sangramento']]);
        $this->ataque($c);
        $this->reagir($c, $c->ana, $c->aria, 'c:0');
        $f = $c->aria->fresh()->fichaCompleta($sis);
        $this->assertGreaterThanOrEqual(4, $f['pv']['temp']);
        $this->assertLessThanOrEqual(40, $f['pv']['temp']);
        $this->assertSame($f['pv']['temp'], $f['reducao']['pvTemp']);
        $this->assertNotContains('sangramento', $f['condicoes']); // o Sangramento termina, mas não era preciso tê-lo

        // o dano gasta os PV temporários antes dos PV
        $this->aplicarDano($c, $c->aria->id, 3);
        $depois = $c->aria->fresh()->fichaCompleta($sis);
        $this->assertSame(10, $depois['pv']['atual']);
        $this->assertSame($f['pv']['temp'] - 3, $depois['pv']['temp']);

        // no início do próximo turno da Aria os PV temporários da reação acabam
        $this->cmd($c, 'turno');
        $f2 = $c->aria->fresh()->fichaCompleta($sis);
        $this->assertSame(0, $f2['pv']['temp']);
        $this->assertSame(0, $f2['reducao']['pvTemp']);
    }
}
