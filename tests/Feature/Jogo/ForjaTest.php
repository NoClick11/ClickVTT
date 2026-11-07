<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\Ferreiro;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** A forja: itens com Meito/Yoto/Expertise, Pontos de Forja do ferreiro, criar do catálogo gastando lingote e aprimorar a arma de outro. */
class ForjaTest extends TestCase
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
        $ferr = $mesa->personagens()->create(['nome' => 'Ferreira', 'cor' => '#0ea5e9']);
        $ferr->jogadores()->attach($ana);
        $guerr = $mesa->personagens()->create(['nome' => 'Guerreiro', 'cor' => '#ef4444']);
        $guerr->jogadores()->attach($bia);
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);

        return (object) compact('mesa', 'mestre', 'ana', 'bia', 'ferr', 'guerr');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    /** Deixa a Ferreira com a profissão, o dinheiro, um lingote e PF; o Guerreiro com uma katana. */
    private function preparar($c, int $pf = 10, int $belly = 500000): array
    {
        $lingote = $c->mesa->itens()->create(['catalogo_id' => 'lingote-de-metal', 'nome' => 'Lingote de Metal', 'peso' => 1, 'equipavel' => false]);
        $katana = $c->mesa->itens()->create([
            'nome' => 'Katana', 'peso' => 1.2, 'equipavel' => true, 'catalogo_id' => 'katana',
            'dados' => ['arma' => ['dano' => '1d6', 'atributo' => 'acuidade', 'tipoDano' => 'Cortante', 'proficiente' => true]],
        ]);
        $f = FichaOnePiece::padrao();
        $f['belly'] = $belly;
        $f['atributos'] = ['for' => 30, 'des' => 30, 'con' => 10, 'sab' => 30, 'pre' => 10, 'von' => 10]; // o Teste (CD 16) passa sempre
        $f['profissoes'] = ['semProfissao' => false, 'livroLido' => false, 'usados' => [], 'lista' => [['id' => 'ferreiro', 'graduacao' => 0, 'nivel' => 1]]];
        $f['forja'] = ['idade' => 0, 'laminas' => 0, 'extras' => $pf, 'gastos' => 0];
        $f['inventario'] = [['secao' => 'Equipamento', 'itens' => [['item_id' => $lingote->id, 'qtd' => 3, 'equipado' => false, 'sintonizado' => false]]]];
        $c->ferr->ficha = $f;
        $c->ferr->save();
        $g = FichaOnePiece::padrao();
        $g['inventario'] = [['secao' => 'Equipamento', 'itens' => [['item_id' => $katana->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false]]]];
        $c->guerr->ficha = $g;
        $c->guerr->save();

        return [$lingote, $katana];
    }

    public function test_item_com_forja_so_aceita_combinacoes_do_livro(): void
    {
        $c = $this->cenario();
        $corpo = fn (array $forja, string $tipo = 'Cortante') => [
            'nome' => 'Lâmina', 'categoria' => 'armas-cortantes', 'raridade' => 'raro', 'preco' => 1, 'peso' => 1, 'equipavel' => true, 'requer_sintonia' => false,
            'dados' => ['arma' => ['dano' => '1d6', 'atributo' => 'for', 'tipoDano' => $tipo, 'forja' => $forja]],
        ];
        $url = route('jogo.catalogo.store', $c->mesa->id);
        $this->como($c->mestre)->postJson($url, $corpo(['meito' => 'o-wazamono', 'yoto' => 'azar-mortal', 'expertise' => ['maximizar', 'caido'], 'densidade' => 'cortante', 'balanco' => true, 'fio' => 2, 'dureza' => true]))
            ->assertCreated()->assertJsonPath('dados.arma.forja.meito', 'o-wazamono')->assertJsonPath('dados.arma.forja.fio', 2);
        $this->como($c->mestre)->postJson($url, $corpo(['kokuto' => true]))->assertStatus(422);              // Kokuto sem Meito
        $this->como($c->mestre)->postJson($url, $corpo(['yoto' => 'azar-mortal']))->assertStatus(422);       // Yoto sem Meito
        $this->como($c->mestre)->postJson($url, $corpo(['balanco' => true]))->assertStatus(422);             // Balanço sem Densidade
        $this->como($c->mestre)->postJson($url, $corpo(['meito' => 'wazamono'], 'Contundente'))->assertStatus(422); // Meito só cortante
        $this->como($c->mestre)->postJson($url, $corpo(['expertise' => ['caido', 'sangramento', 'impedido']]))->assertStatus(422);
        $this->como($c->mestre)->postJson($url, $corpo(['meito' => 'inventada']))->assertStatus(422);
    }

    public function test_so_o_mestre_mexe_nos_pontos_de_forja(): void
    {
        $c = $this->cenario();
        $this->preparar($c, 0);
        $this->como($c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->ferr->id]), ['campos' => ['forja.extras' => 50]])->assertForbidden();
        $this->como($c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->ferr->id]), ['campos' => ['forja.gastos' => -10]])->assertForbidden();
        $this->como($c->mestre)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->ferr->id]), ['campos' => ['forja.extras' => 4, 'forja.idade' => 35, 'forja.laminas' => 12]])->assertOk();
        $pf = Ferreiro::pontos($c->ferr->fresh()->ficha);
        $this->assertSame(4 + 3 + 1, $pf['ganhos']); // extras + idade/10 + laminas/10
    }

    public function test_pontos_de_forja_por_idade_laminas_e_graduacao(): void
    {
        $f = ['forja' => ['idade' => 47, 'laminas' => 25, 'extras' => 1, 'gastos' => 2], 'profissoes' => ['lista' => [['id' => 'ferreiro', 'graduacao' => 2]]]];
        $pf = Ferreiro::pontos($f);
        $this->assertSame(4 + 2 + 4 + 1, $pf['ganhos']);
        $this->assertSame(9, $pf['disponiveis']);
        $this->assertSame(14, Ferreiro::cd($f));
        $this->assertNull(Ferreiro::profissao(['profissoes' => ['semProfissao' => true, 'lista' => [['id' => 'ferreiro']]]]));
    }

    public function test_ferreiro_cria_arma_do_catalogo_gastando_lingote_e_belly(): void
    {
        $c = $this->cenario();
        $this->preparar($c);
        $criar = fn ($j, $p, string $item = 'katana') => $this->como($j)->postJson(route('jogo.forja.criar', $c->mesa->id), ['ferreiro_id' => $p->id, 'item' => $item, 'atributo' => 'for']);
        $criar($c->bia, $c->ferr)->assertForbidden();                    // ficha de outro
        $criar($c->bia, $c->guerr)->assertStatus(422);                   // não é ferreiro
        $r = $criar($c->ana, $c->ferr)->assertOk();
        $this->assertTrue($r->json('sucesso'));
        $f = $c->ferr->fresh()->ficha;
        $this->assertSame(500000 - 20000, $f['belly']);                 // 20% de 70.000 = 14.000 < 20.000: vale o mínimo
        $itens = collect($f['inventario'][0]['itens']);
        $this->assertSame(2, $itens->firstWhere('item_id', $c->mesa->itens()->where('catalogo_id', 'lingote-de-metal')->value('id'))['qtd']); // gastou 1 lingote
        $katana = $c->mesa->itens()->where('catalogo_id', 'katana')->first(); // a mesma Katana do catálogo (um item por entrada)
        $this->assertSame(1, $itens->firstWhere('item_id', $katana->id)['qtd']);
        $this->assertSame(1, $f['forja']['laminas']);                    // lâmina comum produzida
        // sem lingote ou sem dinheiro, avisa
        $c->ferr->ficha = [...$f, 'belly' => 100];
        $c->ferr->save();
        $this->assertStringContainsString('Sem dinheiro', $criar($c->ana, $c->ferr)->assertStatus(422)->json('errors.dinheiro.0'));
        $semLingote = $c->ferr->fresh()->ficha;
        $semLingote['inventario'] = [];
        $semLingote['belly'] = 500000;
        $c->ferr->ficha = $semLingote;
        $c->ferr->save();
        $this->assertStringContainsString('Lingote', $criar($c->ana, $c->ferr)->assertStatus(422)->json('errors.materiais.0'));
    }

    public function test_ferreiro_aprimora_a_arma_de_outro_personagem_com_pf(): void
    {
        $c = $this->cenario();
        [, $katana] = $this->preparar($c, 12);
        $url = route('jogo.forja.aprimorar', $c->mesa->id);
        $corpo = fn (array $m, int $item = null) => ['ferreiro_id' => $c->ferr->id, 'alvo_id' => $c->guerr->id, 'item_id' => $item ?? $katana->id, 'melhorias' => $m];
        // lista as armas do outro
        $armas = $this->como($c->ana)->postJson(route('jogo.forja.armas', $c->mesa->id), ['personagem_id' => $c->guerr->id])->assertOk()->json('armas');
        $this->assertSame('Katana', $armas[0]['nome']);
        $this->como($c->bia)->postJson(route('jogo.forja.armas', $c->mesa->id), ['personagem_id' => $c->ferr->id])->assertForbidden(); // não é ferreiro
        // erros: PF, volta atrás, Meito em arma errada
        $this->como($c->ana)->postJson($url, $corpo(['meito' => 'saijo-o-wazamono', 'fio' => 2]))->assertStatus(422); // 10 + 4 = 14 > 12 PF
        $this->como($c->ana)->postJson($url, $corpo([]))->assertStatus(422);                                          // nada a melhorar
        $this->como($c->bia)->postJson($url, $corpo(['fio' => 1]))->assertForbidden();                                // o guerreiro não pode usar a forja da Ferreira
        // Meito Ô Wazamono (6 PF) + Fio (2 PF) + Densidade (1) = 9 PF
        $r = $this->como($c->ana)->postJson($url, $corpo(['meito' => 'o-wazamono', 'fio' => 1, 'densidade' => 'cortante', 'yoto' => 'azar-mortal']))->assertOk();
        $this->assertSame(6 + 2 + 1, $r->json('pf.gastos'));
        $this->assertSame(3, $r->json('pf.disponiveis'));
        $g = $c->guerr->fresh()->ficha;
        $novoId = $g['inventario'][0]['itens'][0]['item_id'];
        $this->assertNotSame($katana->id, $novoId);                       // virou a cópia forjada, no mesmo lugar
        $this->assertTrue($g['inventario'][0]['itens'][0]['equipado']);   // continua equipada
        $nova = $c->mesa->itens()->find($novoId);
        $this->assertSame('o-wazamono', $nova->dados['arma']['forja']['meito']);
        $this->assertSame(1, $nova->dados['arma']['forja']['fio']);
        $this->assertStringStartsWith('forjado:', $nova->catalogo_id);   // some da aba Itens do mestre
        $this->assertArrayNotHasKey('forja', $c->mesa->itens()->find($katana->id)->dados['arma']); // a original não muda
        // pagou 1 lingote e ฿ 20.000 (a katana valia 70.000 → 20% = 14.000)
        $f = $c->ferr->fresh()->ficha;
        $this->assertSame(500000 - 20000, $f['belly']);
        $this->assertSame(2, $f['inventario'][0]['itens'][0]['qtd']);
        // não se rebaixa nem tira melhoria
        $this->como($c->ana)->postJson($url, $corpo(['meito' => 'wazamono'], $novoId))->assertStatus(422);
        $this->como($c->ana)->postJson($url, $corpo(['fio' => 0], $novoId))->assertStatus(422);
        // sobe mais: Ô → Saijo Ô custa 4 PF (restam 3): falta
        $this->como($c->ana)->postJson($url, $corpo(['meito' => 'saijo-o-wazamono'], $novoId))->assertStatus(422);
    }
}
