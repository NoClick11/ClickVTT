<?php

namespace Tests\Feature\Jogo;

use App\Events\EventoMesa;
use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\Dnd5e\FichaDnd5e;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

/** O mestre cria personagens de dentro do jogo (aba Personagens). */
class PersonagemJogoTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(): object
    {
        $mesa = User::factory()->create()->mesas()->create(['nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'dnd-5e')->value('id'), 'tema_entrada' => 'padrao']);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $bia = $mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);

        return (object) compact('mesa', 'mestre', 'ana', 'bia');
    }

    private function como(Jogador $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => [$p->id => true]]])->withHeader('X-Jogador', (string) $p->id);
    }

    private function criar($c, Jogador $quem, array $corpo = [])
    {
        return $this->como($quem)->postJson(route('jogo.personagens.store', $c->mesa->id), $corpo + ['nome' => 'Aria', 'cor' => '#0ea5e9', 'jogadores' => []]);
    }

    public function test_mestre_cria_personagem_npc_sem_jogadores(): void
    {
        $c = $this->cenario();
        $r = $this->criar($c, $c->mestre, ['nome' => '  Aria  '])->assertCreated()->json();

        $this->assertSame('Aria', $r['nome']); // sem espaços nas pontas
        $this->assertSame('#0ea5e9', $r['cor']);
        $this->assertSame([], $r['jogadores']);
        $p = $c->mesa->personagens()->firstOrFail();
        $this->assertSame($r['id'], $p->id);
        $this->assertNull($p->ficha); // a ficha nasce com o padrão do sistema, sem gravar nada
    }

    public function test_mestre_cria_personagem_ja_com_jogadores_e_eles_passam_a_controla_lo(): void
    {
        $c = $this->cenario();
        $r = $this->criar($c, $c->mestre, ['jogadores' => [$c->ana->id]])->assertCreated()->json();

        $this->assertSame([$c->ana->id], collect($r['jogadores'])->pluck('id')->all());
        $this->assertSame([$r['id']], $c->ana->personagens()->pluck('personagens.id')->all());
        $this->assertSame([], $c->bia->personagens()->pluck('personagens.id')->all());
    }

    public function test_jogador_nao_cria_personagem_no_jogo(): void
    {
        $c = $this->cenario();
        $this->criar($c, $c->ana)->assertForbidden();
        $this->assertSame(0, $c->mesa->personagens()->count());
    }

    public function test_sem_acesso_ao_convite_nao_cria(): void
    {
        $c = $this->cenario();
        $this->postJson(route('jogo.personagens.store', $c->mesa->id), ['nome' => 'X', 'cor' => '#0ea5e9'])->assertForbidden();
    }

    public function test_validacao_igual_a_do_site(): void
    {
        $c = $this->cenario();
        $outra = $this->cenario();
        $this->criar($c, $c->mestre)->assertCreated();

        $this->criar($c, $c->mestre)->assertStatus(422)->assertJsonValidationErrors('nome');                       // nome repetido na mesa
        $this->criar($outra, $outra->mestre)->assertCreated();                                                     // em outra mesa pode
        $this->criar($c, $c->mestre, ['nome' => ''])->assertStatus(422)->assertJsonValidationErrors('nome');
        $this->criar($c, $c->mestre, ['nome' => str_repeat('a', 61)])->assertStatus(422);
        $this->criar($c, $c->mestre, ['nome' => 'B', 'cor' => 'azul'])->assertStatus(422)->assertJsonValidationErrors('cor');
        $this->criar($c, $c->mestre, ['nome' => 'C', 'jogadores' => [$outra->ana->id]])->assertStatus(422);       // jogador de outra mesa
        $this->criar($c, $c->mestre, ['nome' => 'D', 'jogadores' => [$c->mestre->id]])->assertStatus(422);        // o mestre não é "jogador" do personagem
        $this->criar($c, $c->mestre, ['nome' => 'E', 'jogadores' => ['x']])->assertStatus(422);
        $this->assertSame(1, $c->mesa->personagens()->count());
    }

    public function test_avisa_a_mesa_para_recarregar(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $this->criar($c, $c->mestre)->assertCreated();

        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->nome === 'cena' && $e->canais === ['mesa'] && $e->payload['ator'] === $c->mestre->id);
    }

    public function test_personagem_criado_aparece_no_jogo_e_a_ficha_chega_so_a_quem_controla(): void
    {
        $c = $this->cenario();
        $id = $this->criar($c, $c->mestre, ['jogadores' => [$c->ana->id]])->assertCreated()->json('id');

        $ver = fn (Jogador $p) => collect($this->como($p)->get(route('jogo', [$c->mesa->slug, $p->id]))->viewData('page')['props']['personagens'])->firstWhere('id', $id);

        $this->assertSame(FichaDnd5e::padrao(), $ver($c->mestre)['ficha']);
        $this->assertSame(FichaDnd5e::padrao(), $ver($c->ana)['ficha']);
        $this->assertArrayNotHasKey('ficha', $ver($c->bia)); // a mesa vê o personagem, não a ficha
    }

    public function test_dono_da_ficha_nova_ja_consegue_edita_la(): void
    {
        $c = $this->cenario();
        $id = $this->criar($c, $c->mestre, ['jogadores' => [$c->ana->id]])->assertCreated()->json('id');
        $url = route('jogo.personagens.ficha', [$c->mesa->id, $id]);

        $this->como($c->ana)->patchJson($url, ['campos' => ['pv.atual' => 5]])->assertOk();
        $this->como($c->bia)->patchJson($url, ['campos' => ['pv.atual' => 9]])->assertForbidden();
    }

    public function test_site_continua_validando_do_mesmo_jeito(): void
    {
        $dono = User::factory()->create();
        $mesa = $dono->mesas()->create(['nome' => 'S', 'slug' => 's-'.uniqid(), 'sistema_id' => Sistema::value('id'), 'tema_entrada' => 'padrao']);
        $mesa->personagens()->create(['nome' => 'Repetido', 'cor' => '#fff']);

        $this->actingAs($dono)->post(route('personagens.store', $mesa->id), ['nome' => 'Repetido', 'cor' => '#0ea5e9'])->assertSessionHasErrors('nome');
        $this->actingAs($dono)->post(route('personagens.store', $mesa->id), ['nome' => 'Novo', 'cor' => '#0ea5e9'])->assertSessionHasNoErrors();
        $this->assertSame(2, $mesa->personagens()->count());
    }
}
