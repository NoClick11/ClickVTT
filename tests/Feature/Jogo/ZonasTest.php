<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Objeto;
use App\Models\Sistema;
use App\Models\User;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** Zonas do mapa: só o mestre cria, a oculta nunca vai ao jogador, e o dano vem ao entrar e no início do turno (com as defesas do alvo). */
class ZonasTest extends TestCase
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
        $ficha = [...FichaOnePiece::padrao(), 'pv' => ['atual' => 30, 'max' => 30, 'temp' => 0]];
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $aria->forceFill(['ficha' => $ficha])->save();
        $aria->jogadores()->attach($ana);
        $bruno = $mesa->personagens()->create(['nome' => 'Bruno', 'cor' => '#ef4444']);
        $bruno->forceFill(['ficha' => [...$ficha, 'resistencias' => ['fogo']]])->save();
        $bruno->jogadores()->attach($bia);
        $orc = $mesa->personagens()->create(['nome' => 'Orc', 'cor' => '#555555']);
        $orc->forceFill(['ficha' => $ficha])->save();
        $pagina = $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1, 'tamanho_quadrado' => 100, 'distancia_quadrado' => 1.5, 'unidade' => 'm']);
        $token = fn ($p, $x) => $pagina->objetos()->create(['camada' => 'jogadores', 'tipo' => 'token', 'personagem_id' => $p->id, 'nome' => $p->nome, 'x' => $x, 'y' => 0, 'largura' => 50, 'altura' => 50, 'z' => 1]);

        return (object) ['mesa' => $mesa, 'mestre' => $mestre, 'ana' => $ana, 'bia' => $bia, 'aria' => $aria, 'bruno' => $bruno, 'orc' => $orc, 'pagina' => $pagina,
            'tAria' => $token($aria, 0), 'tBruno' => $token($bruno, 100), 'tOrc' => $token($orc, 200)];
    }

    private function como(Jogador $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => [$p->id => true]]])->withHeader('X-Jogador', (string) $p->id);
    }

    /** Esfera de 3 m (200 px, com 1,5 m a cada 100 px) centrada em (400, 25). */
    private function zona($c, string $camada = 'mestre', array $dados = [], array $caixa = []): array
    {
        $corpo = ['camada' => $camada, 'tipo' => 'zona', 'nome' => 'Brasa', ...($caixa ?: ['x' => 200, 'y' => -175, 'largura' => 400, 'altura' => 400]),
            'dados' => ['forma' => 'esfera', 'metros' => 3, 'dano_dados' => '2d6', 'dano_tipo' => 'fogo', 'terreno_dificil' => true, ...$dados]];

        return $this->como($c->mestre)->postJson(route('jogo.objetos.store', [$c->mesa->id, $c->pagina->id]), $corpo)->assertCreated()->json();
    }

    private function pv($personagem): int
    {
        return (int) $personagem->fresh()->fichaCompleta(app(RegistroSistemas::class)->resolver('one-piece'))['pv']['atual'];
    }

    private function combate($c): void
    {
        $e = $this->como($c->mestre)->postJson(route('jogo.combate.comando', $c->mesa->id), ['comando' => 'iniciar', 'pagina_id' => $c->pagina->id])->json('combate');
        foreach (['Aria' => 10, 'Bruno' => 20, 'Orc' => 1] as $nome => $v) {
            $id = collect($e['itens'])->firstWhere('nome', $nome)['id'];
            $this->como($c->mestre)->postJson(route('jogo.combate.comando', $c->mesa->id), ['comando' => 'definir_iniciativa', 'item_id' => $id, 'iniciativa' => $v]);
        }
        $this->como($c->mestre)->postJson(route('jogo.combate.comando', $c->mesa->id), ['comando' => 'comecar']); // turno do Bruno
        $this->app->instance(Rolador::class, new Rolador(fn (int $faces) => 2)); // 2d6 = 4
    }

    public function test_so_o_mestre_cria_a_zona_e_a_oculta_nao_chega_ao_jogador(): void
    {
        $c = $this->cenario();
        $corpo = ['camada' => 'jogadores', 'tipo' => 'zona', 'x' => 0, 'y' => 0, 'largura' => 100, 'altura' => 100, 'dados' => ['forma' => 'esfera', 'metros' => 3]];
        $this->como($c->ana)->postJson(route('jogo.objetos.store', [$c->mesa->id, $c->pagina->id]), $corpo)->assertForbidden();

        $oculta = $this->zona($c, 'mestre');
        $visivel = $this->zona($c, 'jogadores');
        $dosJogadores = Objeto::query()->visivelAoJogador()->where('tipo', 'zona')->pluck('id')->all();
        $this->assertSame([$visivel['id']], $dosJogadores);

        // mostrar a zona oculta = mudar a camada
        $this->como($c->mestre)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $oculta['id']]), ['camada' => 'jogadores'])->assertOk();
        $this->assertCount(2, Objeto::query()->visivelAoJogador()->where('tipo', 'zona')->get());
    }

    public function test_quem_entra_na_zona_leva_o_dano_com_as_defesas_e_andar_dentro_dela_nao_fere_de_novo(): void
    {
        $c = $this->cenario();
        $this->zona($c);
        $this->combate($c);
        $mover = fn (Jogador $j, $token, $x) => $this->como($j)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $token->id]), ['x' => $x, 'y' => 0])->assertOk();

        $mover($c->bia, $c->tBruno, 300); // entra: 2d6 = 4 de fogo, Bruno resiste a fogo (metade = 2)
        $this->assertSame(28, $this->pv($c->bruno));
        $mover($c->bia, $c->tBruno, 320); // já estava dentro
        $this->assertSame(28, $this->pv($c->bruno));
    }

    public function test_no_inicio_do_turno_quem_esta_dentro_leva_o_dano_mas_zona_sem_dano_nao_fere(): void
    {
        $c = $this->cenario();
        $this->zona($c); // o Orc (centro 225, 25) está dentro desde o começo
        $this->zona($c, 'jogadores', ['dano_dados' => null, 'dano_tipo' => null]);
        $this->combate($c);

        $this->como($c->mestre)->postJson(route('jogo.combate.comando', $c->mesa->id), ['comando' => 'turno']); // Aria
        $this->assertSame(30, $this->pv($c->orc));
        $this->como($c->mestre)->postJson(route('jogo.combate.comando', $c->mesa->id), ['comando' => 'turno']); // Orc
        $this->assertSame(26, $this->pv($c->orc)); // 4 de fogo, sem resistência
        $this->assertSame(30, $this->pv($c->aria));
    }

    public function test_uma_zona_fina_fere_quem_a_atravessa_sem_parar_nela(): void
    {
        $c = $this->cenario();
        // linha de 3 m (200 px) na vertical em x = 800 (1,5 m de largura = 100 px); o token anda de x=500 até x=1100 por cima dela
        $this->zona($c, 'mestre', ['forma' => 'linha', 'metros' => 3, 'rotacao' => 90, 'dano_dados' => '2d6', 'dano_tipo' => 'cortante'], ['x' => 700, 'y' => -75, 'largura' => 200, 'altura' => 200]);
        $this->combate($c);
        $this->como($c->bia)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $c->tBruno->id]), ['x' => 500, 'y' => 0])->assertOk();
        $this->assertSame(30, $this->pv($c->bruno));
        $this->como($c->bia)->patchJson(route('jogo.objetos.update', [$c->mesa->id, $c->tBruno->id]), ['x' => 1100, 'y' => 0])->assertOk();
        $this->assertSame(26, $this->pv($c->bruno)); // 4 de cortante (Bruno só resiste a fogo)
    }
}
