<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** A loja: só o mestre abre (jogadores e categorias), o jogador compra com o preço do servidor e Belly na ficha. */
class LojaTest extends TestCase
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
        $beto = $mesa->personagens()->create(['nome' => 'Beto', 'cor' => '#ef4444']);
        $beto->jogadores()->attach($bia);
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);

        return (object) compact('mesa', 'mestre', 'ana', 'bia', 'aria', 'beto');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    private function dar($c, $personagem, int $belly): void
    {
        $f = $personagem->ficha ?? FichaOnePiece::padrao();
        $f['belly'] = $belly;
        $personagem->ficha = $f;
        $personagem->save();
    }

    public function test_so_o_mestre_abre_a_loja_e_so_para_quem_ele_escolhe(): void
    {
        $c = $this->cenario();
        $corpo = ['jogadores' => [$c->ana->id], 'categorias' => ['armas-cortantes']];
        $this->como($c->ana)->postJson(route('jogo.loja.abrir', $c->mesa->id), $corpo)->assertForbidden();
        $this->como($c->mestre)->postJson(route('jogo.loja.abrir', $c->mesa->id), ['jogadores' => 'todos', 'categorias' => ['inventada']])->assertStatus(422);
        $this->como($c->mestre)->postJson(route('jogo.loja.abrir', $c->mesa->id), $corpo)->assertOk()->assertJsonCount(1, 'lojas');
        $this->assertSame(1, $c->mesa->lojasAbertas()->count());
        $this->como($c->mestre)->postJson(route('jogo.loja.abrir', $c->mesa->id), ['jogadores' => 'todos', 'categorias' => ['kits'], 'fator' => 150])->assertOk()->assertJsonCount(2, 'lojas');
        $this->como($c->mestre)->deleteJson(route('jogo.loja.fechar', $c->mesa->id), ['jogadores' => [$c->bia->id]])->assertOk()->assertJsonCount(1, 'lojas');
    }

    public function test_compra_confere_loja_aberta_categoria_preco_do_servidor_e_belly(): void
    {
        $c = $this->cenario();
        $this->dar($c, $c->aria, 100000);
        $compra = fn ($jogador, $personagem, string $item, int $qtd = 1) => $this->como($jogador)->postJson(route('jogo.loja.comprar', $c->mesa->id), ['personagem_id' => $personagem->id, 'item' => $item, 'qtd' => $qtd]);

        $compra($c->ana, $c->aria, 'katana')->assertStatus(422); // loja fechada
        $this->como($c->mestre)->postJson(route('jogo.loja.abrir', $c->mesa->id), ['jogadores' => [$c->ana->id], 'categorias' => ['armas-cortantes']])->assertOk();
        $compra($c->bia, $c->beto, 'katana')->assertStatus(422); // loja aberta só para a Ana
        $compra($c->ana, $c->beto, 'katana')->assertForbidden(); // ficha de outro
        $compra($c->ana, $c->aria, 'kit-medico')->assertStatus(422); // categoria fora da loja
        $compra($c->ana, $c->aria, 'municao-de-kairoseki')->assertStatus(422); // fora da categoria aberta
        // sem dinheiro: avisa e não cobra nem entrega
        $r = $compra($c->ana, $c->aria, 'espada-montante', 1)->assertStatus(422);
        $this->assertStringContainsString('Sem dinheiro', $r->json('errors.dinheiro.0'));
        $this->assertSame(100000, $c->aria->fresh()->ficha['belly']);
        // compra válida: 70.000 da katana, entrega e item escondido da aba Itens (catalogo_id)
        $r = $compra($c->ana, $c->aria, 'katana')->assertOk();
        $this->assertSame(30000, $r->json('saldo'));
        $ficha = $c->aria->fresh()->ficha;
        $this->assertSame(30000, $ficha['belly']);
        $itemId = $ficha['inventario'][0]['itens'][0]['item_id'];
        $item = $c->mesa->itens()->find($itemId);
        $this->assertSame('katana', $item->catalogo_id);
        $this->assertSame('acuidade', $item->dados['arma']['atributo']);
        // o mesmo item de novo soma a quantidade, sem outro item na mesa
        $this->dar($c, $c->aria->fresh(), 200000);
        $compra($c->ana, $c->aria, 'katana', 2)->assertOk();
        $this->assertSame(1, $c->mesa->itens()->count());
        $this->assertSame(3, $c->aria->fresh()->ficha['inventario'][0]['itens'][0]['qtd']);
        $this->assertSame(60000, $c->aria->fresh()->ficha['belly']);
    }

    public function test_ajuste_de_preco_da_loja_e_item_criado_pelo_mestre(): void
    {
        $c = $this->cenario();
        $this->dar($c, $c->aria, 1000000);
        $criar = $this->como($c->mestre)->postJson(route('jogo.catalogo.store', $c->mesa->id), [
            'nome' => 'Espada do Capitão', 'descricao' => 'Única.', 'categoria' => 'armas-cortantes', 'raridade' => 'raro', 'preco' => 500000, 'peso' => 2,
            'equipavel' => true, 'requer_sintonia' => false, 'efeitos' => [['alvo' => 'ca', 'modo' => 'soma', 'valor' => 1]], 'dados' => ['arma' => ['dano' => '1d8', 'atributo' => 'for', 'tipoDano' => 'Cortante', 'alcanceNormal' => 1.5, 'alcanceMaximo' => 1.5]],
        ])->assertCreated();
        $id = 'c:'.$criar->json('id');
        $this->como($c->ana)->postJson(route('jogo.catalogo.store', $c->mesa->id), ['nome' => 'x'])->assertForbidden();
        $this->como($c->mestre)->postJson(route('jogo.catalogo.store', $c->mesa->id), ['nome' => 'Ruim', 'categoria' => 'inventada', 'raridade' => 'raro', 'preco' => 1, 'peso' => 1, 'equipavel' => true, 'requer_sintonia' => false])->assertStatus(422);
        $this->como($c->mestre)->postJson(route('jogo.loja.abrir', $c->mesa->id), ['jogadores' => [$c->ana->id], 'categorias' => ['armas-cortantes'], 'raridades' => ['comum'], 'fator' => 150])->assertOk();
        $this->como($c->ana)->postJson(route('jogo.loja.comprar', $c->mesa->id), ['personagem_id' => $c->aria->id, 'item' => $id])->assertStatus(422); // item raro, loja só de comuns
        $this->como($c->mestre)->postJson(route('jogo.loja.abrir', $c->mesa->id), ['jogadores' => [$c->ana->id], 'categorias' => ['armas-cortantes'], 'raridades' => ['raro', 'comum'], 'fator' => 150])->assertOk();
        // o jogador recebe, na página, só a loja dele com o item do mestre
        $r = $this->como($c->ana)->postJson(route('jogo.loja.comprar', $c->mesa->id), ['personagem_id' => $c->aria->id, 'item' => $id])->assertOk();
        $this->assertSame(750000, $r->json('total')); // 500.000 × 150%
        $this->assertSame(250000, $c->aria->fresh()->ficha['belly']);
        $item = $c->mesa->itens()->where('catalogo_id', $id)->first();
        $this->assertSame('Espada do Capitão', $item->nome);
        $this->assertSame('ca', $item->efeitos[0]['alvo']);
        // editar e excluir são do mestre
        $this->como($c->ana)->patchJson(route('jogo.catalogo.update', [$c->mesa->id, $criar->json('id')]), ['preco' => 1])->assertForbidden();
        $this->como($c->mestre)->patchJson(route('jogo.catalogo.update', [$c->mesa->id, $criar->json('id')]), ['preco' => 10])->assertOk()->assertJsonPath('preco', 10);
        $this->como($c->mestre)->deleteJson(route('jogo.catalogo.destroy', [$c->mesa->id, $criar->json('id')]))->assertOk();
        $this->como($c->ana)->postJson(route('jogo.loja.comprar', $c->mesa->id), ['personagem_id' => $c->aria->id, 'item' => $id])->assertStatus(422);
    }

    public function test_espelho_php_do_item_da_mesa_igual_ao_do_ts(): void
    {
        $fixture = json_decode(file_get_contents(base_path('tests/Fixtures/itens-da-mesa.json')), true);
        $catalogo = collect(\App\Sistemas\OnePiece\Itens::catalogo()['itens'])->where('tipo', 'item')->values();
        $this->assertCount(count($fixture), $catalogo);
        foreach ($catalogo as $i => $entrada) {
            $php = \App\Sistemas\OnePiece\Itens::paraAMesa($entrada);
            $ts = $fixture[$i];
            $this->assertSame($ts['nome'], $php['nome']);
            $this->assertSame($ts['descricao'], $php['descricao'], $entrada['id']);
            $this->assertEquals($ts['dados'], $php['dados'], $entrada['id']);
            $this->assertEquals((float) $ts['peso'], $php['peso'], $entrada['id']);
        }
    }

    public function test_a_pagina_do_jogo_manda_a_loja_so_a_quem_ela_foi_aberta(): void
    {
        $c = $this->cenario();
        $this->como($c->mestre)->postJson(route('jogo.loja.abrir', $c->mesa->id), ['jogadores' => [$c->ana->id], 'categorias' => ['kits']])->assertOk();
        $this->como($c->ana)->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->assertInertia(fn ($p) => $p->where('lojaDoJogador.categorias', ['kits'])->where('lojasAbertas', []));
        $this->como($c->bia)->get(route('jogo', [$c->mesa->slug, $c->bia->id]))->assertInertia(fn ($p) => $p->where('lojaDoJogador', null));
        $this->como($c->mestre)->get(route('jogo', [$c->mesa->slug, $c->mestre->id]))->assertInertia(fn ($p) => $p->has('lojasAbertas', 1)->where('lojaDoJogador', null));
    }
}
