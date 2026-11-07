<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
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
        $this->concluir($c, 'medico'); // de novo: mesma coisa
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
        $f = $c->aria->ficha ?? \App\Sistemas\OnePiece\FichaOnePiece::padrao();
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
}
