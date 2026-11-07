<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Os endpoints das Habilidades Básicas: Primeiros Socorros e Superioridade Absoluta. */
class HabilidadesBasicasTest extends TestCase
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
        $alvo = $mesa->personagens()->create(['nome' => 'Lunar', 'cor' => '#ef4444']);
        $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);

        return (object) compact('mesa', 'mestre', 'ana', 'aria', 'alvo');
    }

    private function como(Jogador $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => [$p->id => true]]])->withHeader('X-Jogador', (string) $p->id);
    }

    private function ficha($c, $personagem, array $campos): void
    {
        $this->como($c->mestre)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $personagem->id]), ['campos' => $campos])->assertOk();
    }

    public function test_primeiros_socorros_curam_dao_pv_temporarios_e_so_valem_uma_vez(): void
    {
        $c = $this->cenario();
        $this->ficha($c, $c->aria, ['nivel' => 3]);
        $this->ficha($c, $c->alvo, ['pv.max' => 100, 'pv.atual' => 10, 'condicoes' => ['envenenado', 'caido']]);

        $r = $this->como($c->ana)->postJson(route('jogo.personagens.socorros', [$c->mesa->id, $c->alvo->id]), ['socorrista_id' => $c->aria->id])->assertOk();
        $ficha = $c->alvo->fresh()->ficha;
        $this->assertSame(40, $ficha['pv']['atual']); // 10 + 10 por nível (3)
        $this->assertGreaterThanOrEqual(4, $ficha['pv']['temp']);
        $this->assertTrue($ficha['socorrido']);
        $this->assertSame(['caido'], array_values($ficha['condicoes'])); // só as quatro condições de socorro saem
        $this->assertStringContainsString('Primeiros Socorros', $r->json('texto'));

        $this->como($c->ana)->postJson(route('jogo.personagens.socorros', [$c->mesa->id, $c->alvo->id]), ['socorrista_id' => $c->aria->id])->assertUnprocessable();
        $this->como($c->ana)->postJson(route('jogo.personagens.socorros', [$c->mesa->id, $c->alvo->id]), ['socorrista_id' => $c->aria->id, 'so_condicoes' => true])->assertOk();
    }

    public function test_o_jogador_nao_socorre_com_o_personagem_dos_outros(): void
    {
        $c = $this->cenario();
        $this->como($c->ana)->postJson(route('jogo.personagens.socorros', [$c->mesa->id, $c->aria->id]), ['socorrista_id' => $c->alvo->id])->assertForbidden();
    }

    public function test_superioridade_absoluta_zera_o_alvo_quando_sobra_pouco_e_acumula_bonus(): void
    {
        $c = $this->cenario();
        $this->ficha($c, $c->aria, [
            'nivel' => 5,
            'caracteristicas' => [['nome' => 'Superioridade Absoluta', 'origem' => 'Estilo', 'tipo' => 'passiva', 'descricao' => '', 'hb' => 'superioridade-absoluta']],
        ]);
        $this->ficha($c, $c->alvo, ['pv.max' => 30, 'pv.atual' => 14]);
        $rolar = fn () => $this->como($c->ana)->postJson(route('jogo.rolagens.store', $c->mesa->id), [
            'expressao' => '10', 'rotulo' => 'Golpe', 'visibilidade' => 'todos', 'personagem_id' => $c->aria->id, 'dano' => ['tipo' => 'cortante'],
        ])->assertCreated()->json('id');

        // 14 - 10 = 4 <= nível 5: o alvo cai a 0 e o atacante ganha +5
        $this->como($c->ana)->postJson(route('jogo.personagens.dano', [$c->mesa->id, $c->alvo->id]), ['mensagem_id' => $rolar()])->assertOk();
        $this->assertSame(0, $c->alvo->fresh()->ficha['pv']['atual']);
        $this->assertSame(5, $c->aria->fresh()->ficha['bonusExecucao']);
    }

    /**
     * O que o assistente gera para um Atirador de 20º nível (estilo, as 19 Habilidades Básicas, técnicas) passa na validação
     * do servidor. O arquivo vem de `camposDaCriacao` (TS): refaça-o se o catálogo mudar de forma.
     */
    public function test_a_ficha_gerada_pelo_assistente_passa_na_validacao_do_servidor(): void
    {
        $c = $this->cenario();
        $campos = json_decode(file_get_contents(base_path('tests/Fixtures/atirador-nivel-20.json')), true);

        $this->como($c->mestre)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), ['campos' => $campos])->assertOk();

        $ficha = $c->aria->fresh()->ficha;
        $this->assertSame('atirador', $ficha['estiloId']);
        $this->assertGreaterThan(20, count($ficha['caracteristicas']));
        $this->assertContains('superioridade-absoluta', array_column($ficha['habilidadesBasicas'], 'id'));
    }

    /** Os 60 Traços de Maestria (e a técnica do Imaculado) gerados pelo assistente passam na validação do servidor. */
    public function test_os_tracos_de_maestria_passam_na_validacao_do_servidor(): void
    {
        $c = $this->cenario();
        $campos = json_decode(file_get_contents(base_path('tests/Fixtures/maestrias-todas.json')), true);

        $this->como($c->mestre)->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), ['campos' => $campos])->assertOk();

        $ficha = $c->aria->fresh()->ficha;
        $this->assertSame('barbaro', $ficha['maestria']);
        $this->assertCount(60, $ficha['caracteristicas']);
        $this->assertContains('Noryoku Hunter', array_column($ficha['tecnicas']['lista'], 'nome'));
    }
}
