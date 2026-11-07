<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\OnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** O Haki na ficha: o que só o mestre grava, a validação das compras e os 40 talentos gerados pelo front. */
class HakiFichaTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(): object
    {
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $aria->jogadores()->attach($ana);
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);

        return (object) compact('mesa', 'mestre', 'ana', 'aria');
    }

    private function como(Jogador $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => [$p->id => true]]])->withHeader('X-Jogador', (string) $p->id);
    }

    private function editar($c, Jogador $quem, array $campos)
    {
        return $this->como($quem)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), ['campos' => $campos]);
    }

    public function test_os_40_talentos_gerados_pelo_front_passam_na_validacao_do_servidor(): void
    {
        $c = $this->cenario();
        $campos = json_decode(file_get_contents(base_path('tests/Fixtures/haki-completo.json')), true);

        $this->editar($c, $c->mestre, $campos)->assertOk();

        $ficha = $c->aria->fresh()->ficha;
        $this->assertCount(39, $ficha['haki']['talentos']); // o Rei vem de graça com o Haki do Rei
        $this->assertGreaterThanOrEqual(40, count($ficha['caracteristicas']));
        $this->assertSame('haki', $ficha['caracteristicas'][0]['builder']);
    }

    public function test_jogador_nao_se_da_pa_nem_libera_o_haki(): void
    {
        $c = $this->cenario();
        $this->editar($c, $c->ana, ['haki.extras' => 50])->assertForbidden();
        $this->editar($c, $c->ana, ['haki.liberado' => true])->assertForbidden();
        $this->editar($c, $c->ana, ['haki.rei' => true])->assertForbidden();
        $this->editar($c, $c->ana, ['haki.restritos.armamento' => 5])->assertForbidden();
        $this->editar($c, $c->ana, ['haki.prematuroNivel' => 3])->assertForbidden();
        $this->editar($c, $c->mestre, ['haki.extras' => 50, 'haki.liberado' => true, 'haki.restritos.observacao' => 3])->assertOk();
        $this->assertSame(50, $c->aria->fresh()->ficha['haki']['extras']);
    }

    public function test_jogador_compra_dentro_do_saldo_e_nao_devolve(): void
    {
        $c = $this->cenario();
        $this->editar($c, $c->mestre, ['nivel' => 8])->assertOk(); // 5 PA
        $this->editar($c, $c->ana, ['haki.talentos' => [['id' => 'ataque-infuso', 'formas' => 1]], 'haki.principal' => 'armamento', 'haki.afinidade' => 'armamento'])->assertOk();

        // sem saldo para o segundo (afinidade armamento despertou: +2 PA, mas custa 5 e restam 2)
        $this->editar($c, $c->ana, ['haki.talentos' => [['id' => 'ataque-infuso', 'formas' => 1], ['id' => 'endurecimento-defensivo', 'formas' => 1]]])->assertUnprocessable();
        // talento inexistente, forma inválida e Rei sem Haki do Rei
        $this->editar($c, $c->ana, ['haki.talentos' => [['id' => 'ataque-infuso', 'formas' => 1], ['id' => 'inventado', 'formas' => 1]]])->assertUnprocessable();
        $this->editar($c, $c->ana, ['haki.talentos' => [['id' => 'ataque-infuso', 'formas' => 3]]])->assertUnprocessable();
        // devolver é do mestre
        $this->editar($c, $c->ana, ['haki.talentos' => []])->assertForbidden();
        $this->editar($c, $c->mestre, ['haki.talentos' => []])->assertOk();
    }

    public function test_haki_treinado_da_proficiencia_na_pericia_haki(): void
    {
        $sistema = new OnePiece;
        $ficha = $sistema->fichaPadrao();
        $ficha['nivel'] = 20;
        $ficha['atributos']['von'] = 14;
        $sem = $sistema->variaveisDeRolagem($ficha, [])['pericia.haki'];

        $ficha['haki']['liberado'] = true;
        $ficha['haki']['extras'] = 100;
        $ficha['haki']['talentos'] = array_map(fn ($id) => ['id' => $id, 'formas' => 1], ['ataque-infuso', 'endurecimento-defensivo', 'antecipacao', 'antevisao', 'previsao']);
        $treinado = $sistema->variaveisDeRolagem($ficha, [])['pericia.haki'];

        $this->assertSame($sem + 6, $treinado); // +6 de proficiência no 20º nível
    }

    public function test_pontos_de_escudo_absorvem_antes_dos_pv_temporarios_com_resistencia(): void
    {
        $c = $this->cenario();
        $this->editar($c, $c->mestre, ['pv.max' => 100, 'pv.atual' => 100, 'pv.temp' => 10, 'pv.escudo' => 20])->assertOk();
        $dano = fn (string $expr, string $tipo) => $this->como($c->mestre)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => $expr, 'rotulo' => 'Golpe', 'visibilidade' => 'todos', 'personagem_id' => null, 'dano' => ['tipo' => $tipo],
        ])->assertCreated()->json('id');
        $aplicar = fn (int $mensagem) => $this->como($c->mestre)->postJson(route('jogo.personagens.dano', [$c->mesa->id, $c->aria->id]), ['mensagem_id' => $mensagem])->assertOk();

        // cortante resiste: 20 de dano tiram 10 do escudo (20 → 10) e nada passa
        $aplicar($dano('20', 'cortante'));
        $pv = $c->aria->fresh()->ficha['pv'];
        $this->assertSame(10, $pv['escudo']);
        $this->assertSame(10, $pv['temp']);
        $this->assertSame(100, $pv['atual']);

        // fogo não resiste: 25 de dano: 10 do escudo, 10 dos temporários e 5 dos PV
        $aplicar($dano('25', 'fogo'));
        $pv = $c->aria->fresh()->ficha['pv'];
        $this->assertSame(0, $pv['escudo']);
        $this->assertSame(0, $pv['temp']);
        $this->assertSame(95, $pv['atual']);
    }

    public function test_os_51_treinamentos_gerados_pelo_front_passam_na_validacao_do_servidor(): void
    {
        $c = $this->cenario();
        $campos = json_decode(file_get_contents(base_path('tests/Fixtures/treinamentos-todos.json')), true);

        $this->editar($c, $c->mestre, $campos)->assertOk();

        $ficha = $c->aria->fresh()->ficha;
        $this->assertCount(51, $ficha['treinamento']['aprendidos']);
        $this->assertGreaterThanOrEqual(51, count($ficha['caracteristicas']));
        $this->assertSame('treinamento', $ficha['caracteristicas'][0]['builder']);
        $this->assertContains('Chuva de Flechas', array_column($ficha['tecnicas']['lista'], 'nome'));
    }

    public function test_jogador_so_faz_pedidos_de_treinamento_e_o_mestre_conclui(): void
    {
        $c = $this->cenario();
        $this->editar($c, $c->mestre, ['nivel' => 4, 'atributos.for' => 14])->assertOk(); // 6 PT

        // não dá PT a si mesmo nem conclui
        $this->editar($c, $c->ana, ['treinamento.extras' => 10])->assertForbidden();
        $this->editar($c, $c->ana, ['treinamento.aprendidos' => [['id' => 'bom-nadador', 'nivel' => 4]]])->assertForbidden();

        // pede o que cabe; recusado o que não cabe
        $this->editar($c, $c->ana, ['treinamento.pedidos' => [['id' => 'bom-nadador', 'dias' => 0]]])->assertOk();
        $this->editar($c, $c->ana, ['treinamento.pedidos' => [['id' => 'bom-nadador', 'dias' => 0], ['id' => 'tekkai', 'dias' => 0]]])->assertUnprocessable(); // sem FOR 18
        $this->editar($c, $c->ana, ['treinamento.pedidos' => [['id' => 'bom-nadador', 'dias' => 3]]])->assertForbidden(); // dias são do mestre
        $this->editar($c, $c->ana, ['treinamento.pedidos' => [['id' => 'inventado', 'dias' => 0]]])->assertUnprocessable();

        // o mestre marca dias, conclui e o PT é gasto
        $this->editar($c, $c->mestre, ['treinamento.pedidos' => [['id' => 'bom-nadador', 'dias' => 5]]])->assertOk();
        $this->editar($c, $c->mestre, ['treinamento.pedidos' => [], 'treinamento.aprendidos' => [['id' => 'bom-nadador', 'nivel' => 4]]])->assertOk();
        $this->assertSame(5, \App\Sistemas\OnePiece\Treinamentos::resumoDosPT($c->aria->fresh()->ficha)['livres']);

        // o jogador cancela o próprio pedido
        $this->editar($c, $c->mestre, ['atributos.for' => 18])->assertOk();
        $this->editar($c, $c->ana, ['treinamento.pedidos' => [['id' => 'tekkai', 'dias' => 0]]])->assertOk();
        $this->editar($c, $c->ana, ['treinamento.pedidos' => []])->assertOk();
    }

    public function test_as_20_caracteristicas_de_antecedente_gerados_pelo_front_passam_na_validacao_do_servidor(): void
    {
        $c = $this->cenario();
        $campos = json_decode(file_get_contents(base_path('tests/Fixtures/antecedentes-todos.json')), true);

        $this->editar($c, $c->mestre, $campos)->assertOk();

        $ficha = $c->aria->fresh()->ficha;
        $this->assertSame('Artista', $ficha['antecedente']);
        $this->assertCount(20, $ficha['caracteristicas']);
        $this->assertSame('antecedente', $ficha['caracteristicas'][0]['builder']);
        $this->assertSame(1, $ficha['pericias']['atuacao']);
    }

    public function test_as_caracteristicas_das_20_profissoes_gerados_pelo_front_passam_na_validacao_do_servidor(): void
    {
        $c = $this->cenario();
        $campos = json_decode(file_get_contents(base_path('tests/Fixtures/profissoes-todas.json')), true);

        $this->editar($c, $c->mestre, $campos)->assertOk();

        $ficha = $c->aria->fresh()->ficha;
        $this->assertSame(1, $ficha['pericias']['oficio']);
        $this->assertCount(5, $ficha['profissoes']['lista']);
        $this->assertSame('profissao', $ficha['caracteristicas'][0]['builder']);
        $this->assertGreaterThanOrEqual(40, count($ficha['caracteristicas']));
    }

    public function test_jogador_escolhe_a_profissao_do_primeiro_nivel_uma_vez_e_o_resto_e_do_mestre(): void
    {
        $c = $this->cenario();
        $inicial = fn (string $id, int $graduacao = 0, int $nivel = 1) => ['profissoes' => ['semProfissao' => false, 'livroLido' => false, 'lista' => [['id' => $id, 'graduacao' => $graduacao, 'nivel' => $nivel]], 'usados' => []]];

        // graduação inicial só 0, profissão do catálogo, nível 1
        $this->editar($c, $c->ana, $inicial('medico', 2))->assertUnprocessable();
        $this->editar($c, $c->ana, $inicial('inventada'))->assertUnprocessable();
        $this->editar($c, $c->ana, $inicial('medico'))->assertOk();

        // depois de escolhida, o jogador não troca nem sobe sozinho
        $this->editar($c, $c->ana, $inicial('navegador'))->assertForbidden();
        $this->editar($c, $c->ana, $inicial('medico', 1))->assertForbidden(); // graduação sem avanço livre é do mestre
        $this->editar($c, $c->ana, ['profissoes.livroLido' => true])->assertForbidden();
        $this->editar($c, $c->ana, ['profissoes.semProfissao' => true])->assertForbidden();
        $this->editar($c, $c->ana, ['profissoes.lista' => []])->assertForbidden();
    }

    public function test_avanco_do_quinto_nivel_nova_profissao_com_livro_e_avanco_planejado(): void
    {
        $c = $this->cenario();
        $this->editar($c, $c->mestre, ['nivel' => 5, 'profissoes' => ['semProfissao' => false, 'livroLido' => false, 'lista' => [['id' => 'medico', 'graduacao' => 0, 'nivel' => 1]], 'usados' => []]])->assertOk();
        $nova = ['semProfissao' => false, 'livroLido' => false, 'lista' => [['id' => 'medico', 'graduacao' => 0, 'nivel' => 1], ['id' => 'navegador', 'graduacao' => 0, 'nivel' => 5]], 'usados' => [5]];

        // sem o Livro (o mestre libera), a profissão nova é recusada
        $this->editar($c, $c->ana, ['profissoes' => $nova])->assertUnprocessable();
        $this->editar($c, $c->mestre, ['profissoes.livroLido' => true])->assertOk();
        $this->editar($c, $c->ana, ['profissoes' => $nova])->assertOk();
        $this->assertCount(2, $c->aria->fresh()->ficha['profissoes']['lista']);

        // o avanço do 5º nível já foi usado: nem outra profissão nem graduação, até o 10º nível
        $this->editar($c, $c->mestre, ['profissoes.livroLido' => true])->assertOk();
        $planejado = $nova;
        $planejado['livroLido'] = true;
        $planejado['lista'][0]['graduacao'] = 1;
        $planejado['usados'] = [5, 10];
        $this->editar($c, $c->ana, ['profissoes' => $planejado])->assertUnprocessable();

        // 10º nível: Avanço Planejado sobe 1 graduação
        $this->editar($c, $c->mestre, ['nivel' => 10])->assertOk();
        $this->editar($c, $c->ana, ['profissoes' => $planejado])->assertOk();
        // pular duas graduações não vale
        $duas = $planejado;
        $duas['lista'][1]['graduacao'] = 2;
        $duas['usados'] = [5, 10, 15];
        $this->editar($c, $c->ana, ['profissoes' => $duas])->assertForbidden();
        // reduzir graduação ou tirar profissão é do mestre
        $this->editar($c, $c->ana, ['profissoes' => $nova])->assertForbidden();
        // o Grande Feito é do mestre e não gasta avanço
        $feito = $planejado;
        $feito['lista'][1]['graduacao'] = 1;
        $this->editar($c, $c->ana, ['profissoes' => $feito])->assertForbidden();
        $this->editar($c, $c->mestre, ['profissoes' => $feito])->assertOk();
    }

    public function test_interruptor_do_haki_e_do_dono_e_as_caracteristicas_so_valem_ligado(): void
    {
        $c = $this->cenario();
        $this->editar($c, $c->mestre, ['haki.liberado' => true])->assertOk();
        $this->editar($c, $c->ana, ['haki.ativo' => true])->assertOk();
        $this->assertTrue($c->aria->fresh()->ficha['haki']['ativo']);
        $base = array_replace_recursive(\App\Sistemas\OnePiece\FichaOnePiece::padrao(), [
            'nivel' => 5,
            'caracteristicas' => [['nome' => 'Endurecimento', 'origem' => 'Haki', 'tipo' => 'passiva', 'builder' => 'haki', 'efeitos' => [['alvo' => 'pv.max', 'modo' => 'soma', 'valor' => 7]]]],
        ]);
        $ficha = [...$base, 'haki' => [...$base['haki'], 'ativo' => true]];
        $ligado = \App\Sistemas\OnePiece\Regras::calcular($ficha);
        $desligado = \App\Sistemas\OnePiece\Regras::calcular([...$ficha, 'haki' => [...$ficha['haki'], 'ativo' => false]]);
        $this->assertSame(7, $ligado['pv.max'] - $desligado['pv.max']);
    }
}
