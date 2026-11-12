<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Personagem;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\FichaOnePiece;
use App\Sistemas\OnePiece\Navios;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Navios (cap. 14): criação pelo mestre, obras pagas do tesouro, calendário, carga e tesouro compartilhados, PV com BR. */
class NavioTest extends TestCase
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
        $aria->ficha = [...FichaOnePiece::padrao(), 'belly' => 5_000_000];
        $aria->save();
        $aria->jogadores()->attach($ana);
        $beto = $mesa->personagens()->create(['nome' => 'Beto', 'cor' => '#ef4444']);
        $beto->ficha = FichaOnePiece::padrao();
        $beto->save();
        $beto->jogadores()->attach($bia);

        return (object) compact('mesa', 'mestre', 'ana', 'bia', 'aria', 'beto');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    private function navio($c, array $corpo = ['modelo' => 'medio']): int
    {
        return $this->como($c->mestre)->postJson(route('jogo.navios.store', [$c->mesa->id]), ['nome' => 'Merry'] + $corpo)->assertCreated()->json('id');
    }

    private function acao($c, Jogador $quem, int $navio, string $acao, array $dados = [])
    {
        return $this->como($quem)->postJson(route('jogo.navios.acao', [$c->mesa->id, $navio]), ['acao' => $acao] + $dados);
    }

    private function tempo($c, int $dia)
    {
        return $this->como($c->mestre)->patchJson(route('jogo.tempo.atualizar', [$c->mesa->id]), ['dia' => $dia, 'hora' => 8, 'minuto' => 0])->assertOk();
    }

    private function ficha(int $id): array
    {
        return Personagem::findOrFail($id)->ficha;
    }

    public function test_regras_do_php_conferem_com_os_casos_do_ts(): void
    {
        $dados = json_decode(file_get_contents(base_path('tests/paridade/navios-casos.json')), true);
        foreach ($dados['casos'] as $c) {
            $this->assertEquals($c['calculo'], Navios::calcular($c['navio'], $c['pv']), "{$c['nome']}: cálculo");
            $this->assertEquals($c['efetivo'], Navios::efetivo($c['navio']), "{$c['nome']}: efetivo");
            $this->assertSame($c['dano'], array_map(fn ($d) => Navios::dano($c['navio'], $d), [0, 7, 40]), "{$c['nome']}: dano");
            $this->assertEquals($c['conserto']['carpinteiro'], Navios::conserto($c['navio'], $c['pv'], 'carpinteiro'), "{$c['nome']}: carpinteiro");
            $this->assertEquals($c['conserto']['estaleiro'], Navios::conserto($c['navio'], $c['pv'], 'estaleiro'), "{$c['nome']}: estaleiro");
            foreach ($c['obras'] as $o) {
                $rotulo = "{$c['nome']}: {$o['grupo']}/{$o['tipo']}";
                $this->assertSame($o['problema'], Navios::problemaDaObra($c['navio'], $o['grupo'], $o['tipo']), $rotulo);
                $this->assertSame($o['comprar'], Navios::custoDaObra($c['navio'], $o['grupo'], $o['tipo'], 'comprar'), "{$rotulo} comprar");
                $this->assertSame($o['construir'], Navios::custoDaObra($c['navio'], $o['grupo'], $o['tipo'], 'construir'), "{$rotulo} construir");
            }
        }
        foreach ($dados['tripulacoes'] as $t) {
            $this->assertSame($t['problema'], Navios::problemaDaTripulacao($t['lista']));
        }
    }

    public function test_so_o_mestre_cria_e_todos_recebem_a_ficha_do_navio(): void
    {
        $c = $this->cenario();
        $this->como($c->ana)->postJson(route('jogo.navios.store', [$c->mesa->id]), ['nome' => 'X', 'modelo' => 'medio'])->assertForbidden();
        $id = $this->navio($c);
        $f = $this->ficha($id);
        $this->assertSame('carvalho', $f['navio']['madeira']['tipo']);
        $this->assertCount(2, $f['navio']['mastros']);
        $this->assertCount(3, $f['navio']['canhoes']);
        $this->assertSame(300, $f['pv']['atual']);
        $this->assertSame(8, $f['navio']['manutencao']['proxima_dia']);

        // em branco: tamanho e madeira
        $branco = $this->navio($c, ['tamanho' => 'grande', 'madeira' => 'adam']);
        $this->assertSame(500, $this->ficha($branco)['pv']['max']);

        // a jogadora recebe a ficha do navio (e não a do personagem alheio)
        $props = $this->como($c->ana)->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->assertOk()->viewData('page')['props'];
        $porId = collect($props['personagens'])->keyBy('id');
        $this->assertTrue($porId[$id]['navio']);
        $this->assertArrayHasKey('ficha', $porId[$id]);
        $this->assertArrayNotHasKey('ficha', $porId[$c->beto->id]);
        $this->assertNotContains($id, $props['meusPersonagens']);

        // jogador não altera o navio pelo PATCH da ficha
        $this->como($c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $id]), ['campos' => ['belly' => 999]])->assertForbidden();
    }

    public function test_jogador_constroi_pagando_do_tesouro_e_a_obra_fica_pronta_pelo_calendario(): void
    {
        $c = $this->cenario();
        $id = $this->navio($c);
        // sem dinheiro no tesouro
        $this->acao($c, $c->ana, $id, 'construir', ['grupo' => 'comodos', 'tipo' => 'cozinha'])->assertStatus(422);
        $this->acao($c, $c->ana, $id, 'depositar', ['personagem_id' => $c->aria->id, 'qtd' => 2_000_000])->assertOk();
        $this->assertSame(3_000_000, $this->ficha($c->aria->id)['belly']);
        // não deposita com o personagem de outra jogadora
        $this->acao($c, $c->ana, $id, 'depositar', ['personagem_id' => $c->beto->id, 'qtd' => 1])->assertForbidden();

        $this->acao($c, $c->ana, $id, 'construir', ['grupo' => 'comodos', 'tipo' => 'cozinha'])->assertOk();
        $f = $this->ficha($id);
        $this->assertSame(1_700_000, $f['belly']);
        $this->assertSame(4, $f['navio']['comodos'][0]['pronto_dia']); // dia 1 + 3 dias
        $this->assertSame(50, Navios::calcular($f['navio'], 300)['lotacao']); // em obra: ainda não vale
        // limites: cozinha é única; motor a vapor não cabe num navio Médio; o jogador não dita o preço
        $this->acao($c, $c->ana, $id, 'construir', ['grupo' => 'comodos', 'tipo' => 'cozinha'])->assertStatus(422);
        $this->acao($c, $c->ana, $id, 'construir', ['grupo' => 'motores', 'tipo' => 'vapor'])->assertStatus(422);
        $this->acao($c, $c->ana, $id, 'construir', ['grupo' => 'comodos', 'tipo' => 'cela', 'valor' => 0])->assertOk();
        $this->assertSame(1_480_000, $this->ficha($id)['belly']);
        // comprar pronto: preço cheio, sem prazo
        $this->acao($c, $c->ana, $id, 'construir', ['grupo' => 'canhoes', 'tipo' => 'comum', 'modo' => 'comprar'])->assertStatus(422); // ฿ 1.500.000 > saldo
        $this->acao($c, $c->ana, $id, 'construir', ['grupo' => 'canhoes', 'tipo' => 'comum', 'modo' => 'construir'])->assertOk(); // ฿ 900.000, 10 dias
        $this->assertSame(11, collect($this->ficha($id)['navio']['canhoes'])->last()['pronto_dia']);

        $this->tempo($c, 4);
        $f = $this->ficha($id);
        $this->assertNull($f['navio']['comodos'][0]['pronto_dia']);
        $this->assertSame(55, Navios::calcular($f['navio'], 300)['lotacao']);
        // só o mestre conclui na hora
        $this->acao($c, $c->ana, $id, 'concluir', ['grupo' => 'canhoes'])->assertForbidden();
        $this->acao($c, $c->mestre, $id, 'concluir', ['grupo' => 'canhoes'])->assertOk();
        $this->assertSame(4, Navios::calcular($this->ficha($id)['navio'], 300)['canhoes']);
        // o jogador remove uma peça (sem reembolso)
        $uid = $this->ficha($id)['navio']['comodos'][1]['uid'];
        $this->acao($c, $c->ana, $id, 'remover', ['grupo' => 'comodos', 'uid' => $uid])->assertOk();
        $this->assertCount(1, $this->ficha($id)['navio']['comodos']);
    }

    public function test_despesas_semanais_saem_do_tesouro_e_sem_dinheiro_os_comodos_param(): void
    {
        $c = $this->cenario();
        $id = $this->navio($c);
        $this->acao($c, $c->mestre, $id, 'config', ['belly' => 60_000])->assertOk();
        $this->acao($c, $c->mestre, $id, 'construir', ['grupo' => 'comodos', 'tipo' => 'cozinha', 'valor' => 0, 'dias' => 0])->assertOk();
        $this->tempo($c, 7);
        $this->assertSame(60_000, $this->ficha($id)['belly']); // a 1ª cobrança é no dia 8
        $this->tempo($c, 8);
        $this->assertSame(35_000, $this->ficha($id)['belly']);
        $this->assertSame(15, $this->ficha($id)['navio']['manutencao']['proxima_dia']);
        // salto de duas semanas: paga uma (฿ 25.000) e fica devendo a outra
        $this->tempo($c, 22);
        $f = $this->ficha($id);
        $this->assertSame(10_000, $f['belly']);
        $this->assertFalse($f['navio']['manutencao']['em_dia']);
        $this->assertSame(50, Navios::calcular($f['navio'], 300)['lotacao']); // a Cozinha parou de dar o +5
        $this->assertSame(29, $f['navio']['manutencao']['proxima_dia']);
        // voltar o dia não devolve nada
        $this->tempo($c, 3);
        $this->assertSame(10_000, $this->ficha($id)['belly']);
        // com dinheiro, qualquer um paga o atraso
        $this->acao($c, $c->ana, $id, 'pagar')->assertStatus(422);
        $this->acao($c, $c->ana, $id, 'depositar', ['personagem_id' => $c->aria->id, 'qtd' => 20_000])->assertOk();
        $this->acao($c, $c->ana, $id, 'pagar')->assertOk();
        $this->assertTrue($this->ficha($id)['navio']['manutencao']['em_dia']);
        $this->assertSame(5_000, $this->ficha($id)['belly']);
    }

    public function test_carga_compartilhada_entre_os_jogadores(): void
    {
        $c = $this->cenario();
        $id = $this->navio($c);
        $item = $c->mesa->itens()->create(['nome' => 'Poção', 'dados' => []]);
        $aria = $c->aria->fresh();
        $aria->ficha = [...$aria->ficha, 'inventario' => [['secao' => 'Equipamento', 'itens' => [['item_id' => $item->id, 'qtd' => 5, 'equipado' => false, 'sintonizado' => false]]]]];
        $aria->save();

        $this->acao($c, $c->ana, $id, 'guardar', ['personagem_id' => $c->aria->id, 'item_id' => $item->id, 'qtd' => 9])->assertStatus(422);
        $this->acao($c, $c->ana, $id, 'guardar', ['personagem_id' => $c->aria->id, 'item_id' => $item->id, 'qtd' => 3])->assertOk();
        $this->assertSame(2, $this->ficha($c->aria->id)['inventario'][0]['itens'][0]['qtd']);
        $this->assertSame(3, $this->ficha($id)['inventario'][0]['itens'][0]['qtd']);
        // a outra jogadora retira para o personagem DELA (e passa a receber o item da mesa)
        $this->acao($c, $c->bia, $id, 'retirar', ['personagem_id' => $c->aria->id, 'item_id' => $item->id, 'qtd' => 1])->assertForbidden();
        $this->acao($c, $c->bia, $id, 'retirar', ['personagem_id' => $c->beto->id, 'item_id' => $item->id, 'qtd' => 3])->assertOk();
        $this->assertSame(3, $this->ficha($c->beto->id)['inventario'][0]['itens'][0]['qtd']);
        $this->assertSame([], $this->ficha($id)['inventario'][0]['itens']);
        // saque do tesouro
        $this->acao($c, $c->ana, $id, 'depositar', ['personagem_id' => $c->aria->id, 'qtd' => 1000])->assertOk();
        $this->acao($c, $c->bia, $id, 'sacar', ['personagem_id' => $c->beto->id, 'qtd' => 5000])->assertStatus(422);
        $this->acao($c, $c->bia, $id, 'sacar', ['personagem_id' => $c->beto->id, 'qtd' => 400])->assertOk();
        $this->assertSame(400, $this->ficha($c->beto->id)['belly']);
        $this->assertSame(600, $this->ficha($id)['belly']);
        // a jogadora vê o item que está na carga do navio
        $this->acao($c, $c->bia, $id, 'guardar', ['personagem_id' => $c->beto->id, 'item_id' => $item->id, 'qtd' => 1])->assertOk();
        $props = $this->como($c->ana)->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->assertOk()->viewData('page')['props'];
        $this->assertContains($item->id, collect($props['itens'])->pluck('id')->all());
    }

    public function test_tripulacao_pv_conserto_e_automacoes_do_calendario(): void
    {
        $c = $this->cenario();
        $id = $this->navio($c);
        // Aria é carpinteira: desconto de 40% e conserto pelo carpinteiro
        $aria = $c->aria->fresh();
        $aria->ficha = [...$aria->ficha, 'profissoes' => ['semProfissao' => false, 'livroLido' => false, 'lista' => [['id' => 'carpinteiro', 'graduacao' => 0, 'nivel' => 1]], 'usados' => []]];
        $aria->save();
        $lista = [
            ['nome' => 'Aria', 'personagem_id' => $c->aria->id, 'qtd' => 1, 'funcoes' => ['capitao', 'navegacao']],
            ['nome' => 'Marujos', 'personagem_id' => null, 'qtd' => 4, 'funcoes' => ['navegacao', 'criado-de-bordo']],
        ];
        $this->acao($c, $c->ana, $id, 'tripulacao', ['lista' => [['nome' => 'A', 'personagem_id' => null, 'qtd' => 1, 'funcoes' => ['capitao', 'imediato']]]])->assertStatus(422);
        $this->acao($c, $c->ana, $id, 'tripulacao', ['lista' => $lista])->assertOk();
        $f = $this->ficha($id);
        $this->assertTrue($f['navio']['oficios']['carpinteiro']);
        $this->assertSame('ok', Navios::efetivo($f['navio'])['linhas'][0]['situacao']);
        $this->assertSame(180_000, Navios::custoDaObra($f['navio'], 'comodos', 'cozinha', 'construir')['custo']);

        // PV: só o mestre; o dano desconta o BR do carvalho (10) e consome antes os PV paralelos
        $this->acao($c, $c->ana, $id, 'pv', ['dano' => 50])->assertForbidden();
        $this->acao($c, $c->mestre, $id, 'pv', ['temp' => 30])->assertOk();
        $this->acao($c, $c->mestre, $id, 'pv', ['dano' => 110])->assertOk();
        $f = $this->ficha($id);
        $this->assertSame(0, $f['pv']['temp']);
        $this->assertSame(230, $f['pv']['atual']); // 110 − 10 = 100; 30 nos paralelos, 70 nos PV
        $this->assertSame('avariado', Navios::calcular($f['navio'], 230)['condicao']);

        // conserto pelo carpinteiro: ฿ 100.000 + 70 PV × ฿ 100.000; os PV voltam quando o prazo vence
        $this->acao($c, $c->mestre, $id, 'config', ['belly' => 8_000_000])->assertOk();
        $this->acao($c, $c->ana, $id, 'consertar', ['modo' => 'carpinteiro', 'dias' => 99])->assertStatus(422);
        $this->acao($c, $c->ana, $id, 'consertar', ['modo' => 'carpinteiro', 'dias' => 5])->assertOk();
        $this->assertSame(900_000, $this->ficha($id)['belly']);
        $this->tempo($c, 5);
        $this->assertSame(230, $this->ficha($id)['pv']['atual']);
        $this->tempo($c, 6);
        $f = $this->ficha($id);
        $this->assertSame(300, $f['pv']['atual']);
        $this->assertNull($f['navio']['conserto']);

        // Klabautermann: +100 PV por dia num navio Médio; gerador recarrega as baterias
        $this->acao($c, $c->mestre, $id, 'pv', ['atual' => 50])->assertOk();
        $this->acao($c, $c->mestre, $id, 'config', ['klabautermann' => true, 'belly' => 10_000_000])->assertOk();
        $this->acao($c, $c->mestre, $id, 'construir', ['grupo' => 'comodos', 'tipo' => 'gerador', 'valor' => 0, 'dias' => 0])->assertOk();
        $this->tempo($c, 7);
        $f = $this->ficha($id);
        $this->assertSame(150, $f['pv']['atual']);
        $this->assertSame(3, $f['navio']['baterias']);
        $this->acao($c, $c->ana, $id, 'bateria', ['gastar' => 2])->assertOk();
        $this->acao($c, $c->ana, $id, 'bateria', ['gastar' => 2])->assertStatus(422);
        $this->assertSame(1, $this->ficha($id)['navio']['baterias']);
    }
}
