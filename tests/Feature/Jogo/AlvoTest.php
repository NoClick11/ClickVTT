<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AlvoTest extends TestCase
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
        $alvo = $mesa->personagens()->create(['nome' => 'Lunar', 'cor' => '#ef4444']);
        // o alvo é um NPC: sem fogo amigo, jogador não machuca jogador
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);

        return (object) compact('mesa', 'mestre', 'ana', 'bia', 'aria', 'alvo');
    }

    private function como(Jogador $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => [$p->id => true]]])->withHeader('X-Jogador', (string) $p->id);
    }

    private function ficha($c, array $campos): void
    {
        $this->como($c->mestre)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->alvo->id]), ['campos' => $campos])->assertOk();
    }

    /** Uma rolagem de dano de 1d4 (a mensagem é criada pela rota de rolagem, com o tipo). */
    private function rolarDano($c, string $expressao, ?string $tipo, Jogador $quem, ?int $personagem)
    {
        return $this->como($quem)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => $expressao, 'rotulo' => 'Golpe', 'visibilidade' => 'todos', 'personagem_id' => $personagem, 'dano' => ['tipo' => $tipo],
        ])->assertCreated();
    }

    public function test_aplica_o_dano_dos_pv_temporarios_depois_dos_pv(): void
    {
        $c = $this->cenario();
        $this->ficha($c, ['pv.max' => 30, 'pv.atual' => 30, 'pv.temp' => 5]);
        $m = $this->rolarDano($c, '10', 'cortante', $c->ana, $c->aria->id)->json();

        $r = $this->como($c->ana)->postJson(route('jogo.personagens.dano', [$c->mesa->id, $c->alvo->id]), ['mensagem_id' => $m['id']])->assertOk()->json();

        $this->assertSame(10, $r['final']);
        $ficha = $c->alvo->fresh()->ficha;
        $this->assertSame(0, $ficha['pv']['temp']);
        $this->assertSame(25, $ficha['pv']['atual']); // 5 absorvidos pelo temporário, 5 nos PV
    }

    public function test_resistencia_imunidade_e_vulnerabilidade_pelo_tipo(): void
    {
        $c = $this->cenario();
        $this->ficha($c, ['pv.max' => 100, 'pv.atual' => 100, 'resistencias' => ['Fogo'], 'imunidades' => ['Veneno'], 'vulnerabilidades' => ['Gelo']]);
        $aplicar = fn (string $tipo) => $this->como($c->ana)->postJson(route('jogo.personagens.dano', [$c->mesa->id, $c->alvo->id]), ['mensagem_id' => $this->rolarDano($c, '20', $tipo, $c->ana, $c->aria->id)->json('id')])->assertOk()->json();

        $this->assertSame(['final' => 10, 'modo' => 'resistido'], array_intersect_key($aplicar('fogo'), array_flip(['final', 'modo']))); // sem acento nem maiúscula
        $this->assertSame(0, $aplicar('Veneno')['final']);
        $this->assertSame(40, $aplicar('gelo')['final']);
        $this->assertSame(20, $aplicar('elétrico')['final']); // sem defesa nem vulnerabilidade
        $this->assertSame(100 - 10 - 40 - 20, $c->alvo->fresh()->ficha['pv']['atual']);
    }

    public function test_o_dano_vale_uma_vez_por_alvo_e_so_para_quem_rolou_ou_o_mestre(): void
    {
        $c = $this->cenario();
        $this->ficha($c, ['pv.max' => 30, 'pv.atual' => 30]);
        $id = $this->rolarDano($c, '4', 'cortante', $c->ana, $c->aria->id)->json('id');
        $rota = route('jogo.personagens.dano', [$c->mesa->id, $c->alvo->id]);

        $this->como($c->bia)->postJson($rota, ['mensagem_id' => $id])->assertForbidden(); // outro jogador não aplica o dano alheio
        $this->como($c->ana)->postJson($rota, ['mensagem_id' => $id])->assertOk();
        $this->como($c->ana)->postJson($rota, ['mensagem_id' => $id])->assertStatus(422); // já aplicado a este alvo
        $this->como($c->mestre)->postJson(route('jogo.personagens.dano', [$c->mesa->id, $c->aria->id]), ['mensagem_id' => $id])->assertOk(); // outro alvo: vale
        $this->assertSame(26, $c->alvo->fresh()->ficha['pv']['atual']);

        $semDano = $this->como($c->ana)->postJson(route('jogo.rolagens.store', $c->mesa->id), ['expressao' => '1d20', 'visibilidade' => 'todos'])->json('id');
        $this->como($c->ana)->postJson($rota, ['mensagem_id' => $semDano])->assertStatus(422); // rolagem comum não é dano
    }

    public function test_condicao_com_duracao_aplica_conta_turnos_e_acaba_no_fim_do_turno(): void
    {
        $c = $this->cenario();
        $rota = route('jogo.personagens.condicoes', [$c->mesa->id, $c->alvo->id]);
        $this->como($c->ana)->postJson($rota, ['condicao' => 'atordoado', 'acao' => 'aplicar', 'turnos' => '2'])->assertOk();

        $ficha = $c->alvo->fresh()->ficha;
        $this->assertSame(['atordoado'], $ficha['condicoes']);
        $this->assertSame(['turnos' => 2, 'aoDano' => false], $ficha['duracoes']['atordoado']);

        // O mestre passa os turnos: o turno do alvo termina duas vezes.
        $cmd = fn (string $comando, array $d = []) => $this->como($c->mestre)->postJson(route('jogo.combate.comando', $c->mesa->id), ['comando' => $comando, ...$d])->assertOk()->json('combate');
        $cmd('iniciar', ['pagina_id' => $c->mesa->paginas()->first()->id]);
        $cmd('adicionar', ['personagem_id' => $c->alvo->id, 'iniciativa' => 15]);
        $cmd('adicionar', ['personagem_id' => $c->aria->id, 'iniciativa' => 10]);
        $cmd('comecar'); // o turno é de Lunar (15)
        $cmd('turno'); // acabou o turno de Lunar: 1 turno a menos
        $this->assertSame(1, $c->alvo->fresh()->ficha['duracoes']['atordoado']['turnos']);
        $cmd('turno'); // volta para Lunar (rodada 2)
        $cmd('turno'); // acabou de novo: a condição sai
        $ficha = $c->alvo->fresh()->ficha;
        $this->assertSame([], $ficha['condicoes']);
        $this->assertSame([], $ficha['duracoes']);
    }

    public function test_condicao_ate_receber_dano_acaba_com_o_dano_e_a_imunidade_bloqueia(): void
    {
        $c = $this->cenario();
        $this->ficha($c, ['pv.max' => 30, 'pv.atual' => 30]);
        $rota = route('jogo.personagens.condicoes', [$c->mesa->id, $c->alvo->id]);
        $this->como($c->ana)->postJson($rota, ['condicao' => 'atordoado', 'acao' => 'aplicar', 'turnos' => '3', 'ao_dano' => true])->assertOk();
        $id = $this->rolarDano($c, '3', 'cortante', $c->ana, $c->aria->id)->json('id');
        $this->como($c->ana)->postJson(route('jogo.personagens.dano', [$c->mesa->id, $c->alvo->id]), ['mensagem_id' => $id])->assertOk();
        $this->assertSame([], $c->alvo->fresh()->ficha['condicoes']);

        $this->ficha($c, ['imunidades' => ['Envenenado']]);
        $r = $this->como($c->ana)->postJson($rota, ['condicao' => 'envenenado', 'acao' => 'aplicar'])->assertOk()->json();
        $this->assertTrue($r['imune']);
        $this->assertSame([], $c->alvo->fresh()->ficha['condicoes']);
        $this->como($c->ana)->postJson($rota, ['condicao' => 'inexistente', 'acao' => 'aplicar'])->assertStatus(422);
    }

    public function test_salvaguarda_do_alvo_resiste_ou_aplica_e_a_duracao_pode_ser_sorteada(): void
    {
        $c = $this->cenario();
        $rota = route('jogo.personagens.condicoes', [$c->mesa->id, $c->alvo->id]);

        // CD 1 nunca falha (d20 + mod >= 1 com mod 0): resiste; CD 40 nunca passa: aplica, com 1d4 turnos sorteados.
        $r = $this->como($c->ana)->postJson($rota, ['condicao' => 'contido', 'acao' => 'aplicar', 'salvaguarda' => ['atributo' => 'for', 'cd' => 1]])->assertOk()->json();
        $this->assertTrue($r['resistiu']);
        $this->assertNull($c->alvo->fresh()->ficha); // resistiu: a ficha nem foi tocada

        $this->como($c->ana)->postJson($rota, ['condicao' => 'atordoado', 'acao' => 'aplicar', 'turnos' => '1d4', 'ao_dano' => true, 'salvaguarda' => ['atributo' => 'von', 'cd' => 40]])->assertOk();
        $ficha = $c->alvo->fresh()->ficha;
        $this->assertSame(['atordoado'], $ficha['condicoes']);
        $this->assertGreaterThanOrEqual(1, $ficha['duracoes']['atordoado']['turnos']);
        $this->assertLessThanOrEqual(4, $ficha['duracoes']['atordoado']['turnos']);
        $this->assertTrue($ficha['duracoes']['atordoado']['aoDano']);

        $this->como($c->ana)->postJson($rota, ['condicao' => 'contido', 'acao' => 'aplicar', 'salvaguarda' => ['atributo' => 'xx', 'cd' => 10]])->assertStatus(422);
    }

    public function test_hospede_feerico_divide_o_dano_do_hospedeiro_e_nao_e_alvo(): void
    {
        $c = $this->cenario();
        $this->ficha($c, ['pv.max' => 30, 'pv.atual' => 30]);
        $this->como($c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), ['campos' => ['pv.max' => 20, 'pv.atual' => 20, 'hospedado' => $c->alvo->id, 'imunidades' => ['Cortante']]])->assertOk();
        $rota = fn ($p) => route('jogo.personagens.dano', [$c->mesa->id, $p->id]);
        $id = $this->rolarDano($c, '10', 'cortante', $c->ana, $c->aria->id)->json('id');

        $this->como($c->ana)->postJson($rota($c->aria), ['mensagem_id' => $id])->assertStatus(422); // hospedado: não é alvo
        $this->como($c->ana)->postJson($rota($c->alvo), ['mensagem_id' => $id])->assertOk();
        $this->assertSame(20, $c->alvo->fresh()->ficha['pv']['atual']);
        $this->assertSame(15, $c->aria->fresh()->ficha['pv']['atual']); // metade (5), ignorando a imunidade dele
    }

    public function test_fator_do_dano_vale_na_aplicacao(): void
    {
        $c = $this->cenario();
        $this->ficha($c, ['pv.max' => 30, 'pv.atual' => 30]);
        $m = $this->como($c->ana)->postJson(route('jogo.rolagens.store', $c->mesa->id), ['expressao' => '10', 'visibilidade' => 'todos', 'personagem_id' => $c->aria->id, 'dano' => ['tipo' => 'perfurante', 'fator' => 0.5]])->assertCreated()->json();

        $this->como($c->ana)->postJson(route('jogo.personagens.dano', [$c->mesa->id, $c->alvo->id]), ['mensagem_id' => $m['id']])->assertOk();
        $this->assertSame(25, $c->alvo->fresh()->ficha['pv']['atual']);
    }

    public function test_companheiro_cria_a_cobra_com_ficha_pronta_uma_vez_so_e_so_para_quem_controla(): void
    {
        $c = $this->cenario();
        $rota = route('jogo.personagens.companheiros', [$c->mesa->id, $c->aria->id]);

        $r = $this->como($c->ana)->postJson($rota, ['modelo' => 'cobra-belica'])->assertCreated()->json();
        $this->assertTrue($r['criado']);
        $cobra = $c->mesa->personagens()->find($r['id']);
        $this->assertSame('Cobra Bélica de Aria', $cobra->nome);
        $this->assertSame(39, $cobra->ficha['pv']['max']);
        $this->assertSame(20, $cobra->ficha['atributos']['des']);
        $this->assertSame(['Envenenado'], $cobra->ficha['imunidades']);
        $this->assertSame([$c->ana->id], $cobra->jogadores()->pluck('jogadores.id')->all()); // controlada pelo mesmo jogador

        $this->assertFalse($this->como($c->ana)->postJson($rota, ['modelo' => 'cobra-belica'])->assertOk()->json('criado')); // não duplica
        $this->como($c->bia)->postJson($rota, ['modelo' => 'cobra-belica'])->assertForbidden();
        $this->como($c->ana)->postJson($rota, ['modelo' => 'dragao'])->assertStatus(422);

        // a ficha pronta é aceita pelo esquema: o dono da cobra edita um campo qualquer sem erro
        $this->como($c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $cobra->id]), ['campos' => ['pv.atual' => 30]])->assertOk();
    }

    public function test_ficha_aceita_as_novas_caracteristicas_de_combate(): void
    {
        $c = $this->cenario();
        $caracteristica = [
            'nome' => 'Heat', 'origem' => 'Lunarianos', 'tipo' => 'ativa', 'ativa' => false, 'builder' => 'especie', 'grupoRodada' => 'ofensivo', 'usadoNaRodada' => 2,
            'usos' => ['atual' => 1, 'max' => 1, 'porNivel' => true], 'alternativo' => ['atual' => 5, 'max' => 5], 'etiquetas' => ['Um uso por rodada'],
            'acoes' => [['rotulo' => 'Resistir', 'tipo' => 'condicao', 'alvo' => 'proprio', 'condicao' => 'atordoado', 'atributo' => 'von', 'cd' => 15, 'turnos' => '1d4', 'aoDano' => true]],
        ];
        $this->como($c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), ['campos' => [
            'caracteristicas' => [$caracteristica], 'movimento.normal' => 18, 'tamanho' => 'Enorme', 'hospedado' => $c->alvo->id,
            'tecnicas.lista' => [['nome' => 'Esfera', 'origem' => '', 'custo' => 0, 'alcance' => '6 m', 'efeito' => '1d4', 'rolagem' => '1d4', 'tipoDano' => 'fogo', 'descricao' => '', 'builder' => 'especie']],
        ]])->assertOk();
        $this->como($c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), ['campos' => ['caracteristicas' => [[...$caracteristica, 'acoes' => [['rotulo' => 'x', 'tipo' => 'voar']]]]]])->assertStatus(422);
        $this->como($c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), ['campos' => ['duracoes' => ['atordoado' => ['turnos' => 0, 'aoDano' => false]]]])->assertStatus(422);
    }
}
