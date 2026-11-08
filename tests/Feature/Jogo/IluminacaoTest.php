<?php

namespace Tests\Feature\Jogo;

use App\Models\Exploracao;
use App\Models\Jogador;
use App\Models\Objeto;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Paredes, portas e janelas: barram o movimento, abrem de perto se não estiverem trancadas; e a memória das áreas vistas. */
class IluminacaoTest extends TestCase
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
        $pagina = $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1, 'tamanho_quadrado' => 100]);
        // Aria no quadrado (0,0); as paredes ficam na linha x = 150 (à direita dela)
        $token = $pagina->objetos()->create(['camada' => 'jogadores', 'tipo' => 'token', 'personagem_id' => $aria->id, 'nome' => 'Aria', 'x' => 0, 'y' => 0, 'largura' => 100, 'altura' => 100, 'z' => 1]);

        return (object) compact('mesa', 'mestre', 'ana', 'bia', 'aria', 'pagina', 'token');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    /** Parede vertical em x=150 (de y=-500 a 500) do tipo dado. */
    private function parede($c, string $tipo = 'parede', array $dados = [], float $x = 150): Objeto
    {
        return $c->pagina->objetos()->create([
            'camada' => 'iluminacao', 'tipo' => 'parede', 'x' => $x, 'y' => -500, 'largura' => 1, 'altura' => 1000,
            'dados' => ['pontos' => [$x, -500, $x, 500], 'tipo' => $tipo, 'aberta' => false] + $dados,
        ]);
    }

    private function mover($c, Jogador $quem, float $x, float $y = 0)
    {
        return $this->como($quem)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $c->token->id]), ['x' => $x, 'y' => $y]);
    }

    public function test_paredes_vao_ao_jogador_mas_a_camada_do_mestre_nao(): void
    {
        $c = $this->cenario();
        $parede = $this->parede($c);
        $oculto = $c->pagina->objetos()->create(['camada' => 'mestre', 'tipo' => 'imagem', 'x' => 0, 'y' => 0, 'largura' => 10, 'altura' => 10]);
        $ids = Objeto::visivelAoJogador()->pluck('id')->all();
        $this->assertContains($parede->id, $ids);
        $this->assertNotContains($oculto->id, $ids);
    }

    public function test_parede_barra_o_movimento_do_jogador_mas_nao_do_mestre(): void
    {
        $c = $this->cenario();
        $this->parede($c);
        $this->mover($c, $c->ana, 90)->assertOk()->assertJsonPath('x', 90); // encostado na parede (o centro em 140), livre
        $this->mover($c, $c->ana, 200)->assertOk()->assertJsonPath('x', 90); // atravessaria: fica onde estava
        $this->assertEquals(90, $c->token->fresh()->x);
        $this->mover($c, $c->mestre, 300)->assertOk()->assertJsonPath('x', 300); // o mestre atravessa
    }

    public function test_porta_fechada_barra_aberta_deixa_passar_e_a_janela_barra_o_corpo(): void
    {
        $c = $this->cenario();
        $porta = $this->parede($c, 'porta');
        $this->mover($c, $c->ana, 200)->assertJsonPath('x', 0);
        $this->como($c->mestre)->postJson(route('jogo.objetos.alternar', [$c->mesa->id, $porta->id]))->assertOk();
        $this->mover($c, $c->ana, 200)->assertJsonPath('x', 200);

        $c2 = $this->cenario();
        $this->parede($c2, 'janela');
        $this->mover($c2, $c2->ana, 200)->assertJsonPath('x', 0); // janela fechada: não passa o corpo
    }

    public function test_cada_parede_pode_liberar_o_movimento_pela_configuracao(): void
    {
        $c = $this->cenario();
        $this->parede($c, 'parede', ['bloqueio' => ['movimento' => false, 'visao' => true, 'luz' => true]]); // ex.: cerca baixa
        $this->mover($c, $c->ana, 200)->assertJsonPath('x', 200);
    }

    public function test_jogador_abre_e_fecha_porta_e_janela_de_perto_e_destrancadas(): void
    {
        $c = $this->cenario();
        $porta = $this->parede($c, 'porta');
        $this->como($c->ana)->postJson(route('jogo.objetos.alternar', [$c->mesa->id, $porta->id]))->assertOk()->assertJsonPath('dados.aberta', true);
        $this->como($c->ana)->postJson(route('jogo.objetos.alternar', [$c->mesa->id, $porta->id]))->assertOk()->assertJsonPath('dados.aberta', false);
        $this->assertSame([150, -500, 150, 500], array_map('intval', $porta->fresh()->dados['pontos'])); // a geometria nunca se perde
    }

    public function test_so_abre_de_perto(): void
    {
        $c = $this->cenario();
        $longe = $this->parede($c, 'porta', [], 600); // 6 quadrados de distância
        $this->como($c->ana)->postJson(route('jogo.objetos.alternar', [$c->mesa->id, $longe->id]))->assertStatus(422)->assertJsonPath('message', 'Chegue mais perto para abrir ou fechar.');
        $this->assertFalse($longe->fresh()->dados['aberta']);
        $this->como($c->mestre)->postJson(route('jogo.objetos.alternar', [$c->mesa->id, $longe->id]))->assertOk(); // o mestre abre de longe
        $c->token->update(['x' => 500]); // o token chega perto
        $this->como($c->ana)->postJson(route('jogo.objetos.alternar', [$c->mesa->id, $longe->id]))->assertOk();
        // quem não tem token na página não abre nada
        $this->como($c->bia)->postJson(route('jogo.objetos.alternar', [$c->mesa->id, $longe->id]))->assertStatus(422);
    }

    public function test_porta_trancada_so_o_mestre_mexe_e_so_ele_tranca(): void
    {
        $c = $this->cenario();
        $porta = $this->parede($c, 'porta');
        $this->como($c->ana)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $porta->id]), ['dados' => ['trancada' => true]])->assertForbidden();
        $this->como($c->mestre)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $porta->id]), ['dados' => ['trancada' => true]])->assertOk();
        $this->como($c->ana)->postJson(route('jogo.objetos.alternar', [$c->mesa->id, $porta->id]))->assertStatus(422)->assertJsonPath('message', 'Está trancada.');
        $this->assertFalse($porta->fresh()->dados['aberta']);
        $this->como($c->mestre)->postJson(route('jogo.objetos.alternar', [$c->mesa->id, $porta->id]))->assertOk()->assertJsonPath('dados.aberta', true);
    }

    public function test_so_porta_e_janela_abrem_e_so_na_pagina_do_jogador(): void
    {
        $c = $this->cenario();
        $parede = $this->parede($c, 'parede');
        $this->como($c->ana)->postJson(route('jogo.objetos.alternar', [$c->mesa->id, $parede->id]))->assertStatus(422);

        $outra = $c->mesa->paginas()->create(['nome' => 'Outra', 'ordem' => 2]);
        $portaOutra = $outra->objetos()->create(['camada' => 'iluminacao', 'tipo' => 'parede', 'x' => 0, 'y' => 0, 'largura' => 1, 'altura' => 1, 'dados' => ['pontos' => [0, 0, 1, 0], 'tipo' => 'porta', 'aberta' => false]]);
        $c->ana->update(['pagina_id' => $c->pagina->id]);
        $this->como($c->ana)->postJson(route('jogo.objetos.alternar', [$c->mesa->id, $portaOutra->id]))->assertForbidden();
    }

    public function test_mestre_configura_a_paredes_luzes_e_tokens_e_os_limites_valem(): void
    {
        $c = $this->cenario();
        $janela = $this->parede($c, 'janela');
        $url = route('jogo.objetos.update', [$c->mesa->id, $janela->id]);
        $this->como($c->mestre)->patchJson($url, ['dados' => ['bloqueio' => ['movimento' => true, 'visao' => false, 'luz' => true]]])->assertOk()->assertJsonPath('dados.bloqueio.luz', true);
        $this->como($c->mestre)->patchJson($url, ['dados' => ['bloqueio' => ['luz' => 'talvez']]])->assertStatus(422);

        $luz = $c->pagina->objetos()->create(['camada' => 'iluminacao', 'tipo' => 'luz', 'x' => 0, 'y' => 0, 'largura' => 200, 'altura' => 200, 'dados' => ['raio' => 100]]);
        $u = route('jogo.objetos.update', [$c->mesa->id, $luz->id]);
        $this->como($c->mestre)->patchJson($u, ['dados' => ['intensidade' => 0.6, 'raio_claro' => 40, 'angulo' => 90, 'direcao' => 45, 'ativa' => false, 'atravessa' => true]])
            ->assertOk()->assertJsonPath('dados.raio', 100)->assertJsonPath('dados.angulo', 90)->assertJsonPath('dados.ativa', false);
        $this->como($c->mestre)->patchJson($u, ['dados' => ['intensidade' => 2]])->assertStatus(422);
        $this->como($c->mestre)->patchJson($u, ['dados' => ['angulo' => 0]])->assertStatus(422);
        $this->como($c->mestre)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $c->token->id]), ['dados' => ['visao' => 8, 'visao_ativa' => false]])->assertOk()->assertJsonPath('dados.visao_ativa', false);
    }

    public function test_mestre_configura_a_pagina_e_valida_os_limites(): void
    {
        $c = $this->cenario();
        $url = route('jogo.paginas.update', [$c->mesa->id, $c->pagina->id]);
        $this->como($c->ana)->patchJson($url, ['iluminacao_ativa' => true])->assertForbidden();
        $this->como($c->mestre)->patchJson($url, ['luz_ambiente' => 101])->assertStatus(422);
        $this->como($c->mestre)->patchJson($url, ['iluminacao_ativa' => true, 'luz_ambiente' => 20, 'visao_padrao' => 8, 'usar_visao' => false, 'memoria_ativa' => false])
            ->assertOk()->assertJsonPath('iluminacao_ativa', true)->assertJsonPath('luz_ambiente', 20)->assertJsonPath('usar_visao', false)->assertJsonPath('memoria_ativa', false);
    }

    private const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    public function test_a_memoria_e_de_cada_jogador_e_so_o_mestre_apaga(): void
    {
        $c = $this->cenario();
        $u = route('jogo.exploracao.mostrar', [$c->mesa->id, $c->pagina->id]);
        $g = route('jogo.exploracao.guardar', [$c->mesa->id, $c->pagina->id]);
        $this->como($c->ana)->getJson($u)->assertOk()->assertJsonPath('imagem', null);
        $this->como($c->ana)->putJson($g, ['imagem' => self::PNG])->assertOk();
        $this->como($c->ana)->getJson($u)->assertJsonPath('imagem', self::PNG);
        $this->como($c->bia)->getJson($u)->assertJsonPath('imagem', null); // a da Ana não vai para a Bia
        $this->como($c->ana)->putJson($g, ['imagem' => self::PNG])->assertOk(); // regravar atualiza a mesma
        $this->assertSame(1, Exploracao::count());
        $this->como($c->ana)->putJson($g, ['imagem' => 'javascript:alert(1)'])->assertStatus(422);
        $this->como($c->ana)->putJson($g, ['imagem' => 'data:image/png;base64,'.str_repeat('A', 450000)])->assertStatus(422);
        $this->como($c->mestre)->putJson($g, ['imagem' => self::PNG])->assertForbidden();
        $this->como($c->ana)->deleteJson($g)->assertForbidden();
        $this->como($c->mestre)->deleteJson($g)->assertOk();
        $this->assertSame(0, Exploracao::count());
    }
}
