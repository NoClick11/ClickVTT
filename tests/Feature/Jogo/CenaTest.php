<?php

namespace Tests\Feature\Jogo;

use App\Events\EventoMesa;
use App\Models\Jogador;
use App\Models\Personagem;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Storage;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class CenaTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Mesa com mestre, dois jogadores (Ana e Bia), um personagem de cada (Aria da Ana, Bruno da Bia),
     * uma página e um objeto em cada camada.
     */
    private function cenario(): object
    {
        $dono = User::factory()->create();
        $mesa = $dono->mesas()->create([
            'nome' => 'Teste', 'slug' => 'teste-'.uniqid(), 'sistema_id' => Sistema::value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $bia = $mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#2563eb']);
        $bruno = $mesa->personagens()->create(['nome' => 'Bruno', 'cor' => '#16a34a']);
        $aria->jogadores()->attach($ana);
        $bruno->jogadores()->attach($bia);
        $pagina = $mesa->paginas()->create(['nome' => 'Taverna', 'ordem' => 1]);

        $novo = fn (string $camada, string $tipo, array $extra = []) => $pagina->objetos()->create(
            ['camada' => $camada, 'tipo' => $tipo, 'x' => 0, 'y' => 0, 'largura' => 70, 'altura' => 70] + $extra,
        );

        return (object) [
            'mesa' => $mesa, 'pagina' => $pagina, 'mestre' => $mestre, 'ana' => $ana, 'bia' => $bia, 'aria' => $aria, 'bruno' => $bruno,
            'mapa' => $novo('mapa', 'imagem'),
            'segredo' => $novo('mestre', 'token', ['nome' => 'Emboscada']),
            'tokenAna' => $novo('jogadores', 'token', ['personagem_id' => $aria->id]),
            'tokenBia' => $novo('jogadores', 'token', ['personagem_id' => $bruno->id]),
            'luz' => $novo('iluminacao', 'luz', ['dados' => ['raio' => 140]]),
            'parede' => $novo('iluminacao', 'parede', ['dados' => ['pontos' => [0, 0, 100, 0], 'tipo' => 'parede']]),
        ];
    }

    private function como(Jogador $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => [$p->id => true]]])->withHeader('X-Jogador', (string) $p->id);
    }

    public function test_manda_para_o_convite_quando_nao_entrou(): void
    {
        $c = $this->cenario();
        $this->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->assertRedirect(route('convite.show', $c->mesa->convite_token));
    }

    public function test_mestre_recebe_todas_as_camadas_e_paredes(): void
    {
        $c = $this->cenario();
        $this->como($c->mestre)->get(route('jogo', [$c->mesa->slug, $c->mestre->id]))->assertInertia(fn (Assert $p) => $p
            ->component('app/Jogo')->where('mestre', true)
            ->has('objetos', 6)->has('paginas', 1)->has('jogadores', 3)->has('personagens', 2));
    }

    public function test_jogador_nunca_recebe_a_camada_do_mestre_e_recebe_a_geometria_das_paredes(): void
    {
        $c = $this->cenario();
        $this->como($c->ana)->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->assertInertia(fn (Assert $p) => $p
            ->where('mestre', false)
            ->has('objetos', 5) // mapa, 2 tokens de jogadores, luz e parede (o navegador calcula visão e antecipa o bloqueio do movimento)
            ->where('objetos', function ($objetos) use ($c) {
                $ids = collect($objetos)->pluck('id');

                return $ids->doesntContain($c->segredo->id) && $ids->contains($c->parede->id) && $ids->contains($c->luz->id);
            })
            ->where('paginas', [])->has('jogadores', 3)->has('personagens', 2)
            ->where('jogadores.0', fn ($j) => ! isset($j['pagina_id']) && ! isset($j['tem_senha'])));
    }

    public function test_jogador_ve_a_pagina_onde_o_mestre_o_colocou(): void
    {
        $c = $this->cenario();
        $outra = $c->mesa->paginas()->create(['nome' => 'Masmorra', 'ordem' => 2]);
        $outra->objetos()->create(['camada' => 'mapa', 'tipo' => 'imagem', 'x' => 0, 'y' => 0, 'largura' => 10, 'altura' => 10]);

        $this->como($c->mestre)->postJson(route('jogo.paginas.jogador', [$c->mesa->id, $outra->id, $c->ana->id]))->assertOk();

        $this->como($c->ana->refresh())->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->assertInertia(fn (Assert $p) => $p
            ->where('pagina.id', $outra->id)->has('objetos', 1));
        $this->como($c->bia)->get(route('jogo', [$c->mesa->slug, $c->bia->id]))->assertInertia(fn (Assert $p) => $p
            ->where('pagina.id', $c->pagina->id));
    }

    public function test_jogador_nao_troca_de_pagina_pela_url(): void
    {
        $c = $this->cenario();
        $outra = $c->mesa->paginas()->create(['nome' => 'Segredo', 'ordem' => 2]);
        $this->como($c->ana)->get(route('jogo', [$c->mesa->slug, $c->ana->id]).'?pagina='.$outra->id)
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
            ->assertJsonPath('colunas', 25)->assertJsonPath('tamanho_quadrado', 100)->assertJsonPath('grade_quadrada', true)->assertJsonPath('distancia_quadrado', 1.5);
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

    public function test_mestre_e_jogador_podem_estar_abertos_ao_mesmo_tempo_no_mesmo_navegador(): void
    {
        $c = $this->cenario();
        // A sessão do navegador tem os DOIS personagens autenticados (abas diferentes).
        $sessao = ['acesso_mesas' => [$c->mesa->id => [$c->mestre->id => true, $c->ana->id => true]]];
        $url = fn ($p) => route('jogo', [$c->mesa->slug, $p->id]);

        $this->withSession($sessao)->get($url($c->mestre))->assertInertia(fn (Assert $p) => $p
            ->where('mestre', true)->where('jogador.nome', 'Mestre')->has('objetos', 6));
        $this->withSession($sessao)->get($url($c->ana))->assertInertia(fn (Assert $p) => $p
            ->where('mestre', false)->where('jogador.nome', 'Ana')->has('objetos', 5));

        // Cada aba age como o seu jogador na API (cabeçalho X-Jogador).
        $this->withSession($sessao)->withHeader('X-Jogador', (string) $c->mestre->id)
            ->postJson(route('jogo.pastas.store', $c->mesa->id), ['nome' => 'Cap 1'])->assertCreated();
        $this->withSession($sessao)->withHeader('X-Jogador', (string) $c->ana->id)
            ->postJson(route('jogo.pastas.store', $c->mesa->id), ['nome' => 'Cap 2'])->assertForbidden();
        // Sem indicar quem é, a API recusa (ambíguo).
        $this->withSession($sessao)->postJson(route('jogo.pastas.store', $c->mesa->id), ['nome' => 'Cap 3'])->assertForbidden();
    }

    public function test_nao_da_para_se_passar_por_personagem_que_nao_entrou(): void
    {
        $c = $this->cenario();
        $sessao = ['acesso_mesas' => [$c->mesa->id => [$c->ana->id => true]]];

        $this->withSession($sessao)->get(route('jogo', [$c->mesa->slug, $c->mestre->id]))
            ->assertRedirect(route('convite.show', $c->mesa->convite_token));
        $this->withSession($sessao)->withHeader('X-Jogador', (string) $c->mestre->id)
            ->postJson(route('jogo.pastas.store', $c->mesa->id), ['nome' => 'X'])->assertForbidden();
    }

    public function test_entrar_com_outro_personagem_nao_derruba_o_anterior(): void
    {
        $c = $this->cenario();
        $c->mestre->update(['senha' => 'mestre123']);
        $c->ana->update(['senha' => 'ana12345']);
        $entrar = fn ($p, $senha) => $this->post(route('convite.entrar', $c->mesa->convite_token), ['jogador_id' => $p->id, 'senha' => $senha]);

        $entrar($c->mestre, 'mestre123')->assertRedirect(route('jogo', [$c->mesa->slug, $c->mestre->id]));
        $entrar($c->ana, 'ana12345')->assertRedirect(route('jogo', [$c->mesa->slug, $c->ana->id]));

        $this->get(route('jogo', [$c->mesa->slug, $c->mestre->id]))->assertInertia(fn (Assert $p) => $p->where('mestre', true));
        $this->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->assertInertia(fn (Assert $p) => $p->where('mestre', false));

        // Sair como Ana não desconecta o mestre.
        $this->post(route('convite.sair', $c->mesa->convite_token), ['jogador' => $c->ana->id]);
        $this->get(route('jogo', [$c->mesa->slug, $c->mestre->id]))->assertOk();
        $this->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->assertRedirect(route('convite.show', $c->mesa->convite_token));
    }

    public function test_entrada_direta_redireciona_para_o_unico_jogador_autenticado(): void
    {
        $c = $this->cenario();
        $this->como($c->ana)->get(route('jogo.entrada', $c->mesa->slug))->assertRedirect(route('jogo', [$c->mesa->slug, $c->ana->id]));
        $this->flushSession();
        $this->get(route('jogo.entrada', $c->mesa->slug))->assertRedirect(route('convite.show', $c->mesa->convite_token));
    }

    public function test_todos_recebem_jogadores_e_personagens_publicos_sem_dados_sensiveis(): void
    {
        $c = $this->cenario();
        $c->ana->update(['senha' => 'segredo123']);
        foreach ([$c->ana, $c->mestre] as $quem) {
            $props = $this->como($quem)->get(route('jogo', [$c->mesa->slug, $quem->id]))->viewData('page')['props'];
            $this->assertSame(['Mestre', 'Ana', 'Bia'], array_column($props['jogadores'], 'nome'));
            $this->assertSame(['Aria', 'Bruno'], array_column($props['personagens'], 'nome'));
            $this->assertSame('Ana', $props['personagens'][0]['jogadores'][0]['nome']);
            $this->assertStringNotContainsString('segredo123', json_encode($props));
            if (! $quem->ehMestre()) {
                $this->assertSame(['id', 'nome', 'papel', 'cor'], array_keys($props['jogadores'][1])); // sem senha nem página
            }
        }
    }

    public function test_jogador_move_tokens_de_todos_os_seus_personagens_e_de_nenhum_alheio(): void
    {
        $c = $this->cenario();
        $dois = $c->mesa->personagens()->create(['nome' => 'Aria II', 'cor' => '#0ea5e9']);
        $dois->jogadores()->attach($c->ana);
        $segundo = $c->pagina->objetos()->create(['camada' => 'jogadores', 'tipo' => 'token', 'personagem_id' => $dois->id, 'x' => 0, 'y' => 0, 'largura' => 70, 'altura' => 70]);
        $mover = fn ($o) => $this->como($c->ana)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $o->id]), ['x' => 70, 'y' => 70]);

        $mover($c->tokenAna)->assertOk();
        $mover($segundo)->assertOk();
        $mover($c->tokenBia)->assertForbidden(); // personagem da Bia
    }

    public function test_personagem_com_dois_jogadores_pode_ser_movido_por_ambos(): void
    {
        $c = $this->cenario();
        $c->aria->jogadores()->attach($c->bia); // Aria agora é da Ana E da Bia
        $mover = fn ($j) => $this->como($j)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $c->tokenAna->id]), ['x' => 140, 'y' => 0]);

        $mover($c->ana)->assertOk();
        $mover($c->bia)->assertOk();
        $this->assertSame(2, $c->aria->jogadores()->count());
    }

    public function test_mestre_atribui_jogadores_a_um_personagem(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $url = route('jogo.personagens.atribuir', [$c->mesa->id, $c->aria->id]);

        $this->como($c->ana)->putJson($url, ['jogadores' => [$c->ana->id, $c->bia->id]])->assertForbidden();
        $this->como($c->mestre)->putJson($url, ['jogadores' => [$c->bia->id]])->assertOk()->assertJsonPath('jogadores.0.nome', 'Bia');
        $this->assertSame([$c->bia->id], $c->aria->jogadores()->pluck('jogadores.id')->all());
        $this->como($c->mestre)->putJson($url, ['jogadores' => [$c->ana->id, $c->bia->id]])->assertOk();
        $this->assertCount(2, $c->aria->jogadores);
        $this->como($c->mestre)->putJson($url, ['jogadores' => []])->assertOk();
        $this->assertCount(0, $c->aria->fresh()->jogadores);
        // não dá para atribuir o mestre nem jogador de outra mesa
        $this->como($c->mestre)->putJson($url, ['jogadores' => [$c->mestre->id]])->assertStatus(422);
        $outra = $this->cenario();
        $this->como($c->mestre)->putJson($url, ['jogadores' => [$outra->ana->id]])->assertStatus(422);
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->nome === 'cena');
    }

    public function test_desenho_e_do_jogador_e_so_ele_apaga(): void
    {
        $c = $this->cenario();
        $traco = ['camada' => 'jogadores', 'tipo' => 'traco', 'x' => 0, 'y' => 0, 'largura' => 5, 'altura' => 5, 'dados' => ['pontos' => [0, 0, 5, 5]]];
        $id = $this->como($c->ana)->postJson(route('jogo.objetos.store', [$c->mesa->id, $c->pagina->id]), $traco)->assertCreated()->json('id');

        $this->assertSame($c->ana->id, \App\Models\Objeto::find($id)->jogador_id);
        $this->como($c->bia)->deleteJson(route('jogo.objetos.destroy', [$c->mesa->id, $id]))->assertForbidden();
        $this->como($c->ana)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $id]), ['x' => 10, 'y' => 10])->assertOk();
        $this->como($c->ana)->deleteJson(route('jogo.objetos.destroy', [$c->mesa->id, $id]))->assertOk();
    }

    public function test_migracao_preserva_tokens_mensagens_e_senhas_dos_personagens_antigos(): void
    {
        // Desfaz só a migração da separação (pelo caminho), sem depender de ser a última.
        $this->artisan('migrate:rollback', ['--path' => 'database/migrations/2026_11_05_100000_separa_jogadores_e_personagens.php'])->assertExitCode(0);
        $dono = User::factory()->create();
        $mesa = $dono->mesas()->create(['nome' => 'Velha', 'slug' => 'velha', 'sistema_id' => Sistema::value('id'), 'tema_entrada' => 'padrao']);
        $pagina = $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
        $agora = now();
        $antigo = fn (string $nome, string $papel) => \Illuminate\Support\Facades\DB::table('personagens')->insertGetId([
            'mesa_id' => $mesa->id, 'nome' => $nome, 'papel' => $papel, 'cor' => '#112233', 'senha' => bcrypt('x-'.$nome), 'pagina_id' => $pagina->id, 'created_at' => $agora, 'updated_at' => $agora,
        ]);
        $mestreId = $antigo('Mestre', 'mestre');
        $anaId = $antigo('Ana', 'jogador');
        $token = DB::table('objetos')->insertGetId(['pagina_id' => $pagina->id, 'camada' => 'jogadores', 'tipo' => 'token', 'personagem_id' => $anaId, 'x' => 1, 'y' => 1, 'largura' => 70, 'altura' => 70, 'created_at' => $agora, 'updated_at' => $agora]);
        $traco = DB::table('objetos')->insertGetId(['pagina_id' => $pagina->id, 'camada' => 'jogadores', 'tipo' => 'traco', 'personagem_id' => $anaId, 'x' => 1, 'y' => 1, 'largura' => 5, 'altura' => 5, 'created_at' => $agora, 'updated_at' => $agora]);
        $msgAna = DB::table('mensagens')->insertGetId(['mesa_id' => $mesa->id, 'personagem_id' => $anaId, 'tipo' => 'texto', 'visibilidade' => 'todos', 'texto' => 'oi', 'created_at' => $agora, 'updated_at' => $agora]);
        $msgMestre = DB::table('mensagens')->insertGetId(['mesa_id' => $mesa->id, 'personagem_id' => $mestreId, 'tipo' => 'texto', 'visibilidade' => 'todos', 'texto' => 'ola', 'created_at' => $agora, 'updated_at' => $agora]);

        $this->artisan('migrate')->assertExitCode(0);

        $ana = Jogador::where('mesa_id', $mesa->id)->where('nome', 'Ana')->first();
        $mestre = Jogador::where('mesa_id', $mesa->id)->where('nome', 'Mestre')->first();
        $this->assertSame('mestre', $mestre->papel);
        $this->assertTrue(\Illuminate\Support\Facades\Hash::check('x-Ana', $ana->senha));      // senha (já com hash) preservada
        $this->assertSame($pagina->id, $ana->pagina_id);
        $this->assertSame([$anaId], $ana->personagens()->pluck('personagens.id')->all());      // mesmo id: o token continua válido
        $this->assertNull(Personagem::find($mestreId));                                         // o "personagem" do mestre era só o login
        $this->assertSame($anaId, DB::table('objetos')->where('id', $token)->value('personagem_id'));
        $this->assertNull(DB::table('objetos')->where('id', $traco)->value('personagem_id'));
        $this->assertSame($ana->id, DB::table('objetos')->where('id', $traco)->value('jogador_id'));
        $this->assertSame($ana->id, DB::table('mensagens')->where('id', $msgAna)->value('jogador_id'));
        $this->assertSame($mestre->id, DB::table('mensagens')->where('id', $msgMestre)->value('jogador_id'));
        $this->assertNull(DB::table('mensagens')->where('id', $msgMestre)->value('personagem_id'));
    }
}
