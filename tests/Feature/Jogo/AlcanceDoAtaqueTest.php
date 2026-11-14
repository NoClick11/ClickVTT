<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Routing\Middleware\ThrottleRequests;
use Tests\TestCase;

/** Ataque normal contra o alvo mirado: além do alcance da arma (ou do corpo a corpo, no desarmado) é recusado; dentro, rola. */
class AlcanceDoAtaqueTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(): object
    {
        $this->withoutMiddleware(ThrottleRequests::class);
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $pagina = $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1, 'tamanho_quadrado' => 100, 'distancia_quadrado' => 1.5, 'unidade' => 'm']);
        $espada = $mesa->itens()->create(['nome' => 'Espada', 'peso' => 2, 'equipavel' => true, 'dados' => ['arma' => ['dano' => '1d8', 'atributo' => 'for', 'tipoDano' => 'Cortante', 'proficiente' => true, 'alcanceNormal' => 1.5, 'alcanceMaximo' => 1.5]]]);
        $arco = $mesa->itens()->create(['nome' => 'Arco', 'peso' => 1, 'equipavel' => true, 'dados' => ['arma' => ['dano' => '1d6', 'atributo' => 'des', 'tipoDano' => 'Perfurante', 'proficiente' => true, 'distancia' => true, 'alcanceNormal' => 9, 'alcanceMaximo' => 18]]]);
        $p = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $p->jogadores()->attach($ana);
        $f = FichaOnePiece::padrao();
        $f['inventario'] = [['secao' => 'Equipamento', 'itens' => [
            ['item_id' => $espada->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false],
            ['item_id' => $arco->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false],
        ]]];
        $p->ficha = $f;
        $p->save();
        $alvo = $mesa->personagens()->create(['nome' => 'Pirata', 'cor' => '#ef4444', 'ficha' => FichaOnePiece::padrao()]);
        $token = fn ($pers, $x) => $pagina->objetos()->create(['camada' => 'jogadores', 'tipo' => 'token', 'personagem_id' => $pers->id, 'x' => $x, 'y' => 0, 'largura' => 100, 'altura' => 100, 'z' => 1]);
        $tAlvo = $token($alvo, 0);
        $token($p, 100);

        return (object) compact('mesa', 'mestre', 'ana', 'p', 'alvo', 'espada', 'arco', 'tAlvo', 'pagina');
    }

    private function atacar($c, string $expressao, array $extra = [], ?Jogador $quem = null)
    {
        $quem ??= $c->ana;

        return $this->withSession(['acesso_mesas' => [$quem->mesa_id => [$quem->id => true]]])->withHeader('X-Jogador', (string) $quem->id)
            ->postJson(route('jogo.rolagens.store', $c->mesa->id), array_replace([
                'expressao' => $expressao, 'rotulo' => 'Ataque', 'visibilidade' => 'todos', 'personagem_id' => $c->p->id, 'alvo_personagem_id' => $c->alvo->id,
            ], $extra));
    }

    private function alvoEmQuadrados($c, int $q): void
    {
        $c->tAlvo->update(['x' => 100 - $q * 100]); // o atacante está em x=100: o alvo fica a $q quadrados dele
    }

    public function test_corpo_a_corpo_so_ataca_no_vizinho(): void
    {
        $c = $this->cenario();
        $this->atacar($c, "1d20+@arma.{$c->espada->id}.ataque")->assertCreated(); // vizinho (1 quadrado = 1,5 m)
        $this->alvoEmQuadrados($c, 3); // 3 quadrados = 4,5 m
        $this->atacar($c, "1d20+@arma.{$c->espada->id}.ataque")->assertStatus(422)->assertJsonValidationErrors('alvo_personagem_id');
    }

    public function test_diagonal_conta_como_vizinho(): void
    {
        $c = $this->cenario();
        $c->tAlvo->update(['x' => 0, 'y' => 100]);
        $this->atacar($c, "1d20+@arma.{$c->espada->id}.ataque")->assertCreated();
    }

    public function test_arma_a_distancia_vai_ate_o_alcance_maximo(): void
    {
        $c = $this->cenario();
        $this->alvoEmQuadrados($c, 12); // 18 m: no limite
        $this->atacar($c, "1d20+@arma.{$c->arco->id}.ataque")->assertCreated();
        $this->alvoEmQuadrados($c, 13); // 19,5 m: passa
        $this->atacar($c, "1d20+@arma.{$c->arco->id}.ataque")->assertStatus(422);
    }

    public function test_desarmado_usa_o_alcance_corpo_a_corpo(): void
    {
        $c = $this->cenario();
        $this->atacar($c, '1d20+@ataque.desarmado')->assertCreated();
        $this->alvoEmQuadrados($c, 2);
        $this->atacar($c, '1d20+@ataque.desarmado')->assertStatus(422);
    }

    public function test_sem_alvo_mirado_ou_em_tecnica_nao_trava(): void
    {
        $c = $this->cenario();
        $this->alvoEmQuadrados($c, 30);
        $this->atacar($c, "1d20+@arma.{$c->espada->id}.ataque", ['alvo_personagem_id' => null])->assertCreated();
        $this->atacar($c, '1d20+@ataque', ['tecnica' => ['nome' => 'Tiro']])->assertCreated(); // Técnica: alcance é dela
    }

    public function test_ataque_de_npc_usa_o_alcance_da_ficha(): void
    {
        $c = $this->cenario();
        $npc = ['tecnica' => ['nome' => 'Facada', 'semTecnica' => true, 'ataque' => true, 'alcance' => 1.5]];
        $this->alvoEmQuadrados($c, 1);
        $this->atacar($c, '1d20+5', $npc, $c->mestre)->assertCreated();
        $this->alvoEmQuadrados($c, 4);
        $this->atacar($c, '1d20+5', $npc, $c->mestre)->assertStatus(422);
    }

    public function test_entre_o_normal_e_o_maximo_rola_com_desvantagem(): void
    {
        $c = $this->cenario();
        $arco = "1d20+@arma.{$c->arco->id}.ataque";
        $this->alvoEmQuadrados($c, 6); // 9 m: no alcance normal, sem desvantagem
        $this->assertSame($arco, $this->atacar($c, $arco)->assertCreated()->json('dados.expressao'));
        $this->alvoEmQuadrados($c, 7); // 10,5 m: entre o normal (9) e o máximo (18)
        $r = $this->atacar($c, $arco)->assertCreated();
        $this->assertSame("2d20kl1+@arma.{$c->arco->id}.ataque", $r->json('dados.expressao'));
        $this->assertStringContainsString('desvantagem', $r->json('dados.rotulo'));
        // vantagem + desvantagem se anulam
        $this->assertSame($arco, $this->atacar($c, "2d20kh1+@arma.{$c->arco->id}.ataque")->assertCreated()->json('dados.expressao'));
        // já com desvantagem: segue igual
        $this->assertSame("2d20kl1+@arma.{$c->arco->id}.ataque", $this->atacar($c, "2d20kl1+@arma.{$c->arco->id}.ataque")->json('dados.expressao'));
    }

    public function test_corpo_a_corpo_nunca_ganha_desvantagem_por_alcance(): void
    {
        $c = $this->cenario();
        $espada = "1d20+@arma.{$c->espada->id}.ataque";
        $this->assertSame($espada, $this->atacar($c, $espada)->assertCreated()->json('dados.expressao'));
    }

    public function test_npc_a_distancia_tem_desvantagem_alem_do_alcance_normal(): void
    {
        $c = $this->cenario();
        $npc = ['tecnica' => ['nome' => 'Tiro', 'semTecnica' => true, 'ataque' => true, 'alcance' => 18, 'alcanceNormal' => 9]];
        $this->alvoEmQuadrados($c, 8); // 12 m
        $this->assertSame('2d20kl1+5', $this->atacar($c, '1d20+5', $npc, $c->mestre)->assertCreated()->json('dados.expressao'));
    }
}
