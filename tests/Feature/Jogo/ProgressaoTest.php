<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** O mestre libera descansos e subir de nível e distribui o XP; o jogador só vê o XP e só sobe com XP e liberação. */
class ProgressaoTest extends TestCase
{
    use RefreshDatabase;

    private Mesa $mesa;

    private Jogador $mestre;

    private Jogador $ana;

    private Personagem $aria;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $this->mestre = $this->mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $this->ana = $this->mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $this->aria = $this->mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $this->aria->jogadores()->attach($this->ana);
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    private function personagem(string $nome): Personagem
    {
        $p = $this->mesa->personagens()->create(['nome' => $nome, 'cor' => '#ef4444']);
        $p->jogadores()->attach($this->mesa->jogadores()->create(['nome' => "J{$nome}", 'papel' => 'jogador', 'cor' => '#16a34a']));

        return $p;
    }

    private function xpDe(Personagem $p): int
    {
        return (int) ($p->fresh()->ficha['xp']['atual'] ?? 0);
    }

    public function test_so_o_mestre_libera_e_distribui(): void
    {
        $this->como($this->ana)->patchJson(route('jogo.liberacoes', $this->mesa->id), ['descanso_curto' => true])->assertForbidden();
        $this->como($this->ana)->postJson(route('jogo.xp.distribuir', $this->mesa->id), ['personagens' => [$this->aria->id], 'total' => 100])->assertForbidden();
        $this->assertFalse($this->mesa->fresh()->descanso_curto);
    }

    public function test_liberacoes_comecam_desligadas_e_chegam_aos_jogadores(): void
    {
        $this->como($this->ana)->get(route('jogo', [$this->mesa->slug, $this->ana->id]))
            ->assertInertia(fn ($p) => $p->where('mesa.descanso_curto', false)->where('mesa.descanso_longo', false)->where('mesa.subir_nivel', false));

        $this->como($this->mestre)->patchJson(route('jogo.liberacoes', $this->mesa->id), ['descanso_longo' => true, 'subir_nivel' => true])->assertOk();
        $this->como($this->ana)->get(route('jogo', [$this->mesa->slug, $this->ana->id]))
            ->assertInertia(fn ($p) => $p->where('mesa.descanso_curto', false)->where('mesa.descanso_longo', true)->where('mesa.subir_nivel', true));
    }

    public function test_divide_o_xp_em_partes_iguais(): void
    {
        $b = $this->personagem('Bia');
        $c = $this->personagem('Caio');
        $r = $this->como($this->mestre)->postJson(route('jogo.xp.distribuir', $this->mesa->id), ['personagens' => [$this->aria->id, $b->id, $c->id], 'total' => 2700])->assertOk();
        $this->assertSame(900, $r->json('por_cabeca'));
        $this->assertSame(0, $r->json('sobra'));
        foreach ([$this->aria, $b, $c] as $p) {
            $this->assertSame(900, $this->xpDe($p));
        }
        // soma ao que já tem; o que sobra da divisão não é distribuído
        $r = $this->como($this->mestre)->postJson(route('jogo.xp.distribuir', $this->mesa->id), ['personagens' => [$this->aria->id, $b->id, $c->id], 'total' => 100])->assertOk();
        $this->assertSame([33, 1], [$r->json('por_cabeca'), $r->json('sobra')]);
        $this->assertSame(933, $this->xpDe($this->aria));
    }

    public function test_total_pequeno_demais_ou_personagem_de_outra_mesa_e_recusado(): void
    {
        $this->como($this->mestre)->postJson(route('jogo.xp.distribuir', $this->mesa->id), ['personagens' => [$this->aria->id, $this->personagem('Bia')->id], 'total' => 1])->assertStatus(422);
        $outra = User::factory()->create()->mesas()->create(['nome' => 'O', 'slug' => 'o-'.uniqid(), 'sistema_id' => $this->mesa->sistema_id, 'tema_entrada' => 'padrao']);
        $alheio = $outra->personagens()->create(['nome' => 'Zed', 'cor' => '#000000']);
        $this->como($this->mestre)->postJson(route('jogo.xp.distribuir', $this->mesa->id), ['personagens' => [$alheio->id], 'total' => 100])->assertStatus(422);
        $this->assertSame(0, $this->xpDe($alheio));
    }

    public function test_jogador_nao_edita_o_xp_mas_o_mestre_sim(): void
    {
        $rota = route('jogo.personagens.ficha', [$this->mesa->id, $this->aria->id]);
        $this->como($this->ana)->patchJson($rota, ['campos' => ['xp.atual' => 9999]])->assertForbidden();
        $this->assertSame(0, $this->xpDe($this->aria));
        $this->como($this->mestre)->patchJson($rota, ['campos' => ['xp.atual' => 500]])->assertOk();
        $this->assertSame(500, $this->xpDe($this->aria));
    }

    public function test_jogador_so_sobe_de_nivel_com_xp_e_liberacao_do_mestre(): void
    {
        $rota = route('jogo.personagens.ficha', [$this->mesa->id, $this->aria->id]);
        $subir = fn (int $nivel) => $this->como($this->ana)->patchJson($rota, ['campos' => ['nivel' => $nivel]]);

        $this->mesa->forceFill(['subir_nivel' => false])->save();
        $this->como($this->mestre)->patchJson($rota, ['campos' => ['xp.atual' => 300]])->assertOk(); // XP no máximo do 1º nível
        $subir(2)->assertForbidden(); // sem a liberação

        $this->como($this->mestre)->patchJson(route('jogo.liberacoes', $this->mesa->id), ['subir_nivel' => true])->assertOk();
        $this->como($this->mestre)->patchJson($rota, ['campos' => ['xp.atual' => 299]])->assertOk();
        $subir(2)->assertForbidden(); // liberado, mas falta XP

        $this->como($this->mestre)->patchJson($rota, ['campos' => ['xp.atual' => 300]])->assertOk();
        $subir(3)->assertForbidden(); // um nível por vez
        $subir(2)->assertOk();
        $this->assertSame(2, $this->aria->fresh()->ficha['nivel']);

        $subir(3)->assertForbidden(); // o 2º nível pede 900 de XP
    }
}
