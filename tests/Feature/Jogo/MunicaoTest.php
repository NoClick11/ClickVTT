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

    private function tecnicaComMunicao($c, string $descricao = 'Disparos. Requisito: arma favorita, 3 munições (qualquer). Ataque combinado: possível.'): void
    {
        $f = $c->p->fresh()->ficha;
        $f['tecnicas']['lista'] = [['nome' => 'Tiro Duplo', 'descricao' => $descricao, 'custo' => 1, 'rolagem' => '', 'origem' => '1º Grau', 'alcance' => '', 'tipoDano' => '', 'acao' => 'poderosa']];
        $c->p->ficha = $f;
        $c->p->save();
    }

    public function test_o_custo_de_municao_da_tecnica_sai_do_requisito(): void
    {
        $this->assertSame(['quantidade' => 8, 'tipo' => 'qualquer'], Municoes::custoDaTecnica('x. Requisito: arma favorita, 8 munições (qualquer). Ataque combinado: impossível.'));
        $this->assertSame(['quantidade' => 2, 'tipo' => 'esferica'], Municoes::custoDaTecnica('Requisito: arma favorita, 2 munições (esférica).'));
        $this->assertSame(['quantidade' => 1, 'tipo' => 'perfurante'], Municoes::custoDaTecnica('Requisito: arma favorita, 1 munição (perfurante).'));
        $this->assertNull(Municoes::custoDaTecnica('Sem requisito de munição.'));
        $this->assertSame(['municao-esferica', 'municao-perfurante'], Municoes::paraGastar('qualquer', Municoes::daArma('pistola')));
    }

    public function test_a_tecnica_de_arma_de_fogo_gasta_a_municao_do_requisito(): void
    {
        $c = $this->cenario();
        $this->tecnicaComMunicao($c);
        $corpo = ['personagem_id' => $c->p->id, 'tecnica' => 'Tiro Duplo'];
        // 2 esféricas + 1 perfurante = 3: gasta tudo, esférica primeiro
        $this->como($c->ana)->postJson(route('jogo.tecnicas.municao.gastar', $c->mesa->id), $corpo)->assertOk()->assertJsonPath('gasto.quantidade', 3);
        $this->assertSame(0, $this->qtd($c, $c->esferica->id));
        $this->assertSame(0, $this->qtd($c, $c->perfurante->id));
        // sem munição suficiente: recusa e não mexe em nada
        $this->como($c->ana)->postJson(route('jogo.tecnicas.municao.gastar', $c->mesa->id), $corpo)->assertStatus(422)->assertJsonValidationErrors('municao');
        $this->assertSame(5, $this->qtd($c, $c->flecha->id)); // flecha não serve à pistola e nunca é gasta
    }

    public function test_a_tecnica_recusa_sem_arma_de_fogo_equipada_e_nao_gasta_sem_requisito(): void
    {
        $c = $this->cenario();
        $this->tecnicaComMunicao($c);
        $f = $c->p->fresh()->ficha;
        $f['inventario'][0]['itens'][0]['equipado'] = false; // pistola guardada
        $c->p->ficha = $f;
        $c->p->save();
        $this->como($c->ana)->postJson(route('jogo.tecnicas.municao.gastar', $c->mesa->id), ['personagem_id' => $c->p->id, 'tecnica' => 'Tiro Duplo'])->assertStatus(422);
        $this->assertSame(2, $this->qtd($c, $c->esferica->id));
        $this->tecnicaComMunicao($c, 'Golpe sem munição.');
        $this->como($c->ana)->postJson(route('jogo.tecnicas.municao.gastar', $c->mesa->id), ['personagem_id' => $c->p->id, 'tecnica' => 'Tiro Duplo'])->assertOk()->assertJsonPath('gasto', null);
        $this->assertSame(2, $this->qtd($c, $c->esferica->id));
    }

    /** Grava na mensagem do ataque o efeito da munição, para testar o botão sem depender do d20. */
    private function ataqueComEfeito($c, string $catalogoId, array $extra = []): \App\Models\Mensagem
    {
        return $c->mesa->mensagens()->create([
            'jogador_id' => $c->ana->id, 'personagem_id' => $c->p->id, 'tipo' => 'rolagem', 'visibilidade' => 'todos', 'texto' => '1d20',
            'dados' => ['expressao' => '1d20', 'termos' => [], 'total' => 15, 'sistema' => [
                'municao' => ['id' => $catalogoId, 'nome' => 'x', 'nota' => 'n', 'efeito' => $catalogoId === 'bola-explosiva' ? 'explosao' : 'kairoseki'],
                ...$extra,
            ]],
        ]);
    }

    public function test_a_kairoseki_enfraquece_so_quem_usa_akuma_e_so_uma_vez(): void
    {
        $c = $this->cenario();
        $usuario = $c->mesa->personagens()->create(['nome' => 'Fruta', 'cor' => '#ef4444']);
        $f = FichaOnePiece::padrao();
        $f['akuma']['tipo'] = 'paramecia';
        $usuario->ficha = $f;
        $usuario->save();
        $comum = $c->mesa->personagens()->create(['nome' => 'Comum', 'cor' => '#ef4444']);
        $m = $this->ataqueComEfeito($c, 'municao-de-kairoseki');
        $rota = route('jogo.tecnicas.municao.efeito', [$c->mesa->id, $m->id]);

        $this->como($c->ana)->postJson($rota, ['alvo_id' => $comum->id])->assertStatus(422)->assertJsonValidationErrors('efeito'); // sem Akuma
        $this->como($c->ana)->postJson($rota, ['alvo_id' => $usuario->id])->assertOk();
        $this->assertContains('enfraquecido', $usuario->fresh()->ficha['condicoes']);
        $this->assertSame(1, $usuario->fresh()->ficha['duracoes']['enfraquecido']['turnos']);
        $this->como($c->ana)->postJson($rota, ['alvo_id' => $usuario->id])->assertStatus(422); // já usada
    }

    public function test_o_efeito_exige_acerto_e_ser_o_dono_do_ataque(): void
    {
        $c = $this->cenario();
        $alvo = $c->mesa->personagens()->create(['nome' => 'Alvo', 'cor' => '#ef4444']);
        $errou = $this->ataqueComEfeito($c, 'bola-explosiva', ['resolucao' => ['estado' => 'resolvido', 'acerto' => false, 'alvo_id' => $alvo->id]]);
        $this->como($c->ana)->postJson(route('jogo.tecnicas.municao.efeito', [$c->mesa->id, $errou->id]))->assertStatus(422);
        $acertou = $this->ataqueComEfeito($c, 'bola-explosiva', ['resolucao' => ['estado' => 'resolvido', 'acerto' => true, 'alvo_id' => $alvo->id]]);
        $outra = $c->mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $this->como($outra)->postJson(route('jogo.tecnicas.municao.efeito', [$c->mesa->id, $acertou->id]))->assertForbidden();
    }

    public function test_a_bola_explosiva_abre_a_salvaguarda_fixa_de_quem_esta_na_area(): void
    {
        $c = $this->cenario();
        $alvo = $c->mesa->personagens()->create(['nome' => 'Alvo', 'cor' => '#ef4444']);
        $perto = $c->mesa->personagens()->create(['nome' => 'Perto', 'cor' => '#ef4444']);
        $m = $this->ataqueComEfeito($c, 'bola-explosiva', ['resolucao' => ['estado' => 'resolvido', 'acerto' => true, 'alvo_id' => $alvo->id]]);
        $this->como($c->ana)->postJson(route('jogo.tecnicas.municao.efeito', [$c->mesa->id, $m->id]), ['alvos' => [$perto->id]])->assertOk();
        $card = $c->mesa->mensagens()->where('tipo', 'tecnica')->firstOrFail();
        $this->assertSame(16, $card->dados['tecnica']['cd']); // CD fixa do livro, não a do atacante
        $this->assertSame(['3d6', 'Fogo'], [$card->dados['tecnica']['dano']['expressao'], $card->dados['tecnica']['dano']['tipo']]);
        $this->assertEqualsCanonicalizing([$alvo->id, $perto->id], array_column($card->dados['alvos'], 'personagem_id')); // o atingido e quem está perto
    }

    public function test_municao_e_arma_criadas_a_mao_funcionam_juntas(): void
    {
        $c = $this->cenario();
        $dadosArma = ['arma' => ['municao' => true, 'atributo' => 'des', 'distancia' => true, 'alcanceNormal' => 9, 'alcanceMaximo' => 18, 'margemCritica' => 20, 'proficiente' => true]];
        $arma = $c->mesa->itens()->create(['nome' => 'Rifle do Mestre', 'descricao' => '', 'peso' => 1, 'equipavel' => true, 'requer_sintonia' => false, 'dados' => $dadosArma, 'efeitos' => []]);
        $bala = $c->mesa->itens()->create(['nome' => 'Bala Sônica', 'descricao' => '', 'peso' => 0.1, 'equipavel' => false, 'requer_sintonia' => false, 'dados' => ['municao' => ['dano' => '2d6', 'tipoDano' => 'Trovão']], 'efeitos' => []]);
        $f = $c->p->fresh()->ficha;
        $f['inventario'][0]['itens'][] = ['item_id' => $arma->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false];
        $f['inventario'][0]['itens'][] = ['item_id' => $bala->id, 'qtd' => 3, 'equipado' => false, 'sintonizado' => false];
        $c->p->ficha = $f;
        $c->p->save();
        // a arma sem item do catálogo aceita a munição do catálogo e a criada à mão; a criada à mão serve também à pistola do catálogo
        $r = $this->atacar($c, $arma, $bala->id)->assertCreated()->json();
        $this->assertSame('Bala Sônica', $r['dados']['sistema']['municao']['nome']);
        if ($acao = $r['dados']['sistema']['acoes'][0] ?? null) {
            $this->assertMatchesRegularExpression('/^\d+d6\+/', $acao['expressao']);
            $this->assertSame('Trovão', $acao['dano']['tipo']);
        }
        $this->assertSame(2, $this->qtd($c, $bala->id));
        $this->atacar($c, $arma, $c->esferica->id)->assertCreated();
        $this->atacar($c, $c->pistola, $bala->id)->assertCreated();
        $this->assertSame(1, $this->qtd($c, $bala->id));
        // "qualquer" de uma Técnica também gasta a munição criada à mão
        $f = $c->p->fresh()->ficha;
        $f['inventario'][0]['itens'][5]['equipado'] = false; // só a pistola do catálogo equipada (a arma criada à mão aceitaria até flechas)
        $c->p->ficha = $f;
        $c->p->save();
        $this->tecnicaComMunicao($c, 'Rajada. Requisito: arma favorita, 3 munições (qualquer).');
        $this->como($c->ana)->postJson(route('jogo.tecnicas.municao.gastar', $c->mesa->id), ['personagem_id' => $c->p->id, 'tecnica' => 'Tiro Duplo'])->assertOk();
        $this->assertSame(0, $this->qtd($c, $bala->id));
    }
}
