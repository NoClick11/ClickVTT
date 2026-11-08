<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\FichaOnePiece;
use App\Sistemas\OnePiece\ItensIniciais;
use App\Sistemas\OnePiece\Profissoes;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Ao concluir a criação da ficha, os itens iniciais da profissão entram sozinhos no inventário. */
class ItensIniciaisTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(): object
    {
        $mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $aria->jogadores()->attach($ana);

        return (object) compact('mesa', 'mestre', 'ana', 'aria');
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    private function concluir($c, string $profissao, bool $concluida = true, ?Jogador $quem = null)
    {
        return $this->como($quem ?? $c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), [
            'campos' => ['profissoes' => ['semProfissao' => false, 'livroLido' => false, 'usados' => [], 'lista' => [['id' => $profissao, 'graduacao' => 0, 'nivel' => 1]]]],
            'criacao' => ['etapa' => 'resumo', 'concluida' => $concluida],
        ])->assertOk();
    }

    /** nome => quantidade do inventário da Aria. */
    private function inventario($c): array
    {
        $ficha = $c->aria->fresh()->ficha;
        $saida = [];
        foreach ($ficha['inventario'] ?? [] as $secao) {
            foreach ($secao['itens'] as $ref) {
                $saida[$c->mesa->itens()->find($ref['item_id'])->nome] = $ref['qtd'];
            }
        }

        return $saida;
    }

    public function test_le_o_texto_do_livro_em_quantidade_e_item_do_catalogo(): void
    {
        $this->assertSame(['qtd' => 3, 'nome' => 'Kit de Primeiros Socorros', 'catalogo' => 'kit-de-primeiros-socorros'], ItensIniciais::ler('3 kits de primeiros socorros'));
        $this->assertSame(['qtd' => 2, 'nome' => 'Algemas', 'catalogo' => 'algemas'], ItensIniciais::ler('2 pares de algemas'));
        $this->assertSame(['qtd' => 30, 'nome' => 'Ração para Animais', 'catalogo' => 'racao-para-animais'], ItensIniciais::ler('30 rações para animais'));
        $this->assertSame('instrumento-musical', ItensIniciais::ler('1 instrumento musical à sua escolha')['catalogo']);
        $this->assertSame('kit-para-abrir-cadeado', ItensIniciais::ler('1 kit para abrir cadeados')['catalogo']);
        $livros = ItensIniciais::ler('livros de marcenaria');
        $this->assertSame([1, 'Livros de marcenaria', null], [$livros['qtd'], $livros['nome'], $livros['catalogo']]); // sem item no catálogo: item simples
        // uma escolha entre itens diferentes é do jogador: item simples com o texto inteiro
        $this->assertNull(ItensIniciais::ler('1 bússola ou log pose à escolha')['catalogo']);
        $this->assertNull(ItensIniciais::ler('1 bússola à escolha (bússola, log pose, log pose de 3 agulhas)')['catalogo']);
    }

    public function test_toda_profissao_tem_itens_que_viram_itens_validos(): void
    {
        foreach (Profissoes::catalogo()['profissoes'] as $p) {
            $this->assertNotEmpty($p['itens'], $p['id']);
            foreach ($p['itens'] as $texto) {
                $r = ItensIniciais::ler($texto);
                $this->assertGreaterThanOrEqual(1, $r['qtd'], $texto);
                $this->assertNotSame('', $r['nome'], $texto);
                $this->assertLessThanOrEqual(120, mb_strlen($r['nome']), $texto);
            }
        }
    }

    public function test_concluir_a_criacao_poe_os_itens_da_profissao_no_inventario(): void
    {
        $c = $this->cenario();
        $this->assertSame([], $this->inventario($c));
        $this->concluir($c, 'medico', concluida: false); // ainda no assistente: nada entra
        $this->assertSame([], $this->inventario($c));

        $this->concluir($c, 'medico');
        $inv = $this->inventario($c);
        $this->assertSame(1, $inv['Mochila Pequena']);
        $this->assertSame(1, $inv['Kit Médico']);
        $this->assertSame(3, $inv['Kit de Primeiros Socorros']);
        $this->assertSame(1, $inv['Livros de anatomia, medicina e bioquímica']);
        // os itens do catálogo são os mesmos da loja (um por entrada); o simples fica escondido da aba Itens do mestre
        $this->assertSame('mochila-pequena', $c->mesa->itens()->where('nome', 'Mochila Pequena')->value('catalogo_id'));
        $this->assertStringStartsWith('inicial:', $c->mesa->itens()->where('nome', 'like', 'Livros de anatomia%')->value('catalogo_id'));
    }

    public function test_refazer_a_criacao_nao_duplica_e_troca_pela_profissao_nova(): void
    {
        $c = $this->cenario();
        $this->concluir($c, 'medico');
        $this->concluir($c, 'medico', quem: $c->mestre); // de novo (só o mestre refaz): mesma coisa
        $inv = $this->inventario($c);
        $this->assertSame(1, $inv['Kit Médico']);
        $this->assertSame(3, $inv['Kit de Primeiros Socorros']);

        $this->concluir($c, 'cozinheiro', quem: $c->mestre); // o mestre troca a profissão (o jogador a define uma vez): sai o do médico, entra o do cozinheiro
        $inv = $this->inventario($c);
        $this->assertArrayNotHasKey('Kit Médico', $inv);
        $this->assertSame(1, $inv['Mochila Pequena']);
        $this->assertSame(1, $inv['Kit de Cozinha']);
        $this->assertSame(3, $inv['Kit de Temperos']);
        $this->assertSame(1, $inv['Roupa de Gala']);
    }

    public function test_o_que_o_jogador_ja_tinha_fica_e_so_o_servidor_mexe_nos_itens_iniciais(): void
    {
        $c = $this->cenario();
        $corda = $c->mesa->itens()->create(['nome' => 'Corda de seda', 'peso' => 1, 'equipavel' => false]);
        $f = $c->aria->ficha ?? FichaOnePiece::padrao();
        $f['inventario'] = [['secao' => 'Equipamento', 'itens' => [['item_id' => $corda->id, 'qtd' => 1, 'equipado' => false, 'sintonizado' => false]]]];
        $c->aria->ficha = $f;
        $c->aria->save();
        $this->concluir($c, 'medico');
        $inv = $this->inventario($c);
        $this->assertSame(1, $inv['Corda de seda']);
        $this->assertSame(1, $inv['Kit Médico']);

        // o jogador não escreve `itensIniciais` à mão (nem para esconder uma repetição)
        $this->como($c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), ['campos' => ['itensIniciais' => []]])->assertForbidden();
    }

    private function concluirComEstilo($c, string $arma, ?Jogador $quem = null, array $extra = [])
    {
        return $this->como($quem ?? $c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), [
            'campos' => ['estiloId' => 'atirador', 'estilo' => 'Atirador', 'estiloCaminho' => 'sniper', ...$extra],
            'criacao' => ['etapa' => 'resumo', 'concluida' => true, 'dados' => ['escolhas' => ['estilo' => ['id' => 'atirador', 'armaFavorita' => $arma]]]],
        ])->assertOk();
    }

    private function rolarDinheiro($c, string $estilo = 'atirador', ?Jogador $quem = null)
    {
        return $this->como($quem ?? $c->ana)->postJson(route('jogo.personagens.dinheiro-rolado', [$c->mesa->id, $c->aria->id]), ['estilo' => $estilo]);
    }

    public function test_o_equipamento_do_estilo_entra_pela_arma_favorita_com_a_municao_e_os_bellys_rolados(): void
    {
        $c = $this->cenario();
        $r = $this->rolarDinheiro($c)->assertOk()->json();
        $this->assertSame(5, count($r['dados']));
        $this->assertSame(array_sum($r['dados']), $r['total']);
        $this->assertSame($r['total'] * 1000, $r['bellys']);
        $this->assertGreaterThanOrEqual(5000, $r['bellys']);
        $this->assertLessThanOrEqual(50000, $r['bellys']);
        $this->assertSame($r, $this->rolarDinheiro($c)->assertOk()->json()); // pedir de novo devolve o mesmo: ninguém rola até gostar

        $this->concluirComEstilo($c, 'Pistola');
        $inv = $this->inventario($c);
        $this->assertSame(2, $inv['Pistola']);
        $this->assertArrayNotHasKey('Mosquete', $inv);
        $this->assertSame(80, $inv['Munição Esférica']);
        $this->assertSame($r['bellys'], $c->aria->fresh()->ficha['belly']);
        $this->assertSame($r['bellys'], $c->aria->fresh()->ficha['dinheiroInicial']);
    }

    public function test_black_leg_soma_90_mil_fixos_aos_15d10_vezes_mil(): void
    {
        $c = $this->cenario();
        $r = $this->rolarDinheiro($c, 'black-leg')->assertOk()->json();
        $this->assertSame(15, count($r['dados']));
        $this->assertSame(90000, $r['fixo']);
        $this->assertSame($r['total'] * 1000 + 90000, $r['bellys']);
        $this->assertGreaterThanOrEqual(15000 + 90000, $r['bellys']);
        $this->assertLessThanOrEqual(150000 + 90000, $r['bellys']);
    }

    public function test_arma_favorita_mosquete_entrega_um_mosquete_e_refazer_nao_duplica_nem_soma_dinheiro(): void
    {
        $c = $this->cenario();
        $bellys = $this->rolarDinheiro($c)->assertOk()->json('bellys');
        $this->concluirComEstilo($c, 'Pistola');
        $this->concluirComEstilo($c, 'Mosquete', $c->mestre); // mudou de ideia (só o mestre refaz): sai a pistola, entra o mosquete
        $inv = $this->inventario($c);
        $this->assertArrayNotHasKey('Pistola', $inv);
        $this->assertSame(1, $inv['Mosquete']);
        $this->assertSame(80, $inv['Munição Esférica']); // continua 80, não 160
        $this->assertSame($bellys, $c->aria->fresh()->ficha['belly']); // o dinheiro também não soma duas vezes

        $this->concluirComEstilo($c, 'Mosquete', $c->mestre); // de novo: igual
        $this->assertSame(1, $this->inventario($c)['Mosquete']);
        $this->assertSame($bellys, $c->aria->fresh()->ficha['belly']);
    }

    public function test_sem_rolar_nao_ganha_bellys_e_o_dinheiro_que_ja_tinha_fica(): void
    {
        $c = $this->cenario();
        $this->concluirComEstilo($c, 'Pistola', extra: ['belly' => 5000]);
        $this->assertSame(5000, $c->aria->fresh()->ficha['belly']);
        $this->assertSame(0, $c->aria->fresh()->ficha['dinheiroInicial']);
        $this->rolarDinheiro($c)->assertOk();
        $bellys = $c->aria->fresh()->criacao['dados']['dinheiro']['bellys'];
        $this->concluirComEstilo($c, 'Pistola', $c->mestre);
        $this->assertSame(5000 + $bellys, $c->aria->fresh()->ficha['belly']); // o que já tinha somou com o rolado
    }

    public function test_so_estilo_que_rola_dinheiro_rola_e_so_o_dono_ou_o_mestre(): void
    {
        $c = $this->cenario();
        $this->rolarDinheiro($c, 'espadachim')->assertStatus(422)->assertJsonValidationErrors('estilo');
        $this->rolarDinheiro($c, 'atirador', $c->mestre)->assertOk();
        $outra = $c->mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $this->rolarDinheiro($c, 'atirador', $outra)->assertForbidden();
        // o jogador não escreve o dinheiro entregue à mão
        $this->como($c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), ['campos' => ['dinheiroInicial' => 1]])->assertForbidden();
    }

    public function test_o_assistente_nao_troca_o_dinheiro_rolado(): void
    {
        $c = $this->cenario();
        $r = $this->rolarDinheiro($c)->assertOk()->json();
        // o assistente salva as escolhas várias vezes, inclusive tentando mandar outro dinheiro: o servidor mantém o rolado
        $this->como($c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), [
            'criacao' => ['etapa' => 'estilo', 'concluida' => false, 'dados' => ['dinheiro' => ['estilo' => 'atirador', 'bellys' => 999999], 'escolhas' => []]],
        ])->assertOk();
        $this->assertSame($r['bellys'], $c->aria->fresh()->criacao['dados']['dinheiro']['bellys']);
    }

    public function test_heroi_deus_da_arma_recebe_a_espada_ja_ajustada_para_a_ficha(): void
    {
        $c = $this->cenario();
        $this->rolarDinheiro($c, 'heroi')->assertOk();
        $this->como($c->ana)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), [
            'campos' => ['estiloId' => 'heroi', 'estilo' => 'Herói', 'estiloCaminho' => 'arma-espada'],
            'criacao' => ['etapa' => 'resumo', 'concluida' => true, 'dados' => ['escolhas' => ['estilo' => ['id' => 'heroi', 'armaFavorita' => 'Sabre']]]],
        ])->assertOk();
        $this->assertArrayHasKey('Sabre', $this->inventario($c));
        $ref = collect($c->aria->fresh()->ficha['inventario'])->flatMap(fn ($s) => $s['itens'])->first();
        $this->assertSame(['dano' => '2d8', 'tipoDano' => 'Cortante', 'bonusAtaque' => 2, 'bonusDano' => 2], $ref['arma']);
        // o item da mesa continua com o dado do livro: o ajuste vale só para esta ficha
        $this->assertSame('1d6', $c->mesa->itens()->find($ref['item_id'])->dados['arma']['dano']);
    }
}
