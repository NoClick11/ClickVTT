<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Mesa;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/** Diário: pastas e folhetos são do mestre; o jogador só vê o que for liberado. */
class DiarioTest extends TestCase
{
    use RefreshDatabase;

    private Mesa $mesa;

    private Jogador $mestre;

    private Jogador $ana;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('public');
        $this->mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $this->mestre = $this->mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $this->ana = $this->mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    private function rota(string $nome, ...$p): string
    {
        return route("jogo.$nome", [$this->mesa->id, ...$p]);
    }

    public function test_so_o_mestre_cria_pasta_e_folheto(): void
    {
        $this->como($this->ana)->postJson($this->rota('diario.pastas.store'), ['nome' => 'X'])->assertForbidden();
        $this->como($this->ana)->postJson($this->rota('diario.folhetos.store'), ['nome' => 'X', 'imagem' => UploadedFile::fake()->image('a.png')])->assertForbidden();
    }

    public function test_folheto_com_imagem_so_aparece_ao_jogador_quando_liberado(): void
    {
        $pasta = $this->como($this->mestre)->postJson($this->rota('diario.pastas.store'), ['nome' => 'Mapas'])->assertCreated()->json('id');
        $f = $this->como($this->mestre)->postJson($this->rota('diario.folhetos.store'), [
            'nome' => 'Carta', 'pasta_id' => $pasta, 'imagem' => UploadedFile::fake()->image('carta.png'),
        ])->assertCreated()->json();
        Storage::disk('public')->assertExists(str_replace('/storage/', '', $f['imagem']));

        $this->como($this->ana)->get(route('jogo', [$this->mesa->slug, $this->ana->id]))
            ->assertInertia(fn ($p) => $p->where('diario.folhetos', [])->where('diario.pastas', []));

        $this->como($this->mestre)->patchJson($this->rota('diario.folhetos.update', $f['id']), ['visivel' => true])->assertOk();
        $this->como($this->ana)->get(route('jogo', [$this->mesa->slug, $this->ana->id]))
            ->assertInertia(fn ($p) => $p->has('diario.folhetos', 1)->has('diario.pastas', 1));
    }

    public function test_excluir_pasta_sobe_o_conteudo_e_nao_aceita_ciclo(): void
    {
        $a = $this->mesa->diarioPastas()->create(['nome' => 'A']);
        $b = $this->mesa->diarioPastas()->create(['nome' => 'B', 'pai_id' => $a->id]);
        $p = $this->mesa->personagens()->create(['nome' => 'Bruto', 'cor' => '#ef4444', 'pasta_id' => $b->id]);

        $this->como($this->mestre)->patchJson($this->rota('diario.pastas.update', $a->id), ['pai_id' => $b->id])->assertStatus(422);
        $this->como($this->mestre)->deleteJson($this->rota('diario.pastas.destroy', $b->id))->assertOk();
        $this->assertSame($a->id, $p->fresh()->pasta_id); // subiu para a pasta de cima
        $this->como($this->mestre)->patchJson($this->rota('personagens.pasta', $p->id), ['pasta_id' => null])->assertOk();
        $this->assertNull($p->fresh()->pasta_id);
    }

    public function test_excluir_folheto_apaga_a_imagem(): void
    {
        $f = $this->como($this->mestre)->postJson($this->rota('diario.folhetos.store'), ['nome' => 'C', 'imagem' => UploadedFile::fake()->image('c.png')])->json();
        $this->como($this->mestre)->deleteJson($this->rota('diario.folhetos.destroy', $f['id']))->assertOk();
        Storage::disk('public')->assertMissing(str_replace('/storage/', '', $f['imagem']));
    }
}
