<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\FichaOnePiece;
use App\Sistemas\OnePiece\Itens;
use App\Sistemas\OnePiece\Municoes;
use App\Nucleo\Loja\LojaService;
use App\Sistemas\OnePiece\OnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Armas por munição (pistola, mosquete, canhão, arco, zarabatana): escolhe-se a munição ao atacar; ela dá o dano e gasta 1 unidade. */
class MunicaoTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(): object
    {
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
        $p = $mesa->personagens()->create(['nome' => 'Atirador', 'cor' => '#0ea5e9']);
        $p->jogadores()->attach($ana);
        $loja = app(LojaService::class);
        $sistema = new OnePiece;
        $item = fn (string $id) => $loja->materializar($mesa, $sistema, Itens::item($id));
        $pistola = $item('pistola');
        $mosq = $item('mosquete');
        $esferica = $item('municao-esferica');
        $perfurante = $item('municao-perfurante');
        $flecha = $item('flecha');
        $f = FichaOnePiece::padrao();
        $f['inventario'] = [['secao' => 'Equipamento', 'itens' => [
            ['item_id' => $pistola->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false],
            ['item_id' => $mosq->id, 'qtd' => 1, 'equipado' => false, 'sintonizado' => false],
            ['item_id' => $esferica->id, 'qtd' => 2, 'equipado' => false, 'sintonizado' => false],
            ['item_id' => $perfurante->id, 'qtd' => 1, 'equipado' => false, 'sintonizado' => false],
            ['item_id' => $flecha->id, 'qtd' => 5, 'equipado' => false, 'sintonizado' => false],
        ]]];
        $p->ficha = $f;
        $p->save();

        return (object) compact('mesa', 'mestre', 'ana', 'p', 'pistola', 'mosq', 'esferica', 'perfurante', 'flecha');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    private function atacar($c, $arma, ?int $municao)
    {
        return $this->como($c->ana)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => "1d20+@arma.{$arma->id}.ataque", 'rotulo' => 'Tiro', 'visibilidade' => 'todos', 'personagem_id' => $c->p->id,
            ...($municao ? ['municao_item_id' => $municao] : []),
        ]);
    }

    private function qtd($c, int $itemId): int
    {
        foreach ($c->p->fresh()->ficha['inventario'] as $secao) {
            foreach ($secao['itens'] as $ref) {
                if ($ref['item_id'] === $itemId) {
                    return $ref['qtd'];
                }
            }
        }

        return 0;
    }

    public function test_a_arma_de_fogo_do_catalogo_vira_arma_por_municao_na_mesa(): void
    {
        $c = $this->cenario();
        $arma = $c->pistola->dados['arma'];
        $this->assertTrue($arma['municao']);
        $this->assertTrue($arma['distancia']);
        $this->assertEquals(['des', 9, 15], [$arma['atributo'], $arma['alcanceNormal'], $arma['alcanceMaximo']]);
        $this->assertArrayNotHasKey('dano', $arma);
    }

    public function test_o_ataque_exige_a_municao_e_ela_dita_o_dano_e_gasta_uma_unidade(): void
    {
        $c = $this->cenario();
        $this->atacar($c, $c->pistola, null)->assertStatus(422)->assertJsonValidationErrors('municao_item_id'); // sem escolher a munição
        $this->assertSame(2, $this->qtd($c, $c->esferica->id)); // nada gasto

        $r = $this->atacar($c, $c->pistola, $c->esferica->id)->assertCreated()->json();
        $sis = $r['dados']['sistema'];
        $this->assertSame('Munição Esférica', $sis['municao']['nome']);
        $acao = $sis['acoes'][0] ?? null;
        if ($acao) { // 1 natural não oferece dano
            $this->assertMatchesRegularExpression('/^\d+d8\+/', $acao['expressao']); // 1d8 (ou 2d8 no crítico) da munição + o bônus
            $this->assertSame('Contundente', $acao['dano']['tipo']); // o tipo vem da munição
        }
        $this->assertSame(1, $this->qtd($c, $c->esferica->id)); // gastou 1

        $r = $this->atacar($c, $c->pistola, $c->perfurante->id)->assertCreated()->json();
        $this->assertSame(0, $this->qtd($c, $c->perfurante->id)); // a última: a linha some
        if ($acao = $r['dados']['sistema']['acoes'][0] ?? null) {
            $this->assertSame('Perfurante', $acao['dano']['tipo']);
        }
        $this->atacar($c, $c->pistola, $c->perfurante->id)->assertStatus(422); // acabou
    }

    public function test_so_serve_a_municao_do_nome_certo_e_que_o_jogador_tem(): void
    {
        $c = $this->cenario();
        $this->atacar($c, $c->pistola, $c->flecha->id)->assertStatus(422)->assertJsonValidationErrors('municao_item_id'); // flecha é do arco
        $this->atacar($c, $c->pistola, $c->pistola->id)->assertStatus(422); // arma não é munição
        $this->atacar($c, $c->pistola, 999999)->assertStatus(422);          // não existe
        $this->assertSame(5, $this->qtd($c, $c->flecha->id));
        $this->atacar($c, $c->mosq, $c->esferica->id)->assertStatus(422);   // o mosquete não está equipado: sem variável de ataque (a rolagem falha antes de gastar)
        $this->assertSame(2, $this->qtd($c, $c->esferica->id));
    }

    public function test_o_mapa_de_municoes_confere_com_o_catalogo(): void
    {
        $this->assertSame(['municao-esferica', 'municao-perfurante', 'municao-de-kairoseki'], Municoes::daArma('pistola'));
        $this->assertSame(Municoes::daArma('pistola'), Municoes::daArma('mosquete'));
        $this->assertSame(['bola-de-chumbo', 'bola-explosiva'], Municoes::daArma('canhao'));
        $this->assertSame(['flecha'], Municoes::daArma('arco'));
        $this->assertSame(['dardo'], Municoes::daArma('zarabatana'));
        $this->assertSame([], Municoes::daArma('espada')); // arma do catálogo sem munição
        $this->assertContains('flecha', Municoes::daArma(null)); // arma criada à mão aceita qualquer munição
        foreach (Municoes::mapa() as $arma => $municoes) {
            $this->assertNotNull(Itens::item($arma), $arma);
            foreach ($municoes as $m) {
                $this->assertSame('municao', Itens::item($m)['categoria'], $m);
                $this->assertIsString(Itens::item($m)['arma']['dano'], $m);
            }
        }
    }
}
