<?php

namespace Tests\Feature\Jogo;

use App\Models\Item;
use App\Models\Jogador;
use App\Models\Loot;
use App\Models\Sistema;
use App\Models\User;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Loot no mapa: o mestre monta, os jogadores pegam; quem chega depois do que já saiu recebe 409 e nada se duplica. */
class LootTest extends TestCase
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
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9', 'ficha' => FichaOnePiece::padrao()]);
        $aria->jogadores()->attach($ana);
        $beto = $mesa->personagens()->create(['nome' => 'Beto', 'cor' => '#ef4444', 'ficha' => FichaOnePiece::padrao()]);
        $beto->jogadores()->attach($bia);
        $pagina = $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);

        return (object) compact('mesa', 'mestre', 'ana', 'bia', 'aria', 'beto', 'pagina');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    /** Loot na camada dada, com `$qtd` de uma Poção e `$dinheiro`; devolve [objeto_id, loot_item_id]. */
    private function loot($c, string $camada = 'jogadores', int $qtd = 3, int $dinheiro = 100): array
    {
        $r = $this->como($c->mestre)->postJson(route('jogo.loot.criar', [$c->mesa->id, $c->pagina->id]), ['nome' => 'Baú', 'camada' => $camada, 'x' => 0, 'y' => 0])->assertCreated();
        $id = $r->json('objeto.id');
        $e = $this->como($c->mestre)->postJson(route('jogo.loot.itens.store', [$c->mesa->id, $id]), ['origem' => 'novo', 'nome' => 'Poção', 'qtd' => $qtd])->assertOk();
        $this->como($c->mestre)->patchJson(route('jogo.loot.update', [$c->mesa->id, $id]), ['dinheiro' => $dinheiro])->assertOk();

        return [$id, $e->json('itens.0.id')];
    }

    private function pegar($c, $jogador, $personagem, int $objeto, array $corpo)
    {
        return $this->como($jogador)->postJson(route('jogo.loot.pegar', [$c->mesa->id, $objeto]), ['personagem_id' => $personagem->id] + $corpo);
    }

    private function qtdNaFicha($personagem, string $nome): int
    {
        $total = 0;
        foreach ($personagem->fresh()->ficha['inventario'] ?? [] as $secao) {
            foreach ($secao['itens'] ?? [] as $ref) {
                if ($c = Item::find($ref['item_id'] ?? 0)) {
                    $total += $c->nome === $nome ? (int) $ref['qtd'] : 0;
                }
            }
        }

        return $total;
    }

    public function test_loot_recem_criado_volta_com_dinheiro_zero_e_sem_itens(): void
    {
        $c = $this->cenario();
        $this->como($c->mestre)->postJson(route('jogo.loot.criar', [$c->mesa->id, $c->pagina->id]), ['camada' => 'mestre', 'x' => 0, 'y' => 0])
            ->assertCreated()->assertJsonPath('loot.dinheiro', 0)->assertJsonPath('loot.itens', []);
    }

    public function test_so_o_mestre_cria_e_monta_o_loot(): void
    {
        $c = $this->cenario();
        $corpo = ['nome' => 'Baú', 'camada' => 'jogadores', 'x' => 0, 'y' => 0];
        $this->como($c->ana)->postJson(route('jogo.loot.criar', [$c->mesa->id, $c->pagina->id]), $corpo)->assertForbidden();
        [$id] = $this->loot($c);
        $this->como($c->ana)->postJson(route('jogo.loot.itens.store', [$c->mesa->id, $id]), ['origem' => 'novo', 'nome' => 'X'])->assertForbidden();
        $this->como($c->ana)->patchJson(route('jogo.loot.update', [$c->mesa->id, $id]), ['dinheiro' => 999999])->assertForbidden();
        $this->assertSame(100, Loot::first()->dinheiro);
    }

    public function test_loot_na_camada_do_mestre_e_invisivel_ao_jogador_e_na_dos_jogadores_abre_para_todos(): void
    {
        $c = $this->cenario();
        [$oculto] = $this->loot($c, 'mestre');
        [$aberto] = $this->loot($c, 'jogadores');
        $this->como($c->ana)->getJson(route('jogo.loot.mostrar', [$c->mesa->id, $oculto]))->assertNotFound();
        $this->como($c->ana)->getJson(route('jogo.loot.mostrar', [$c->mesa->id, $aberto]))->assertOk()->assertJsonPath('itens.0.item.nome', 'Poção')->assertJsonPath('dinheiro', 100);
        $this->como($c->mestre)->getJson(route('jogo.loot.mostrar', [$c->mesa->id, $oculto]))->assertOk();
        $this->como($c->ana)->postJson(route('jogo.loot.pegar', [$c->mesa->id, $oculto]), ['personagem_id' => $c->aria->id, 'dinheiro' => true, 'tudo' => true])->assertNotFound();
    }

    public function test_jogador_pega_item_e_dinheiro_na_propria_ficha_e_so_nela(): void
    {
        $c = $this->cenario();
        [$id, $linha] = $this->loot($c);
        $this->pegar($c, $c->ana, $c->beto, $id, ['loot_item_id' => $linha])->assertForbidden(); // ficha do outro
        $this->pegar($c, $c->ana, $c->aria, $id, ['loot_item_id' => $linha, 'qtd' => 2])->assertOk()->assertJsonPath('loot.itens.0.qtd', 1);
        $this->assertSame(2, $this->qtdNaFicha($c->aria, 'Poção'));
        $this->pegar($c, $c->bia, $c->beto, $id, ['dinheiro' => true, 'qtd' => 30])->assertOk()->assertJsonPath('loot.dinheiro', 70);
        $this->assertSame(30, $c->beto->fresh()->ficha['belly']);
        $this->assertSame(0, $this->qtdNaFicha($c->beto, 'Poção'));
    }

    public function test_quem_chega_depois_nao_leva_o_que_ja_saiu_e_nada_se_duplica(): void
    {
        $c = $this->cenario();
        [$id, $linha] = $this->loot($c, 'jogadores', 1, 50);
        $this->pegar($c, $c->ana, $c->aria, $id, ['loot_item_id' => $linha])->assertOk();
        $r = $this->pegar($c, $c->bia, $c->beto, $id, ['loot_item_id' => $linha])->assertStatus(409);
        $this->assertSame([], $r->json('loot.itens'));
        $this->assertSame(1, $this->qtdNaFicha($c->aria, 'Poção'));
        $this->assertSame(0, $this->qtdNaFicha($c->beto, 'Poção'));

        $this->pegar($c, $c->ana, $c->aria, $id, ['dinheiro' => true, 'tudo' => true])->assertOk();
        $this->pegar($c, $c->bia, $c->beto, $id, ['dinheiro' => true, 'tudo' => true])->assertStatus(409);
        $this->assertSame(50, $c->aria->fresh()->ficha['belly']);
        $this->assertSame(0, $c->beto->fresh()->ficha['belly'] ?? 0);
    }

    public function test_pedir_mais_do_que_resta_falha_sem_levar_nada(): void
    {
        $c = $this->cenario();
        [$id, $linha] = $this->loot($c, 'jogadores', 2, 10);
        $this->pegar($c, $c->ana, $c->aria, $id, ['loot_item_id' => $linha, 'qtd' => 3])->assertStatus(409)->assertJsonPath('loot.itens.0.qtd', 2);
        $this->pegar($c, $c->ana, $c->aria, $id, ['dinheiro' => true, 'qtd' => 11])->assertStatus(409)->assertJsonPath('loot.dinheiro', 10);
        $this->assertSame(0, $this->qtdNaFicha($c->aria, 'Poção'));
        $this->pegar($c, $c->ana, $c->aria, $id, ['loot_item_id' => $linha, 'tudo' => true])->assertOk()->assertJsonPath('loot.itens', []);
        $this->assertSame(2, $this->qtdNaFicha($c->aria, 'Poção'));
    }

    public function test_mestre_adiciona_do_catalogo_e_da_aba_itens_e_ajusta_a_quantidade(): void
    {
        $c = $this->cenario();
        [$id, $linha] = $this->loot($c);
        $ref = collect(app(RegistroSistemas::class)->resolver('one-piece')->catalogoDeLoja()['itens'])->first(fn ($i) => ($i['tipo'] ?? 'item') === 'item' && ! empty($i['loja']))['id'];
        $this->como($c->mestre)->postJson(route('jogo.loot.itens.store', [$c->mesa->id, $id]), ['origem' => 'catalogo', 'ref' => $ref, 'qtd' => 2])->assertOk()->assertJsonCount(2, 'itens');
        $meu = $c->mesa->itens()->create(['nome' => 'Mapa do Tesouro', 'peso' => 0, 'equipavel' => false]);
        $this->como($c->mestre)->postJson(route('jogo.loot.itens.store', [$c->mesa->id, $id]), ['origem' => 'item', 'item_id' => $meu->id])->assertOk()->assertJsonCount(3, 'itens');
        $this->como($c->mestre)->postJson(route('jogo.loot.itens.store', [$c->mesa->id, $id]), ['origem' => 'item', 'item_id' => $meu->id, 'qtd' => 2])->assertOk()->assertJsonPath('itens.2.qtd', 3);
        $this->como($c->mestre)->patchJson(route('jogo.loot.itens.update', [$c->mesa->id, $id, $linha]), ['qtd' => 0])->assertOk()->assertJsonCount(2, 'itens');
        $this->como($c->mestre)->postJson(route('jogo.loot.itens.store', [$c->mesa->id, $id]), ['origem' => 'catalogo', 'ref' => 'nao-existe'])->assertStatus(422);
    }

    public function test_jogador_nao_move_nem_apaga_o_loot_e_ele_nao_vai_ao_jogador_na_camada_do_mestre(): void
    {
        $c = $this->cenario();
        [$id] = $this->loot($c, 'mestre');
        $this->como($c->ana)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $id]), ['x' => 5, 'y' => 5])->assertForbidden();
        $this->como($c->ana)->deleteJson(route('jogo.objetos.destroy', [$c->mesa->id, $id]))->assertForbidden();
        $this->como($c->mestre)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $id]), ['camada' => 'mapa'])->assertStatus(422);
    }

    public function test_apagar_o_objeto_apaga_o_loot(): void
    {
        $c = $this->cenario();
        [$id] = $this->loot($c);
        $this->como($c->mestre)->deleteJson(route('jogo.objetos.destroy', [$c->mesa->id, $id]))->assertOk();
        $this->assertSame(0, Loot::count());
    }
}
