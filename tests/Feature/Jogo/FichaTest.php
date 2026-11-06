<?php

namespace Tests\Feature\Jogo;

use App\Events\EventoMesa;
use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\Dnd5e\FichaDnd5e;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Tests\TestCase;

class FichaTest extends TestCase
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

    private function salvar($c, Jogador $quem, array $campos, array $extra = [], ?int $personagem = null)
    {
        return $this->como($quem)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $personagem ?? $c->aria->id]), ['campos' => $campos] + $extra);
    }

    public function test_edicao_pontual_salva_so_o_campo_e_parte_da_ficha_padrao(): void
    {
        $c = $this->cenario();
        $this->assertNull($c->aria->fresh()->ficha);

        $r = $this->salvar($c, $c->ana, ['pv.atual' => 30])->assertOk()->json();

        $this->assertSame(30, $r['ficha']['pv']['atual']);
        $this->assertSame(10, $r['ficha']['atributos']['for']); // o resto veio da ficha padrão
        $this->assertSame(30, $c->aria->fresh()->ficha['pv']['atual']);

        $this->salvar($c, $c->ana, ['atributos.for' => 16])->assertOk(); // campo seguinte não desfaz o anterior
        $ficha = $c->aria->fresh()->ficha;
        $this->assertSame(30, $ficha['pv']['atual']);
        $this->assertSame(16, $ficha['atributos']['for']);
    }

    public function test_mestre_edita_qualquer_ficha_e_outro_jogador_nao(): void
    {
        $c = $this->cenario();
        $this->salvar($c, $c->mestre, ['classe' => 'Clérigo'])->assertOk();
        $this->assertSame('Clérigo', $c->aria->fresh()->ficha['classe']);

        $this->salvar($c, $c->bia, ['classe' => 'Intrusa'])->assertForbidden();
        $this->assertSame('Clérigo', $c->aria->fresh()->ficha['classe']);
    }

    public function test_personagem_de_outra_mesa_e_404(): void
    {
        $c = $this->cenario();
        $outra = $this->cenario();

        $this->salvar($c, $c->mestre, ['classe' => 'X'], personagem: $outra->aria->id)->assertNotFound();
    }

    public function test_so_campos_declarados_pelo_sistema_sao_aceitos(): void
    {
        $c = $this->cenario();
        $this->salvar($c, $c->ana, ['xyz' => 1])->assertStatus(422)->assertJsonValidationErrors('campos.xyz');
        $this->salvar($c, $c->ana, ['pv' => ['atual' => 1]])->assertStatus(422); // objeto inteiro não é editável
        $this->salvar($c, $c->ana, ['inventario.0.secao' => 'x'])->assertStatus(422); // sem índices: lista é trocada por inteiro
        $this->salvar($c, $c->ana, ['pv..atual' => 1])->assertStatus(422);
        $this->salvar($c, $c->ana, [])->assertStatus(422);
        $this->assertNull($c->aria->fresh()->ficha);
    }

    public function test_valores_invalidos_sao_rejeitados_com_tipo_estrito(): void
    {
        $c = $this->cenario();
        $this->salvar($c, $c->ana, ['atributos.for' => 31])->assertStatus(422)->assertJsonValidationErrors('campos.atributos.for');
        $this->salvar($c, $c->ana, ['atributos.for' => '14'])->assertStatus(422); // "14" não vira 14
        $this->salvar($c, $c->ana, ['nivel' => 14.5])->assertStatus(422);
        $this->salvar($c, $c->ana, ['nivel' => ''])->assertStatus(422); // "" não passa por campo numérico
        $this->salvar($c, $c->ana, ['nivel' => null])->assertStatus(422);
        $this->salvar($c, $c->ana, ['inspiracao' => 1])->assertStatus(422);
        $this->salvar($c, $c->ana, ['pericias.percepcao' => 3])->assertStatus(422);
        $this->salvar($c, $c->ana, ['dadosVida.tipo' => 'd7'])->assertStatus(422);
        $this->salvar($c, $c->ana, ['classe' => str_repeat('a', 81)])->assertStatus(422);
        $this->assertNull($c->aria->fresh()->ficha);
    }

    public function test_texto_pode_ser_limpo_com_string_vazia(): void
    {
        $c = $this->cenario();
        $this->salvar($c, $c->ana, ['classe' => 'Clérigo'])->assertOk();
        $r = $this->salvar($c, $c->ana, ['classe' => ''])->assertOk()->json();

        $this->assertSame('', $r['ficha']['classe']); // fiel: nem vira null
    }

    public function test_lista_e_trocada_por_inteiro_e_o_conteudo_e_validado(): void
    {
        $c = $this->cenario();
        $maca = $c->mesa->itens()->create(['nome' => 'Maça', 'peso' => 2]);
        $this->salvar($c, $c->mestre, ['inventario' => [['secao' => 'Armas', 'itens' => [['item_id' => $maca->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false]]], ['secao' => 'Vazia', 'itens' => []]]])->assertOk();
        $this->assertSame($maca->id, $c->aria->fresh()->ficha['inventario'][0]['itens'][0]['item_id']);

        $ruim = [['secao' => 'Armas', 'itens' => [['item_id' => $maca->id, 'qtd' => 'um', 'equipado' => true, 'sintonizado' => false]]]];
        $this->salvar($c, $c->ana, ['inventario' => $ruim])->assertStatus(422)->assertJsonValidationErrors('campos.inventario.0.itens.0.qtd');
        $this->assertSame(1, $c->aria->fresh()->ficha['inventario'][0]['itens'][0]['qtd']); // não foi trocada
    }

    public function test_lote_da_criacao_e_atomico_e_a_etapa_fica_salva(): void
    {
        $c = $this->cenario();
        $etapa = ['classe' => 'Clérigo', 'nivel' => 1, 'atributos.sab' => 17, 'atributos.con' => 15];

        $r = $this->salvar($c, $c->ana, $etapa, ['criacao' => ['etapa' => 'atributos', 'concluida' => false]])->assertOk()->json();
        $this->assertSame(['etapa' => 'atributos', 'concluida' => false], $r['criacao']);
        $p = $c->aria->fresh();
        $this->assertSame(17, $p->ficha['atributos']['sab']);
        $this->assertSame('Clérigo', $p->ficha['classe']);
        $this->assertSame('atributos', $p->criacao['etapa']);

        // Um campo inválido no lote derruba o lote inteiro e não mexe na etapa.
        $this->salvar($c, $c->ana, ['classe' => 'Mago', 'atributos.sab' => 99], ['criacao' => ['etapa' => 'pericias', 'concluida' => false]])->assertStatus(422);
        $p = $c->aria->fresh();
        $this->assertSame('Clérigo', $p->ficha['classe']);
        $this->assertSame('atributos', $p->criacao['etapa']);

        // Edição pontual sem `criacao` preserva a etapa; `criacao: null` encerra a criação guiada.
        $this->salvar($c, $c->ana, ['pv.atual' => 5])->assertOk();
        $this->assertSame('atributos', $c->aria->fresh()->criacao['etapa']);
        $this->salvar($c, $c->ana, ['pv.max' => 9], ['criacao' => null])->assertOk();
        $this->assertNull($c->aria->fresh()->criacao);
    }

    public function test_etapa_de_criacao_exige_nome_da_etapa(): void
    {
        $c = $this->cenario();
        $this->salvar($c, $c->ana, ['nivel' => 2], ['criacao' => ['concluida' => true]])->assertStatus(422);
    }

    public function test_mudanca_vai_so_ao_mestre_e_aos_jogadores_do_personagem(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $this->salvar($c, $c->ana, ['pv.atual' => 7])->assertOk();

        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->nome === 'ficha'
            && $e->canais === ['mestre', "jogador.{$c->ana->id}"]
            && $e->payload['personagem_id'] === $c->aria->id
            && $e->payload['campos'] === ['pv.atual' => 7]
            && $e->payload['ator'] === $c->ana->id);
        Event::assertNotDispatched(EventoMesa::class, fn ($e) => in_array('mesa', $e->canais, true) || in_array("jogador.{$c->bia->id}", $e->canais, true));
    }

    public function test_ficha_so_chega_a_quem_controla_o_personagem(): void
    {
        $c = $this->cenario();
        $this->salvar($c, $c->ana, ['pv.atual' => 12])->assertOk();

        $ver = fn (Jogador $p) => collect($this->como($p)->get(route('jogo', [$c->mesa->slug, $p->id]))->viewData('page')['props']['personagens'])->firstWhere('id', $c->aria->id);

        $this->assertSame(12, $ver($c->ana)['ficha']['pv']['atual']);
        $this->assertSame(12, $ver($c->mestre)['ficha']['pv']['atual']);
        $this->assertArrayNotHasKey('ficha', $ver($c->bia)); // a mesa vê o personagem, mas não a ficha
        $this->assertArrayNotHasKey('criacao', $ver($c->bia));
    }

    public function test_personagem_sem_ficha_salva_chega_com_a_ficha_padrao(): void
    {
        $c = $this->cenario();
        $p = collect($this->como($c->ana)->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->viewData('page')['props']['personagens'])->firstWhere('id', $c->aria->id);

        $this->assertSame(FichaDnd5e::padrao(), $p['ficha']);
        $this->assertNull($p['criacao']);
    }

    public function test_sistema_sem_modulo_nao_tem_ficha(): void
    {
        $c = $this->cenario('one-piece');
        $this->salvar($c, $c->mestre, ['classe' => 'X'])->assertStatus(422)->assertJsonValidationErrors('campos');
    }

    public function test_valores_derivados_nao_sao_campos_salvos_e_os_ajustes_sao(): void
    {
        $c = $this->cenario();
        // CA, iniciativa, bônus de proficiência, CD, carga... são calculados: não existem para gravar.
        foreach (['ca', 'iniciativa', 'bonusProficiencia', 'magias.cd', 'magias.ataque', 'carga.atual', 'carga.max', 'xp.proximo', 'dadosVida.max', 'magias.preparadas.atual'] as $derivado) {
            $this->salvar($c, $c->ana, [$derivado => 5])->assertStatus(422)->assertJsonValidationErrors("campos.{$derivado}");
        }
        // O que se edita à mão é o ajuste, que soma ao calculado.
        $this->salvar($c, $c->ana, ['ajustes.ca' => 2, 'ajustes.pericias.percepcao' => 1, 'ajustes.salvaguardas.sab' => 1, 'ajustes.cargaMax' => -10])->assertOk();
        $this->salvar($c, $c->ana, ['ajustes.ca' => 21])->assertStatus(422);
        $this->salvar($c, $c->ana, ['ajustes.xyz' => 1])->assertStatus(422);
        $this->assertSame(2, $c->aria->fresh()->ficha['ajustes']['ca']);
    }

    public function test_condicoes_sao_salvas_e_validadas_contra_o_catalogo(): void
    {
        $c = $this->cenario();
        $r = $this->salvar($c, $c->ana, ['condicoes' => ['envenenado', 'caido']])->assertOk()->json();
        $this->assertSame(['envenenado', 'caido'], $r['ficha']['condicoes']);

        $this->salvar($c, $c->ana, ['condicoes' => ['zumbificado']])->assertStatus(422)->assertJsonValidationErrors('campos.condicoes.0');
        $this->salvar($c, $c->ana, ['condicoes' => ['cego', 'cego']])->assertStatus(422);   // sem repetição
        $this->salvar($c, $c->ana, ['condicoes' => 'cego'])->assertStatus(422);
        $this->salvar($c, $c->ana, ['condicoes' => [1]])->assertStatus(422);
        $this->assertSame(['envenenado', 'caido'], $c->aria->fresh()->ficha['condicoes']);

        $this->salvar($c, $c->ana, ['condicoes' => []])->assertOk(); // limpar vale
        $this->assertSame([], $c->aria->fresh()->ficha['condicoes']);
    }

    public function test_condicao_chega_ao_mestre_e_ao_dono_ao_vivo(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $this->salvar($c, $c->ana, ['condicoes' => ['cego']])->assertOk();

        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->nome === 'ficha' && $e->canais === ['mestre', "jogador.{$c->ana->id}"] && $e->payload['campos'] === ['condicoes' => ['cego']]);
    }

    public function test_ficha_padrao_passa_nas_proprias_regras(): void
    {
        $c = $this->cenario();
        // Reenviar a ficha padrão inteira, campo a campo, tem que ser aceito (regras e padrão coerentes).
        $campos = [];
        foreach (array_keys(array_filter(FichaDnd5e::regras(), fn ($_, $k) => ! str_contains($k, '*'), ARRAY_FILTER_USE_BOTH)) as $caminho) {
            $campos[$caminho] = data_get(FichaDnd5e::padrao(), $caminho);
        }
        $this->salvar($c, $c->mestre, $campos)->assertOk();
        $this->assertSame(FichaDnd5e::padrao(), $c->aria->fresh()->ficha);
    }
}
