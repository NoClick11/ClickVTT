<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Mesa;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** NPCs: só o mestre cria; a cópia que vai ao mapa tem PV, PP e usos próprios e nome numerado. */
class NpcTest extends TestCase
{
    use RefreshDatabase;

    private Mesa $mesa;

    private Jogador $mestre;

    private Jogador $ana;

    protected function setUp(): void
    {
        parent::setUp();
        $this->mesa = User::factory()->create()->mesas()->create([
            'nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);
        $this->mestre = $this->mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $this->ana = $this->mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
    }

    private function como(Jogador $j)
    {
        return $this->withSession(['acesso_mesas' => [$j->mesa_id => [$j->id => true]]])->withHeader('X-Jogador', (string) $j->id);
    }

    private function dados(string $nome = 'Pirata'): array
    {
        return ['nome' => $nome, 'campos' => [
            'npc' => ['nd' => '2', 'pp' => 10, 'pv' => ['medio' => 90, 'dados' => '12d10+24'], 'ataques' => []],
            'pv.atual' => 90, 'pv.max' => 90, 'pp.atual' => 10,
            'atributos.for' => 16, 'ajustes.ca' => 5,
        ]];
    }

    public function test_so_o_mestre_cria_npc(): void
    {
        $this->como($this->ana)->postJson(route('jogo.npcs.store', $this->mesa->id), $this->dados())->assertForbidden();
        $this->assertSame(0, $this->mesa->personagens()->count());
    }

    public function test_cria_npc_sem_jogadores_com_o_bloco_npc_e_nome_unico(): void
    {
        $r = $this->como($this->mestre)->postJson(route('jogo.npcs.store', $this->mesa->id), $this->dados())->assertCreated();
        $this->assertSame('Pirata', $r->json('nome'));
        $this->assertSame([], $r->json('jogadores'));
        $this->assertSame(90, $r->json('ficha.pv.max'));
        $this->assertSame('12d10+24', $r->json('ficha.npc.pv.dados'));

        $outro = $this->como($this->mestre)->postJson(route('jogo.npcs.store', $this->mesa->id), $this->dados())->assertCreated();
        $this->assertSame('Pirata 1', $outro->json('nome'));
    }

    public function test_campo_desconhecido_ou_sem_o_bloco_npc_e_recusado(): void
    {
        $semNpc = $this->dados();
        unset($semNpc['campos']['npc']);
        $this->como($this->mestre)->postJson(route('jogo.npcs.store', $this->mesa->id), $semNpc)->assertStatus(422);
        $ruim = $this->dados();
        $ruim['campos']['inexistente'] = 1;
        $this->como($this->mestre)->postJson(route('jogo.npcs.store', $this->mesa->id), $ruim)->assertStatus(422);
    }

    public function test_instancia_tem_vida_propria_e_nome_numerado(): void
    {
        $modelo = $this->como($this->mestre)->postJson(route('jogo.npcs.store', $this->mesa->id), $this->dados())->json();
        $url = fn ($id) => route('jogo.personagens.instanciar', [$this->mesa->id, $id]);

        $a = $this->como($this->mestre)->postJson($url($modelo['id']))->assertCreated()->json();
        $b = $this->como($this->mestre)->postJson($url($modelo['id']))->assertCreated()->json();
        $this->assertSame(['Pirata 1', 'Pirata 2'], [$a['nome'], $b['nome']]);
        $this->assertSame($modelo['id'], $a['ficha']['npc']['instancia_de']);
        $this->assertSame(10, $a['ficha']['pp']['atual']);

        // copiar uma cópia continua numerando a partir do mesmo modelo
        $c = $this->como($this->mestre)->postJson($url($a['id']))->assertCreated()->json();
        $this->assertSame('Pirata 3', $c['nome']);
        $this->assertSame($modelo['id'], $c['ficha']['npc']['instancia_de']);

        // o dano numa cópia não toca no modelo nem nas outras
        $this->como($this->mestre)->patchJson(route('jogo.personagens.ficha', [$this->mesa->id, $a['id']]), ['campos' => ['pv.atual' => 12]])->assertOk();
        $this->assertSame(90, $this->mesa->personagens()->find($modelo['id'])->ficha['pv']['atual']);
        $this->assertSame(90, $this->mesa->personagens()->find($b['id'])->ficha['pv']['atual']);

        // uma cópia nova nasce com PV cheio mesmo que o modelo esteja ferido
        $this->como($this->mestre)->patchJson(route('jogo.personagens.ficha', [$this->mesa->id, $modelo['id']]), ['campos' => ['pv.atual' => 5]])->assertOk();
        $d = $this->como($this->mestre)->postJson($url($modelo['id']))->assertCreated()->json();
        $this->assertSame(90, $d['ficha']['pv']['atual']);
    }

    public function test_personagem_comum_nao_vira_instancia(): void
    {
        $p = $this->mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $this->como($this->mestre)->postJson(route('jogo.personagens.instanciar', [$this->mesa->id, $p->id]))->assertStatus(422);
    }

    public function test_a_copia_some_com_o_ultimo_token_mas_o_modelo_fica(): void
    {
        $pagina = $this->mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);
        $modelo = $this->como($this->mestre)->postJson(route('jogo.npcs.store', $this->mesa->id), $this->dados())->json();
        $copia = $this->como($this->mestre)->postJson(route('jogo.personagens.instanciar', [$this->mesa->id, $modelo['id']]))->json();
        $token = fn ($id, $x) => $pagina->objetos()->create(['camada' => 'jogadores', 'tipo' => 'token', 'personagem_id' => $id, 'nome' => 'T', 'x' => $x, 'y' => 0, 'largura' => 70, 'altura' => 70, 'z' => 1]);
        $t1 = $token($copia['id'], 0);
        $t2 = $token($copia['id'], 100);
        $tm = $token($modelo['id'], 200);

        $this->como($this->mestre)->deleteJson(route('jogo.objetos.destroy', [$this->mesa->id, $t1->id]))->assertOk();
        $this->assertNotNull($this->mesa->personagens()->find($copia['id'])); // ainda tem outro token
        $this->como($this->mestre)->deleteJson(route('jogo.objetos.destroy', [$this->mesa->id, $t2->id]))->assertOk();
        $this->assertNull($this->mesa->personagens()->find($copia['id']));
        $this->como($this->mestre)->deleteJson(route('jogo.objetos.destroy', [$this->mesa->id, $tm->id]))->assertOk();
        $this->assertNotNull($this->mesa->personagens()->find($modelo['id'])); // o modelo nunca some
    }

    public function test_ataque_do_npc_contra_o_alvo_rola_contra_a_defesa_e_libera_o_dano_no_acerto(): void
    {
        $npc = $this->como($this->mestre)->postJson(route('jogo.npcs.store', $this->mesa->id), $this->dados())->json();
        $aria = $this->mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $aria->jogadores()->attach($this->ana);
        $rolar = fn (string $expressao, array $tecnica) => $this->como($this->mestre)->postJson(route('jogo.rolagens.store', $this->mesa->id), [
            'expressao' => $expressao, 'rotulo' => 'Sabre', 'visibilidade' => 'todos', 'personagem_id' => $npc['id'], 'alvo_personagem_id' => $aria->id,
            'tecnica' => ['nome' => 'Sabre', 'dano' => ['expressao' => '1d6+2', 'tipo' => 'Cortante'], 'semTecnica' => true, ...$tecnica],
        ]);

        // sem combate em curso: acerta (bônus enorme e o maior de 10 d20, para não depender de um 1 natural) e a rolagem traz o resultado e o botão de dano
        $acerto = $rolar('10d20kh1+100', ['ataque' => true, 'margem' => 20])->assertCreated()->json('dados.sistema');
        $this->assertSame('resolvido', $acerto['resolucao']['estado']);
        $this->assertTrue($acerto['resolucao']['acerto']);
        $this->assertSame('1d6+2', $acerto['acoes'][0]['expressao']);
        $this->assertTrue($acerto['tecnica']['semTecnica']); // o dano conta como ataque, não como Técnica

        // erra (bônus negativo, a menos de um 20 natural): a resolução existe e o dano fica para o card esconder
        $erro = $rolar('10d20kl1-100', ['ataque' => true])->assertCreated()->json('dados.sistema');
        $this->assertSame('resolvido', $erro['resolucao']['estado']);
        $this->assertFalse($erro['resolucao']['acerto'] && ! $erro['resolucao']['critico']);

        // sem o sinal de ataque a rolagem literal continua sendo uma rolagem comum (nada de resolução)
        $comum = $rolar('1d20+100', [])->assertCreated()->json('dados.sistema');
        $this->assertArrayNotHasKey('resolucao', $comum ?? []);
    }
}
