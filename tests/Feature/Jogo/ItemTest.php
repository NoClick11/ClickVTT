<?php

namespace Tests\Feature\Jogo;

use App\Events\EventoMesa;
use App\Models\Item;
use App\Models\Jogador;
use App\Models\Personagem;
use App\Models\Sistema;
use App\Models\User;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Sistemas\Dnd5e\FichaDnd5e;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class ItemTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(string $sistema = 'dnd-5e'): object
    {
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', $sistema)->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $bia = $mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $aria->jogadores()->attach($ana);
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);

        return (object) compact('mesa', 'mestre', 'ana', 'bia', 'aria');
    }

    private function como(Jogador $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => [$p->id => true]]])->withHeader('X-Jogador', (string) $p->id);
    }

    private function corpo(array $extra = []): array
    {
        return $extra + ['nome' => 'Anel de Proteção', 'descricao' => 'Brilha de leve.', 'peso' => 0.1, 'equipavel' => true, 'requer_sintonia' => true,
            'efeitos' => [['alvo' => 'ca', 'modo' => 'soma', 'valor' => 1]]];
    }

    private function entregar($c, Jogador $quem, Item $item, int $qtd = 1, ?Personagem $para = null)
    {
        $p = $para ?? $c->aria;
        $atual = $p->fresh()->ficha['inventario'] ?? [];
        $atual[] = ['secao' => 'Equipamento', 'itens' => [['item_id' => $item->id, 'qtd' => $qtd, 'equipado' => false, 'sintonizado' => false]]];

        return $this->como($quem)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $p->id]), ['campos' => ['inventario' => $atual]]);
    }

    public function test_mestre_cria_item_com_efeitos_normalizados(): void
    {
        $c = $this->cenario();
        $r = $this->como($c->mestre)->postJson(route('jogo.itens.store', $c->mesa->id), $this->corpo([
            'nome' => '  Anel  ', 'efeitos' => [['alvo' => 'ca', 'modo' => 'soma', 'valor' => 1, 'lixo' => 'x'], ['alvo' => 'pericia.*', 'modo' => 'vantagem', 'valor' => 5], ['alvo' => 'ca', 'modo' => 'base', 'valor' => ' 14+min(@mod.des,2) ']],
        ]))->assertCreated()->json();

        $this->assertSame('Anel', $r['nome']);
        $this->assertSame([['alvo' => 'ca', 'modo' => 'soma', 'valor' => 1], ['alvo' => 'pericia.*', 'modo' => 'vantagem'], ['alvo' => 'ca', 'modo' => 'base', 'valor' => '14+min(@mod.des,2)']], $r['efeitos']);
        $this->assertSame($c->mesa->id, Item::findOrFail($r['id'])->mesa_id);
    }

    public function test_jogador_nao_cria_edita_nem_exclui_item(): void
    {
        $c = $this->cenario();
        $item = $c->mesa->itens()->create(['nome' => 'Espada', 'peso' => 3]);

        $this->como($c->ana)->postJson(route('jogo.itens.store', $c->mesa->id), $this->corpo())->assertForbidden();
        $this->como($c->ana)->patchJson(route('jogo.itens.update', [$c->mesa->id, $item->id]), ['nome' => 'Outra'])->assertForbidden();
        $this->como($c->ana)->deleteJson(route('jogo.itens.destroy', [$c->mesa->id, $item->id]))->assertForbidden();

        $this->assertSame('Espada', $item->fresh()->nome);
    }

    public function test_validacao_do_item(): void
    {
        $c = $this->cenario();
        $post = fn (array $extra) => $this->como($c->mestre)->postJson(route('jogo.itens.store', $c->mesa->id), $this->corpo($extra));

        $post(['nome' => ''])->assertStatus(422)->assertJsonValidationErrors('nome');
        $post(['peso' => -1])->assertStatus(422)->assertJsonValidationErrors('peso');
        $post(['efeitos' => [['alvo' => 'mana', 'modo' => 'soma', 'valor' => 1]]])->assertStatus(422); // alvo que o sistema não tem
        $post(['efeitos' => [['alvo' => 'ca', 'modo' => 'soma', 'valor' => '2d6']]])->assertStatus(422); // fórmula sem dados
        $post(['efeitos' => [['alvo' => 'ca', 'modo' => 'multiplica', 'valor' => 2]]])->assertStatus(422);
        $post(['efeitos' => array_fill(0, 31, ['alvo' => 'ca', 'modo' => 'soma', 'valor' => 1])])->assertStatus(422);
        $this->assertSame(0, $c->mesa->itens()->count());
    }

    public function test_dados_de_armadura_e_arma_sao_guardados_e_o_resto_e_descartado(): void
    {
        $c = $this->cenario();
        $post = fn (array $dados) => $this->como($c->mestre)->postJson(route('jogo.itens.store', $c->mesa->id), $this->corpo(['efeitos' => []]) + ['dados' => $dados]);

        $r = $post(['armadura' => ['tipo' => 'media', 'base' => 14, 'lixo' => 1], 'xyz' => ['a' => 1]])->assertCreated()->json();
        $this->assertSame(['armadura' => ['tipo' => 'media', 'base' => 14]], $r['dados']); // só o que o sistema declarou

        $r = $post(['arma' => ['dano' => '1d8', 'atributo' => 'acuidade', 'tipoDano' => 'cortante', 'proficiente' => true, 'bonusMagico' => 1, 'margemCritica' => 19]])->assertCreated()->json();
        $this->assertSame('1d8', $r['dados']['arma']['dano']);
        $this->assertSame(19, $r['dados']['arma']['margemCritica']);
        $this->assertSame(1, $r['dados']['arma']['bonusMagico']);

        $this->assertNull($post(['xyz' => 1])->assertCreated()->json('dados'));
    }

    public function test_validacao_de_armadura_e_arma(): void
    {
        $c = $this->cenario();
        $post = fn (array $dados) => $this->como($c->mestre)->postJson(route('jogo.itens.store', $c->mesa->id), $this->corpo(['efeitos' => []]) + ['dados' => $dados]);

        $post(['armadura' => ['tipo' => 'mithril', 'base' => 14]])->assertStatus(422);
        $post(['armadura' => ['tipo' => 'leve', 'base' => 31]])->assertStatus(422);
        $post(['armadura' => ['tipo' => 'leve', 'base' => '14']])->assertStatus(422);
        $post(['armadura' => ['tipo' => 'leve']])->assertStatus(422);              // falta a base
        $post(['arma' => ['dano' => '1d8']])->assertStatus(422);                    // falta o atributo
        $post(['arma' => ['dano' => '1d1', 'atributo' => 'for']])->assertStatus(422);
        $post(['arma' => ['dano' => '1d8+5', 'atributo' => 'for']])->assertStatus(422);
        $post(['arma' => ['dano' => '51d6', 'atributo' => 'for']])->assertStatus(422); // dobrado no crítico passaria de 100 dados
        $post(['arma' => ['dano' => '50d6', 'atributo' => 'for']])->assertCreated();
        $post(['arma' => ['dano' => 'abc', 'atributo' => 'for']])->assertStatus(422);
        $post(['arma' => ['dano' => '1d8', 'atributo' => 'mag']])->assertStatus(422);
        $post(['arma' => ['dano' => '1d8', 'atributo' => 'for', 'bonusMagico' => 11]])->assertStatus(422);
        $post(['arma' => ['dano' => '1d8', 'atributo' => 'for', 'margemCritica' => 21]])->assertStatus(422);
        $post(['arma' => ['dano' => '1d8', 'atributo' => 'for', 'margemCritica' => 9]])->assertStatus(422);
        $post(['arma' => ['dano' => '1d8', 'atributo' => 'for', 'margemCritica' => '19']])->assertStatus(422);
        $this->assertSame(1, $c->mesa->itens()->count()); // só a de 50d6 foi aceita
    }

    public function test_arma_aceita_qualquer_atributo_ou_acuidade(): void
    {
        $c = $this->cenario();
        $post = fn (string $atributo) => $this->como($c->mestre)->postJson(route('jogo.itens.store', $c->mesa->id), $this->corpo(['efeitos' => []]) + ['dados' => ['arma' => ['dano' => '1d8', 'atributo' => $atributo]]]);

        foreach (['for', 'des', 'con', 'int', 'sab', 'car', 'acuidade'] as $atributo) {
            $this->assertSame($atributo, $post($atributo)->assertCreated()->json('dados.arma.atributo'), $atributo);
        }
        $post('mag')->assertStatus(422);
        $post('Sabedoria')->assertStatus(422); // o id do atributo, não o nome
        $post('')->assertStatus(422);
    }

    public function test_bonus_de_acerto_e_de_dano_sao_inteiros_separados(): void
    {
        $c = $this->cenario();
        $post = fn (array $arma) => $this->como($c->mestre)->postJson(route('jogo.itens.store', $c->mesa->id), $this->corpo(['efeitos' => []]) + ['dados' => ['arma' => $arma + ['dano' => '1d8', 'atributo' => 'for']]]);

        $r = $post(['bonusAtaque' => 2, 'bonusDano' => 3])->assertCreated()->json('dados.arma');
        $this->assertSame([2, 3], [$r['bonusAtaque'], $r['bonusDano']]);

        $this->assertSame(0, $post(['bonusAtaque' => 0, 'bonusDano' => 0])->assertCreated()->json('dados.arma.bonusAtaque'));
        $this->assertSame(-2, $post(['bonusDano' => -2])->assertCreated()->json('dados.arma.bonusDano'));
        $this->assertSame(20, $post(['bonusAtaque' => 20])->assertCreated()->json('dados.arma.bonusAtaque'));
        $this->assertSame(1, $post(['bonusMagico' => 1])->assertCreated()->json('dados.arma.bonusMagico')); // formato antigo ainda aceito

        $post(['bonusAtaque' => 21])->assertStatus(422);
        $post(['bonusDano' => -11])->assertStatus(422);
        $post(['bonusAtaque' => '2'])->assertStatus(422);   // texto, não número
        $post(['bonusDano' => 1.5])->assertStatus(422);     // inteiro
    }

    public function test_dados_extras_da_arma(): void
    {
        $c = $this->cenario();
        $post = fn (array $extras) => $this->como($c->mestre)->postJson(route('jogo.itens.store', $c->mesa->id), $this->corpo(['efeitos' => []]) + ['dados' => ['arma' => ['dano' => '1d8', 'atributo' => 'for', 'danoExtra' => $extras]]]);

        $r = $post([['dados' => '2d6', 'tipo' => 'fogo', 'lixo' => 1], ['dados' => '1d4']])->assertCreated()->json('dados.arma.danoExtra');
        $this->assertSame([['dados' => '2d6', 'tipo' => 'fogo'], ['dados' => '1d4']], $r); // só o declarado é guardado

        $post([['dados' => '1d6'], ['dados' => '1d6'], ['dados' => '1d6']])->assertCreated();   // até 3
        $post([['dados' => '1d6'], ['dados' => '1d6'], ['dados' => '1d6'], ['dados' => '1d6']])->assertStatus(422); // 4 não
        $post([['dados' => '21d6']])->assertStatus(422);
        $post([['dados' => '2d6+3']])->assertStatus(422);   // modificador vai no bônus fixo
        $post([['dados' => '1d1']])->assertStatus(422);
        $post([['dados' => 2]])->assertStatus(422);
        $post([['tipo' => 'fogo']])->assertStatus(422);     // sem os dados
    }

    public function test_atributo_do_dano_e_separado_do_do_ataque(): void
    {
        $c = $this->cenario();
        $post = fn (array $arma) => $this->como($c->mestre)->postJson(route('jogo.itens.store', $c->mesa->id), $this->corpo(['efeitos' => []]) + ['dados' => ['arma' => $arma + ['dano' => '1d8', 'atributo' => 'car']]]);

        $r = $post(['atributoDano' => 'for'])->assertCreated()->json('dados.arma');
        $this->assertSame(['car', 'for'], [$r['atributo'], $r['atributoDano']]);

        foreach (['for', 'des', 'con', 'int', 'sab', 'car', 'acuidade', 'nenhum'] as $valor) {
            $this->assertSame($valor, $post(['atributoDano' => $valor])->assertCreated()->json('dados.arma.atributoDano'), $valor);
        }
        $this->assertArrayNotHasKey('atributoDano', $post([])->assertCreated()->json('dados.arma')); // sem o campo: o dano usa o do ataque
        $this->assertNull($post(['atributoDano' => null])->assertCreated()->json('dados.arma.atributoDano')); // nulo vale como "igual ao ataque"
        $post(['atributoDano' => 'mag'])->assertStatus(422);
        $post(['atributoDano' => 'Força'])->assertStatus(422);
    }

    public function test_so_tres_itens_podem_ficar_sintonizados(): void
    {
        $c = $this->cenario();
        $refs = fn (int $n) => array_map(fn ($i) => ['item_id' => $c->mesa->itens()->create(['nome' => "Anel {$i}", 'peso' => 0])->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => true], range(1, $n));
        $url = route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]);

        $this->como($c->mestre)->patchJson($url, ['campos' => ['inventario' => [['secao' => 'A', 'itens' => $refs(3)]]]])->assertOk();
        $this->como($c->mestre)->patchJson($url, ['campos' => ['inventario' => [['secao' => 'A', 'itens' => $refs(2)], ['secao' => 'B', 'itens' => $refs(2)]]]])
            ->assertStatus(422)->assertJsonValidationErrors('campos.inventario');
    }

    public function test_edicao_parcial_so_muda_o_enviado(): void
    {
        $c = $this->cenario();
        $item = $c->mesa->itens()->create($this->corpo());

        $this->como($c->mestre)->patchJson(route('jogo.itens.update', [$c->mesa->id, $item->id]), ['peso' => 2.5])->assertOk();

        $item->refresh();
        $this->assertSame(2.5, $item->peso);
        $this->assertSame('Anel de Proteção', $item->nome);
        $this->assertSame([['alvo' => 'ca', 'modo' => 'soma', 'valor' => 1]], $item->efeitos);
    }

    public function test_item_de_outra_mesa_e_404(): void
    {
        $c = $this->cenario();
        $outra = $this->cenario();
        $dela = $outra->mesa->itens()->create(['nome' => 'X', 'peso' => 1]);

        $this->como($c->mestre)->patchJson(route('jogo.itens.update', [$c->mesa->id, $dela->id]), ['nome' => 'Y'])->assertNotFound();
        $this->como($c->mestre)->deleteJson(route('jogo.itens.destroy', [$c->mesa->id, $dela->id]))->assertNotFound();
    }

    public function test_mestre_entrega_item_e_jogador_nao_se_serve_sozinho(): void
    {
        $c = $this->cenario();
        $anel = $c->mesa->itens()->create($this->corpo());

        $this->entregar($c, $c->ana, $anel)->assertStatus(422)->assertJsonValidationErrors('campos.inventario');
        $this->assertNull($c->aria->fresh()->ficha);

        $this->entregar($c, $c->mestre, $anel)->assertOk();
        $this->assertSame($anel->id, $c->aria->fresh()->ficha['inventario'][0]['itens'][0]['item_id']);
    }

    public function test_mestre_nao_entrega_item_que_nao_existe_ou_e_de_outra_mesa(): void
    {
        $c = $this->cenario();
        $outra = $this->cenario();
        $dela = $outra->mesa->itens()->create(['nome' => 'X', 'peso' => 1]);

        $this->entregar($c, $c->mestre, $dela)->assertStatus(422)->assertJsonValidationErrors('campos.inventario');
        $this->assertNull($c->aria->fresh()->ficha);
    }

    public function test_jogador_equipa_muda_quantidade_e_tira_mas_nao_acrescenta(): void
    {
        $c = $this->cenario();
        $anel = $c->mesa->itens()->create($this->corpo());
        $pocao = $c->mesa->itens()->create(['nome' => 'Poção', 'peso' => 0.25]);
        $this->entregar($c, $c->mestre, $anel)->assertOk();

        $inv = fn (array $itens) => ['campos' => ['inventario' => [['secao' => 'Equipamento', 'itens' => $itens]]]];
        $url = route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]);

        $this->como($c->ana)->patchJson($url, $inv([['item_id' => $anel->id, 'qtd' => 3, 'equipado' => true, 'sintonizado' => true]]))->assertOk();
        $ref = $c->aria->fresh()->ficha['inventario'][0]['itens'][0];
        $this->assertSame([3, true, true], [$ref['qtd'], $ref['equipado'], $ref['sintonizado']]);

        $this->como($c->ana)->patchJson($url, $inv([['item_id' => $anel->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => true], ['item_id' => $pocao->id, 'qtd' => 1, 'equipado' => false, 'sintonizado' => false]]))->assertStatus(422);
        $this->como($c->ana)->patchJson($url, $inv([]))->assertOk(); // tirar vale
        $this->assertSame([], $c->aria->fresh()->ficha['inventario'][0]['itens']);
    }

    public function test_excluir_o_item_tira_das_fichas_e_avisa_a_mesa(): void
    {
        $c = $this->cenario();
        $anel = $c->mesa->itens()->create($this->corpo());
        $this->entregar($c, $c->mestre, $anel, 2)->assertOk();

        Event::fake([EventoMesa::class]);
        $this->como($c->mestre)->deleteJson(route('jogo.itens.destroy', [$c->mesa->id, $anel->id]))->assertOk();

        $this->assertNull(Item::find($anel->id));
        $this->assertSame([], $c->aria->fresh()->ficha['inventario'][0]['itens']);
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->nome === 'cena' && $e->canais === ['mesa']);
    }

    public function test_jogo_envia_ao_jogador_so_os_itens_das_proprias_fichas(): void
    {
        $c = $this->cenario();
        $anel = $c->mesa->itens()->create($this->corpo());
        $espada = $c->mesa->itens()->create(['nome' => 'Espada Secreta', 'peso' => 3]);
        $this->entregar($c, $c->mestre, $anel)->assertOk();

        $itens = fn (Jogador $p) => collect($this->como($p)->get(route('jogo', [$c->mesa->slug, $p->id]))->viewData('page')['props']['itens'])->pluck('nome')->sort()->values()->all();

        $this->assertSame(['Anel de Proteção', 'Espada Secreta'], $itens($c->mestre)); // o mestre vê todos
        $this->assertSame(['Anel de Proteção'], $itens($c->ana));                       // dona da ficha
        $this->assertSame([], $itens($c->bia));                                         // não controla ninguém com itens
        unset($espada);
    }

    public function test_peso_da_carga_vem_do_item_e_item_removido_nao_pesa(): void
    {
        $c = $this->cenario();
        $maca = $c->mesa->itens()->create(['nome' => 'Maça', 'peso' => 2]);
        $c->aria->forceFill(['ficha' => array_replace(FichaDnd5e::padrao(), ['inventario' => [['secao' => 'A', 'itens' => [
            ['item_id' => $maca->id, 'qtd' => 3, 'equipado' => false, 'sintonizado' => false],
            ['item_id' => 99999, 'qtd' => 5, 'equipado' => false, 'sintonizado' => false],
        ]]]])])->save();

        $variaveis = app(RegistroSistemas::class)->resolver('dnd-5e')
            ->variaveisDeRolagem($c->aria->ficha, [$maca->id => $maca->paraFront()]);

        $this->assertEquals(6, $variaveis['carga.atual']);
    }

    public function test_migracao_converte_o_inventario_antigo_em_itens(): void
    {
        $this->artisan('migrate:rollback', ['--path' => 'database/migrations/2026_11_07_110000_converte_inventario_em_itens.php'])->assertExitCode(0);
        $c = $this->cenario();
        $outra = $this->cenario();
        $antigo = fn ($mesa, $ficha) => DB::table('personagens')->insertGetId(['mesa_id' => $mesa->id, 'nome' => 'P'.uniqid(), 'cor' => '#fff', 'ficha' => json_encode($ficha), 'created_at' => now(), 'updated_at' => now()]);
        $inv = [['secao' => 'Armas', 'itens' => [['nome' => 'Maça', 'qtd' => 2, 'peso' => 2, 'equipado' => true, 'detalhe' => '1d6'], ['nome' => 'Poção', 'qtd' => 1, 'peso' => 0.25]]]];
        $a = $antigo($c->mesa, ['classe' => 'Clérigo', 'inventario' => $inv]);
        $b = $antigo($c->mesa, ['inventario' => [['secao' => 'X', 'itens' => [['nome' => 'Maça', 'qtd' => 1, 'peso' => 2, 'detalhe' => '1d6']]]]]);
        $d = $antigo($outra->mesa, ['inventario' => [['secao' => 'X', 'itens' => [['nome' => 'Maça', 'qtd' => 1, 'peso' => 2, 'detalhe' => '1d6']]]]]);

        $this->artisan('migrate')->assertExitCode(0);

        $ficha = fn ($id) => json_decode(DB::table('personagens')->where('id', $id)->value('ficha'), true);
        $refA = $ficha($a)['inventario'][0]['itens'];
        $this->assertSame('Clérigo', $ficha($a)['classe']);                                    // o resto da ficha fica intacto
        $this->assertSame([2, true, false], [$refA[0]['qtd'], $refA[0]['equipado'], $refA[0]['sintonizado']]);
        $this->assertArrayNotHasKey('nome', $refA[0]);
        $maca = Item::findOrFail($refA[0]['item_id']);
        $this->assertSame(['Maça', '1d6', 2.0, $c->mesa->id], [$maca->nome, $maca->descricao, $maca->peso, $maca->mesa_id]);
        $this->assertSame($maca->id, $ficha($b)['inventario'][0]['itens'][0]['item_id']);      // mesma Maça na mesma mesa = um só item
        $this->assertNotSame($maca->id, $ficha($d)['inventario'][0]['itens'][0]['item_id']);  // outra mesa, outro item
        $this->assertSame(3, Item::count());
        $this->assertSame(0.25, Item::where('nome', 'Poção')->first()->peso);
    }

    public function test_toda_arma_precisa_do_alcance_normal_e_maximo(): void
    {
        $c = $this->cenario('one-piece');
        $corpo = fn (array $arma) => [
            'nome' => 'Espingarda', 'peso' => 3, 'equipavel' => true, 'requer_sintonia' => false,
            'dados' => ['arma' => ['dano' => '1d8', 'atributo' => 'des', 'tipoDano' => 'Perfurante', 'distancia' => true, ...$arma]],
        ];
        $criar = fn (array $arma) => $this->como($c->mestre)->postJson(route('jogo.itens.store', $c->mesa->id), $corpo($arma));
        $criar([])->assertStatus(422)->assertJsonValidationErrors(['dados.arma.alcanceNormal', 'dados.arma.alcanceMaximo']); // sem alcance
        $criar(['alcanceNormal' => 18])->assertStatus(422)->assertJsonValidationErrors('dados.arma.alcanceMaximo');
        $criar(['alcanceNormal' => 24, 'alcanceMaximo' => 18])->assertStatus(422)->assertJsonValidationErrors('dados.arma.alcanceMaximo'); // máximo < normal
        $criar(['alcanceNormal' => 0, 'alcanceMaximo' => 18])->assertStatus(422)->assertJsonValidationErrors('dados.arma.alcanceNormal');
        $criar(['alcanceNormal' => 18, 'alcanceMaximo' => 24])->assertCreated();
    }
}
