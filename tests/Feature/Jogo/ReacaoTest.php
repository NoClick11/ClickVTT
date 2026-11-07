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

    public function test_a_reacao_nao_tem_limite_por_rodada_e_sem_pp_nao_e_oferecida(): void
    {
        $c = $this->cenario();
        $this->combate($c);
        $this->protetor($c);
        $this->ataque($c);
        $this->como($c->bia)->postJson(route('jogo.combate.eventos.reagir', [$c->mesa->id, EventoDeCombate::first()->id]), ['personagem_id' => $c->bruno->id, 'opcao' => 't:0'])->assertOk();

        $this->ataque($c); // mesma rodada: sem limite por rodada, a reação do Bruno continua oferecida
        $this->assertNotSame([], EventoDeCombate::latest('id')->first()->ofertas);
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

    public function test_fora_do_combate_em_curso_nao_abre_janela_e_a_pagina_traz_as_ofertas_pendentes(): void
    {
        $c = $this->cenario();
        $this->ataque($c); // sem combate: rolagem comum
        $this->assertSame(0, EventoDeCombate::count());

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
}
