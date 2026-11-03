<?php

namespace Tests\Feature\Jogo;

use App\Events\EventoMesa;
use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(): object
    {
        $dono = User::factory()->create();
        $mesa = $dono->mesas()->create(['nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::value('id'), 'tema_entrada' => 'padrao']);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $bia = $mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $aria->jogadores()->attach($ana);
        $pagina = $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);

        return (object) compact('mesa', 'mestre', 'ana', 'bia', 'aria', 'pagina');
    }

    private function como(Jogador $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => [$p->id => true]]])->withHeader('X-Jogador', (string) $p->id);
    }

    private function rolar($c, Jogador $quem, array $corpo)
    {
        return $this->como($quem)->postJson(route('jogo.rolagens.store', $c->mesa->id), $corpo + ['dado' => 'd20', 'quantidade' => 1, 'visibilidade' => 'todos']);
    }

    public function test_rolagem_e_sorteada_no_servidor_dentro_do_intervalo(): void
    {
        $c = $this->cenario();
        foreach (['d4' => 4, 'd6' => 6, 'd8' => 8, 'd10' => 10, 'd12' => 12, 'd20' => 20, 'd100' => 100] as $dado => $faces) {
            $r = $this->rolar($c, $c->ana, ['dado' => $dado, 'quantidade' => 6])->assertCreated()->json();
            $this->assertCount(6, $r['dados']['resultados']);
            foreach ($r['dados']['resultados'] as $v) {
                $this->assertGreaterThanOrEqual(1, $v);
                $this->assertLessThanOrEqual($faces, $v);
            }
            $this->assertSame(array_sum($r['dados']['resultados']), $r['dados']['total']);
        }
    }

    public function test_rejeita_dado_invalido_e_quantidade_fora_de_1_a_6(): void
    {
        $c = $this->cenario();
        $this->rolar($c, $c->ana, ['dado' => 'd7'])->assertStatus(422);
        $this->rolar($c, $c->ana, ['quantidade' => 0])->assertStatus(422);
        $this->rolar($c, $c->ana, ['quantidade' => 7])->assertStatus(422);
        $this->rolar($c, $c->ana, ['visibilidade' => 'invalida'])->assertStatus(422);
    }

    public function test_jogador_nao_pode_rolar_em_segredo(): void
    {
        $c = $this->cenario();
        $this->rolar($c, $c->ana, ['visibilidade' => 'secreto'])->assertStatus(422);
        $this->rolar($c, $c->mestre, ['visibilidade' => 'secreto'])->assertCreated();
    }

    public function test_rolagem_para_todos_vai_ao_canal_aberto(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $this->rolar($c, $c->ana, ['visibilidade' => 'todos'])->assertCreated();
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->nome === 'mensagem' && $e->canais === ['mesa'] && $e->payload['mensagem']['dados'] !== null);
    }

    public function test_rolagem_eu_e_mestre_nunca_vai_ao_canal_aberto(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $this->rolar($c, $c->ana, ['visibilidade' => 'mestre'])->assertCreated();
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->canais === ["jogador.{$c->ana->id}", 'mestre']);
        Event::assertNotDispatched(EventoMesa::class, fn ($e) => in_array('mesa', $e->canais, true));
    }

    public function test_rolagem_secreta_mostra_aviso_sem_numeros_aos_jogadores(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $this->rolar($c, $c->mestre, ['visibilidade' => 'secreto', 'quantidade' => 3])->assertCreated();

        Event::assertDispatched(EventoMesa::class, function ($e) {
            return $e->canais === ['mesa'] && $e->payload['mensagem']['dados'] === null && $e->payload['mensagem']['visibilidade'] === 'secreto_oculto';
        });
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->canais === ['mestre'] && count($e->payload['mensagem']['dados']['resultados']) === 3);
    }

    public function test_historico_respeita_a_visibilidade_de_cada_um(): void
    {
        $c = $this->cenario();
        $this->rolar($c, $c->ana, ['visibilidade' => 'todos'])->assertCreated();            // todos veem
        $this->rolar($c, $c->ana, ['visibilidade' => 'mestre'])->assertCreated();           // Ana + mestre
        $this->rolar($c, $c->mestre, ['visibilidade' => 'secreto'])->assertCreated();       // mestre vê; demais só aviso
        $this->rolar($c, $c->mestre, ['visibilidade' => 'mestre'])->assertCreated();        // só mestre
        $this->como($c->ana)->postJson(route('jogo.mensagens.store', $c->mesa->id), ['texto' => 'olá'])->assertCreated();

        $ver = fn (Jogador $p) => $this->como($p)->get(route('jogo', [$c->mesa->slug, $p->id]))->viewData('page')['props']['mensagens'];

        $mestre = $ver($c->mestre);
        $this->assertCount(5, $mestre);
        $this->assertNotNull(collect($mestre)->firstWhere('visibilidade', 'secreto')['dados']);

        $ana = $ver($c->ana); // todos + privada dela + aviso do segredo + texto (a privada do mestre fica de fora)
        $this->assertCount(4, $ana);
        $segredo = collect($ana)->firstWhere('visibilidade', 'secreto_oculto');
        $this->assertNull($segredo['dados']);
        $this->assertSame('rolou dados em segredo', $segredo['texto']);

        $bia = $ver($c->bia); // não vê a rolagem privada da Ana nem a do mestre
        $this->assertCount(3, $bia);
        $this->assertNull(collect($bia)->firstWhere('visibilidade', 'mestre'));
    }

    public function test_chat_de_texto_vai_ao_canal_aberto_e_exige_acesso(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $this->postJson(route('jogo.mensagens.store', $c->mesa->id), ['texto' => 'oi'])->assertForbidden();
        $this->como($c->ana)->postJson(route('jogo.mensagens.store', $c->mesa->id), ['texto' => '  oi  '])->assertCreated()->assertJsonPath('texto', 'oi');
        $this->como($c->ana)->postJson(route('jogo.mensagens.store', $c->mesa->id), ['texto' => ''])->assertStatus(422);
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->nome === 'mensagem' && $e->canais === ['mesa']);
    }

    public function test_autorizacao_dos_canais_privados(): void
    {
        $c = $this->cenario();
        $auth = fn (Jogador $p, string $canal) => $this->como($p)->post(route('jogo.broadcasting.auth', $c->mesa->id), ['channel_name' => $canal, 'socket_id' => '123.456']);
        $id = $c->mesa->id;

        $auth($c->ana, "private-mesa.{$id}")->assertOk();
        $auth($c->ana, "private-mesa.{$id}.jogador.{$c->ana->id}")->assertOk();
        $auth($c->ana, "private-mesa.{$id}.mestre")->assertForbidden();                 // jogador não escuta o canal do mestre
        $auth($c->ana, "private-mesa.{$id}.jogador.{$c->bia->id}")->assertForbidden(); // nem o de outro jogador
        $auth($c->mestre, "private-mesa.{$id}.mestre")->assertOk();
        $this->flushSession();
        $this->withHeaders(['X-Jogador' => ''])->post(route('jogo.broadcasting.auth', $id), ['channel_name' => "private-mesa.{$id}", 'socket_id' => '1.2'])->assertForbidden();
    }

    public function test_so_o_mestre_altera_o_combate_e_o_estado_chega_aos_jogadores(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $estado = ['ativo' => true, 'rodada' => 2, 'atual' => 'a', 'itens' => [['id' => 'a', 'nome' => 'Aria', 'iniciativa' => 15, 'cor' => '#2563eb', 'personagem_id' => $c->aria->id]]];

        $this->como($c->ana)->putJson(route('jogo.combate.update', $c->mesa->id), $estado)->assertForbidden();
        $this->como($c->mestre)->putJson(route('jogo.combate.update', $c->mesa->id), $estado)->assertOk();
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->nome === 'combate' && $e->canais === ['mesa']);

        $this->como($c->ana)->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->assertInertia(fn (Assert $p) => $p
            ->where('combate.ativo', true)->where('combate.rodada', 2)->where('combate.itens.0.nome', 'Aria'));
    }

    public function test_jogador_desenha_na_camada_jogadores_e_apaga_so_o_proprio(): void
    {
        $c = $this->cenario();
        $traco = ['camada' => 'jogadores', 'tipo' => 'traco', 'x' => 10, 'y' => 10, 'largura' => 50, 'altura' => 30,
            'dados' => ['pontos' => [0, 0, 20, 10, 50, 30], 'cor' => '#ff0000', 'espessura' => 4]];
        $url = route('jogo.objetos.store', [$c->mesa->id, $c->pagina->id]);

        $criado = $this->como($c->ana)->postJson($url, $traco)->assertCreated()->json();
        $this->assertSame($c->ana->id, $criado['jogador_id']);
        $this->assertNull($criado['personagem_id']);
        $this->como($c->ana)->postJson($url, ['camada' => 'mestre'] + $traco)->assertForbidden();                    // só Jogadores
        $this->como($c->ana)->postJson($url, ['tipo' => 'token'] + $traco)->assertForbidden();                       // só traço/texto
        $this->como($c->ana)->postJson($url, ['tipo' => 'texto', 'dados' => ['texto' => 'Olá', 'cor' => '#ffffff', 'tamanho' => 24]] + $traco)->assertCreated();

        $this->como($c->bia)->deleteJson(route('jogo.objetos.destroy', [$c->mesa->id, $criado['id']]))->assertForbidden();
        $this->como($c->ana)->deleteJson(route('jogo.objetos.destroy', [$c->mesa->id, $criado['id']]))->assertOk();
        // mestre pode desenhar em qualquer camada (menos iluminação) e apagar de qualquer um
        $this->como($c->mestre)->postJson($url, ['camada' => 'mestre'] + $traco)->assertCreated();
        $this->como($c->mestre)->postJson($url, ['camada' => 'iluminacao'] + $traco)->assertStatus(422);
    }

    public function test_pontos_do_traco_precisam_vir_em_pares(): void
    {
        $c = $this->cenario();
        $this->como($c->ana)->postJson(route('jogo.objetos.store', [$c->mesa->id, $c->pagina->id]), [
            'camada' => 'jogadores', 'tipo' => 'traco', 'x' => 0, 'y' => 0, 'largura' => 5, 'altura' => 5, 'dados' => ['pontos' => [0, 0, 1, 1, 2]],
        ])->assertStatus(422);
    }

    public function test_fala_e_rola_como_o_personagem_ativo_somente_se_for_seu(): void
    {
        $c = $this->cenario();
        $alheio = $c->mesa->personagens()->create(['nome' => 'Bruno', 'cor' => '#16a34a']); // de ninguém
        $texto = fn (Jogador $quem, ?int $personagem) => $this->como($quem)->postJson(route('jogo.mensagens.store', $c->mesa->id), ['texto' => 'oi', 'personagem_id' => $personagem]);

        $texto($c->ana, $c->aria->id)->assertCreated()->assertJsonPath('autor.nome', 'Aria')->assertJsonPath('autor.id', $c->ana->id)->assertJsonPath('autor.personagem_id', $c->aria->id);
        $texto($c->ana, null)->assertCreated()->assertJsonPath('autor.nome', 'Ana');          // sem ativo: fala como o jogador
        $texto($c->ana, $alheio->id)->assertStatus(422);                                         // não é dele
        $texto($c->bia, $c->aria->id)->assertStatus(422);                                        // é da Ana
        $texto($c->mestre, $alheio->id)->assertCreated();                                       // mestre fala como qualquer um

        $this->rolar($c, $c->ana, ['personagem_id' => $c->aria->id])->assertCreated()->assertJsonPath('autor.nome', 'Aria');
        $this->rolar($c, $c->ana, ['personagem_id' => $alheio->id])->assertStatus(422);
    }
}
