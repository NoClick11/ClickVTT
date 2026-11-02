<?php

namespace Tests\Feature\Jogo;

use App\Models\Personagem;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CenaTest extends TestCase
{
    use RefreshDatabase;

    /** Mesa com mestre, dois jogadores, uma página e um objeto em cada camada. */
    private function cenario(): object
    {
        $dono = User::factory()->create();
        $mesa = $dono->mesas()->create([
            'nome' => 'Teste', 'slug' => 'teste-'.uniqid(), 'sistema_id' => Sistema::value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->personagens()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->personagens()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $bia = $mesa->personagens()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $pagina = $mesa->paginas()->create(['nome' => 'Taverna', 'ordem' => 1]);

        $novo = fn (string $camada, string $tipo, array $extra = []) => $pagina->objetos()->create(
            ['camada' => $camada, 'tipo' => $tipo, 'x' => 0, 'y' => 0, 'largura' => 70, 'altura' => 70] + $extra,
        );

        return (object) [
            'mesa' => $mesa, 'pagina' => $pagina, 'mestre' => $mestre, 'ana' => $ana, 'bia' => $bia,
            'mapa' => $novo('mapa', 'imagem'),
            'segredo' => $novo('mestre', 'token', ['nome' => 'Emboscada']),
            'tokenAna' => $novo('jogadores', 'token', ['personagem_id' => $ana->id]),
            'tokenBia' => $novo('jogadores', 'token', ['personagem_id' => $bia->id]),
            'luz' => $novo('iluminacao', 'luz', ['dados' => ['raio' => 140]]),
            'parede' => $novo('iluminacao', 'parede', ['dados' => ['pontos' => [0, 0, 100, 0], 'tipo' => 'parede']]),
        ];
    }

    private function como(Personagem $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => $p->id]]);
    }

    public function test_manda_para_o_convite_quando_nao_entrou(): void
    {
        $c = $this->cenario();
        $this->get(route('jogo', $c->mesa->slug))->assertRedirect(route('convite.show', $c->mesa->convite_token));
    }

    public function test_mestre_recebe_todas_as_camadas_e_paredes(): void
    {
        $c = $this->cenario();
        $this->como($c->mestre)->get(route('jogo', $c->mesa->slug))->assertInertia(fn (Assert $p) => $p
            ->component('app/Jogo')->where('mestre', true)
            ->has('objetos', 6)->has('paginas', 1)->has('personagens', 3));
    }

    public function test_jogador_nunca_recebe_camada_do_mestre_nem_paredes(): void
    {
        $c = $this->cenario();
        $this->como($c->ana)->get(route('jogo', $c->mesa->slug))->assertInertia(fn (Assert $p) => $p
            ->where('mestre', false)
            ->has('objetos', 4) // mapa, 2 tokens de jogadores, luz
            ->where('objetos', function ($objetos) use ($c) {
                $ids = collect($objetos)->pluck('id');

                return $ids->doesntContain($c->segredo->id) && $ids->doesntContain($c->parede->id) && $ids->contains($c->luz->id);
            })
            ->where('paginas', [])->where('personagens', []));
    }

    public function test_jogador_ve_a_pagina_onde_o_mestre_o_colocou(): void
    {
        $c = $this->cenario();
        $outra = $c->mesa->paginas()->create(['nome' => 'Masmorra', 'ordem' => 2]);
        $outra->objetos()->create(['camada' => 'mapa', 'tipo' => 'imagem', 'x' => 0, 'y' => 0, 'largura' => 10, 'altura' => 10]);

        $this->como($c->mestre)->postJson(route('jogo.paginas.jogador', [$c->mesa->id, $outra->id, $c->ana->id]))->assertOk();

        $this->como($c->ana->refresh())->get(route('jogo', $c->mesa->slug))->assertInertia(fn (Assert $p) => $p
            ->where('pagina.id', $outra->id)->has('objetos', 1));
        $this->como($c->bia)->get(route('jogo', $c->mesa->slug))->assertInertia(fn (Assert $p) => $p
            ->where('pagina.id', $c->pagina->id));
    }

    public function test_jogador_nao_troca_de_pagina_pela_url(): void
    {
        $c = $this->cenario();
        $outra = $c->mesa->paginas()->create(['nome' => 'Segredo', 'ordem' => 2]);
        $this->como($c->ana)->get(route('jogo', $c->mesa->slug).'?pagina='.$outra->id)
            ->assertInertia(fn (Assert $p) => $p->where('pagina.id', $c->pagina->id));
    }

    public function test_jogador_move_apenas_o_proprio_token(): void
    {
        $c = $this->cenario();
        $url = fn ($o) => route('jogo.objetos.update', [$c->mesa->id, $o->id]);

        $this->como($c->ana)->patchJson($url($c->tokenAna), ['x' => 140, 'y' => 70])->assertOk();
        $this->assertSame(140.0, $c->tokenAna->refresh()->x);

        $this->como($c->ana)->patchJson($url($c->tokenBia), ['x' => 1, 'y' => 1])->assertForbidden();
        $this->como($c->ana)->patchJson($url($c->segredo), ['x' => 1, 'y' => 1])->assertForbidden();
        $this->como($c->ana)->patchJson($url($c->mapa), ['x' => 1, 'y' => 1])->assertForbidden();
    }

    public function test_jogador_nao_redimensiona_nem_troca_camada_do_proprio_token(): void
    {
        $c = $this->cenario();
        $this->como($c->ana)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $c->tokenAna->id]), [
            'x' => 5, 'y' => 5, 'largura' => 999, 'camada' => 'mestre',
        ])->assertOk();
        $c->tokenAna->refresh();
        $this->assertSame(70.0, $c->tokenAna->largura);
        $this->assertSame('jogadores', $c->tokenAna->camada);
    }

    public function test_mestre_redimensiona_objetos(): void
    {
        $c = $this->cenario();
        $this->como($c->mestre)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $c->tokenBia->id]), ['largura' => 210, 'altura' => 140])->assertOk();
        $this->assertSame(210.0, $c->tokenBia->refresh()->largura);
    }

    public function test_so_o_mestre_gerencia_paginas_pastas_e_objetos(): void
    {
        $c = $this->cenario();
        $m = $c->mesa->id;
        $this->como($c->ana)->postJson(route('jogo.paginas.store', $m), ['nome' => 'X'])->assertForbidden();
        $this->como($c->ana)->postJson(route('jogo.pastas.store', $m), ['nome' => 'X'])->assertForbidden();
        $this->como($c->ana)->patchJson(route('jogo.paginas.update', [$m, $c->pagina->id]), ['nome' => 'X'])->assertForbidden();
        $this->como($c->ana)->deleteJson(route('jogo.objetos.destroy', [$m, $c->tokenAna->id]))->assertForbidden();
        $this->como($c->ana)->postJson(route('jogo.objetos.store', [$m, $c->pagina->id]), [
            'camada' => 'jogadores', 'tipo' => 'token', 'x' => 0, 'y' => 0, 'largura' => 70, 'altura' => 70,
        ])->assertForbidden();
        $this->flushSession();
        $this->postJson(route('jogo.paginas.store', $m), ['nome' => 'X'])->assertForbidden();

        $this->como($c->mestre)->postJson(route('jogo.pastas.store', $m), ['nome' => 'Capítulo 1'])->assertCreated();
        $this->como($c->mestre)->postJson(route('jogo.paginas.store', $m), ['nome' => 'Floresta'])->assertCreated()
            ->assertJsonPath('colunas', 25)->assertJsonPath('tamanho_quadrado', 70)->assertJsonPath('grade_quadrada', true)->assertJsonPath('distancia_quadrado', 1.5);
        $this->como($c->mestre)->patchJson(route('jogo.paginas.update', [$m, $c->pagina->id]), [
            'nome' => 'Taverna', 'colunas' => 40, 'grade_quadrada' => false, 'distancia_quadrado' => 1.5,
        ])->assertOk()->assertJsonPath('grade_quadrada', false);
    }

    public function test_acesso_de_outra_mesa_nao_vale(): void
    {
        $c = $this->cenario();
        $d = $this->cenario();
        $this->como($d->mestre)->postJson(route('jogo.paginas.store', $c->mesa->id), ['nome' => 'X'])->assertForbidden();
    }

    public function test_nao_exclui_a_ultima_pagina(): void
    {
        $c = $this->cenario();
        $this->como($c->mestre)->deleteJson(route('jogo.paginas.destroy', [$c->mesa->id, $c->pagina->id]))->assertStatus(422);
        $extra = $c->mesa->paginas()->create(['nome' => 'Extra', 'ordem' => 2]);
        $this->como($c->mestre)->deleteJson(route('jogo.paginas.destroy', [$c->mesa->id, $extra->id]))->assertOk();
    }

    public function test_paredes_e_luzes_so_na_camada_de_iluminacao(): void
    {
        $c = $this->cenario();
        $base = ['x' => 0, 'y' => 0, 'largura' => 10, 'altura' => 10];
        $url = route('jogo.objetos.store', [$c->mesa->id, $c->pagina->id]);

        $this->como($c->mestre)->postJson($url, $base + ['camada' => 'jogadores', 'tipo' => 'parede', 'dados' => ['pontos' => [0, 0, 1, 1]]])->assertStatus(422);
        $this->como($c->mestre)->postJson($url, $base + ['camada' => 'iluminacao', 'tipo' => 'parede', 'dados' => ['pontos' => [0, 0, 100, 0], 'tipo' => 'porta']])->assertCreated();
        $this->como($c->mestre)->postJson($url, $base + ['camada' => 'iluminacao', 'tipo' => 'token'])->assertStatus(422);
    }

    public function test_upload_de_mapa_em_imagem_e_video_e_rejeita_outros_tipos(): void
    {
        Storage::fake('public');
        $c = $this->cenario();
        $url = route('jogo.objetos.store', [$c->mesa->id, $c->pagina->id]);
        $campos = ['camada' => 'mapa', 'tipo' => 'imagem', 'x' => 0, 'y' => 0, 'largura' => 1750, 'altura' => 1750];

        $this->como($c->mestre)->post($url, $campos + ['arquivo' => UploadedFile::fake()->image('mapa.png', 100, 100)], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('arquivo_tipo', 'imagem');
        $this->como($c->mestre)->post($url, $campos + ['arquivo' => UploadedFile::fake()->create('animado.webm', 500, 'video/webm')], ['Accept' => 'application/json'])
            ->assertCreated()->assertJsonPath('arquivo_tipo', 'video');
        $this->como($c->mestre)->post($url, $campos + ['arquivo' => UploadedFile::fake()->create('virus.php', 1, 'text/x-php')], ['Accept' => 'application/json'])
            ->assertStatus(422);
    }

    public function test_alterar_dados_de_uma_porta_nao_perde_os_pontos(): void
    {
        $c = $this->cenario();
        $porta = $c->pagina->objetos()->create([
            'camada' => 'iluminacao', 'tipo' => 'parede', 'x' => 0, 'y' => 0, 'largura' => 100, 'altura' => 1,
            'dados' => ['pontos' => [0, 0, 100, 0], 'tipo' => 'porta', 'aberta' => false],
        ]);
        $this->como($c->mestre)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $porta->id]), ['dados' => ['aberta' => true]])->assertOk();
        $porta->refresh();
        $this->assertTrue($porta->dados['aberta']);
        $this->assertSame([0, 0, 100, 0], $porta->dados['pontos']);
        $this->assertSame('porta', $porta->dados['tipo']);
    }

    public function test_cor_do_token_e_salva_na_criacao(): void
    {
        $c = $this->cenario();
        $this->como($c->mestre)->postJson(route('jogo.objetos.store', [$c->mesa->id, $c->pagina->id]), [
            'camada' => 'jogadores', 'tipo' => 'token', 'x' => 0, 'y' => 0, 'largura' => 70, 'altura' => 70, 'dados' => ['cor' => '#2563eb'],
        ])->assertCreated()->assertJsonPath('dados.cor', '#2563eb');
    }
}
