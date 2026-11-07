<?php

namespace Tests\Feature\Jogo;

use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** O servidor refaz o custo e os limites das técnicas criadas no Criador de Técnicas. */
class CriadorTecnicasTest extends TestCase
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

    private function editar($c, Jogador $quem, array $campos)
    {
        return $this->withSession(['acesso_mesas' => [$quem->mesa_id => [$quem->id => true]]])->withHeader('X-Jogador', (string) $quem->id)
            ->patchJson(route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]), ['campos' => $campos]);
    }

    private function tecnica(int $grau, int $dados, int $custo, array $criador = []): array
    {
        $escolhas = array_replace([
            'tipo' => 'combate', 'grau' => $grau, 'forma' => 'base', 'origem' => ['tipo' => 'nivel'], 'alvo' => 'unico', 'modoDoDano' => 'ataque',
            'dados' => $dados, 'intensificado' => false, 'formaDeAlcance' => 'linha', 'alcance' => 9, 'acao' => 'poderosa', 'ataque' => true,
            'salvaguarda' => false, 'tipoDano' => 'Fogo', 'efeitos' => [],
        ], $criador);

        return ['nome' => 'Chama', 'origem' => 'Técnica', 'custo' => $custo, 'alcance' => '9 m em Linha', 'efeito' => 'Dano', 'descricao' => '', 'rolagem' => "{$dados}d10", 'builder' => 'criador', 'criador' => $escolhas];
    }

    public function test_jogador_cria_tecnica_valida_mas_nao_acima_do_nivel_nem_com_custo_adulterado(): void
    {
        $c = $this->cenario();
        $base = ['akuma.tipo' => 'paramecia', 'nivel' => 1];
        $this->editar($c, $c->mestre, $base)->assertOk();

        $this->editar($c, $c->ana, ['akuma.lista' => [$this->tecnica(1, 2, 2)]])->assertOk();
        $this->assertSame('criador', $c->aria->fresh()->ficha['akuma']['lista'][0]['builder']);

        // 2º grau no nível 1; custo menor que o real; sem o criador (tentativa de driblar).
        $this->editar($c, $c->ana, ['akuma.lista' => [$this->tecnica(2, 4, 4, ['alcance' => 15])]])->assertStatus(422);
        $this->editar($c, $c->ana, ['akuma.lista' => [$this->tecnica(1, 2, 1)]])->assertStatus(422);
        $semCriador = $this->tecnica(1, 2, 2);
        unset($semCriador['criador']);
        $this->editar($c, $c->ana, ['akuma.lista' => [$semCriador]])->assertStatus(422);
        // Duas técnicas do mesmo grau (só há um espaço de 1º grau).
        $this->editar($c, $c->ana, ['akuma.lista' => [$this->tecnica(1, 2, 2), [...$this->tecnica(1, 2, 2), 'nome' => 'Outra']]])->assertStatus(422);
    }

    public function test_tecnica_de_estilo_so_pela_genialidade_inusitada(): void
    {
        $c = $this->cenario();
        $this->editar($c, $c->ana, ['tecnicas.lista' => [$this->tecnica(1, 2, 2)]])->assertStatus(422);

        $genialidade = ['origem' => ['tipo' => 'genialidade', 'indice' => 1]];
        $this->editar($c, $c->ana, ['tecnicas.lista' => [$this->tecnica(1, 2, 2, $genialidade)]])->assertStatus(422); // ainda não aprendeu
        $this->editar($c, $c->mestre, ['treinamento.aprendidos' => [['id' => 'genialidade-inusitada', 'nivel' => 1]]])->assertOk();
        $this->editar($c, $c->ana, ['tecnicas.lista' => [$this->tecnica(1, 2, 2, $genialidade)]])->assertOk();
    }

    public function test_jogador_nao_desperta_a_fruta_nem_muda_a_categoria_definida(): void
    {
        $c = $this->cenario();
        $this->editar($c, $c->ana, ['akuma.despertada' => true])->assertForbidden();
        $this->editar($c, $c->mestre, ['akuma.despertada' => true, 'akuma.tipo' => 'paramecia', 'akuma.categoria' => 'a'])->assertOk();
        $this->editar($c, $c->ana, ['akuma.categoria' => 's'])->assertForbidden();
        $this->editar($c, $c->ana, ['akuma.usuario' => 'avancado'])->assertOk();
    }

    public function test_perfil_da_akuma_so_aceita_o_que_as_regras_permitem(): void
    {
        $c = $this->cenario();
        $this->editar($c, $c->mestre, ['akuma.tipo' => 'paramecia', 'akuma.categoria' => 'c'])->assertOk();
        // MP Especial de categoria A/S numa C; e acima do limite de MPs.
        $this->editar($c, $c->ana, ['akuma.mpEspeciais' => ['destruidor']])->assertStatus(422);
        $this->editar($c, $c->ana, ['akuma.mpEspeciais' => ['orbes']])->assertOk();
        $this->editar($c, $c->ana, ['akuma.mpEspeciais' => ['orbes', 'habilidade-refinada']])->assertStatus(422);
        // As características geradas (builder akuma) são gravadas junto.
        $this->editar($c, $c->ana, [
            'caracteristicas' => [['nome' => 'Orbes', 'origem' => 'Akuma no Mi: MP Especial', 'tipo' => 'passiva', 'builder' => 'akuma', 'descricao' => 'x']],
        ])->assertOk();
        $this->assertSame('akuma', $c->aria->fresh()->ficha['caracteristicas'][0]['builder']);
    }

    public function test_zoan_cria_points_e_tecnica_dentro_do_point(): void
    {
        $c = $this->cenario();
        $this->editar($c, $c->mestre, ['akuma.tipo' => 'zoan', 'akuma.zoan' => 'comum', 'nivel' => 3])->assertOk();
        $tecnica = fn (array $o) => [...$this->tecnica(2, 4, 4, ['alcance' => 15, 'origem' => ['tipo' => 'point', 'ponto' => 2]]), ...$o];
        // sem o Point próprio criado
        $this->editar($c, $c->ana, ['akuma.lista' => [$tecnica([])]])->assertStatus(422);
        $this->editar($c, $c->ana, ['akuma.points' => [['ponto' => 1, 'modelo' => 'heavy-point'], ['ponto' => 2, 'modelo' => 'custom']]])->assertOk();
        $this->editar($c, $c->ana, ['akuma.lista' => [$tecnica([])]])->assertOk();
        // o 3º Point ainda não (nível 6); modelo repetido não
        $this->editar($c, $c->ana, ['akuma.points' => [['ponto' => 1, 'modelo' => 'heavy-point'], ['ponto' => 2, 'modelo' => 'custom'], ['ponto' => 3, 'modelo' => 'arm-point']]])->assertStatus(422);
        $this->editar($c, $c->ana, ['akuma.points' => [['ponto' => 1, 'modelo' => 'arm-point'], ['ponto' => 2, 'modelo' => 'arm-point']]])->assertStatus(422);
        // Técnica comum (pelo nível) numa Zoan Comum não vale
        $this->editar($c, $c->ana, ['akuma.lista' => [$this->tecnica(1, 2, 2)]])->assertStatus(422);
    }

    public function test_individualidades_sao_opcionais_e_o_servidor_confere_pares_espacos_e_o_que_e_do_mestre(): void
    {
        $c = $this->cenario();
        $par = fn (array $s, array $d) => ['individualidades.singularidades' => $s, 'individualidades.defeitos' => $d];
        // Opcional: ficha sem nada continua salvando; com um Defeito de menos, não.
        $this->editar($c, $c->ana, ['fruta' => 'Nenhuma'])->assertOk();
        $this->editar($c, $c->ana, $par([['id' => 'bom-senso']], []))->assertStatus(422);
        $this->editar($c, $c->ana, $par([['id' => 'bom-senso']], [['id' => 'mudo']]))->assertOk();
        // Passa dos 5 espaços (forte 4 + média 3).
        $this->editar($c, $c->ana, $par([['id' => 'zona'], ['id' => 'ator']], [['id' => 'pacifista'], ['id' => 'paranoico']]))->assertStatus(422);
        // Ambição do Rei e campos de regra são do mestre.
        $this->editar($c, $c->ana, $par([['id' => 'ambicao-do-rei']], [['id' => 'pacifista']]))->assertForbidden();
        $this->editar($c, $c->ana, ['individualidades.extras' => 2])->assertForbidden();
        $this->editar($c, $c->ana, ['individualidades.variaveis' => true])->assertForbidden();
        $this->editar($c, $c->mestre, ['individualidades.extras' => 2, 'individualidades.variaveis' => true])->assertOk();
        // Depois que o mestre trava, o jogador não troca mais.
        $this->editar($c, $c->mestre, ['individualidades.travada' => true])->assertOk();
        $this->editar($c, $c->ana, $par([['id' => 'bom-senso'], ['id' => 'amante']], [['id' => 'mudo'], ['id' => 'voz-fina']]))->assertForbidden();
    }

    public function test_ambicao_do_rei_e_haki_inato_so_o_mestre_concede(): void
    {
        $c = $this->cenario();
        $par = fn (string $id, string $defeito) => ['individualidades.singularidades' => [['id' => $id]], 'individualidades.defeitos' => [['id' => $defeito]]];
        $this->editar($c, $c->ana, $par('ambicao-do-rei', 'pacifista'))->assertForbidden();
        $this->editar($c, $c->ana, $par('haki-observacao-inato', 'paranoico'))->assertForbidden();
        // o mestre concede (e acerta o Haki junto)
        $this->editar($c, $c->mestre, [...$par('haki-observacao-inato', 'paranoico'), 'haki.principal' => 'observacao', 'nivel' => 8])->assertOk();
        $h = \App\Sistemas\OnePiece\Haki::resumoDosPA($c->aria->fresh()->ficha);
        $this->assertGreaterThanOrEqual(10, $h['ganhosGerais']); // 5 do 8º nível + 5 do Haki Inato
        // com a Singularidade, o jogador não troca o Haki principal
        $this->editar($c, $c->ana, ['haki.principal' => 'armamento'])->assertForbidden();
    }

    public function test_pau_para_toda_obra_permite_uma_segunda_profissao_inicial(): void
    {
        $c = $this->cenario();
        $lista = fn (array $extra) => ['profissoes.lista' => [['id' => 'medico', 'graduacao' => 0, 'nivel' => 1], ...$extra]];
        $segunda = [['id' => 'cozinheiro', 'graduacao' => 0, 'nivel' => 1, 'secundaria' => true]];
        $this->editar($c, $c->ana, $lista([]))->assertOk();
        // sem a Singularidade a segunda não vale
        $this->editar($c, $c->ana, $lista($segunda))->assertStatus(422);
        $this->editar($c, $c->mestre, ['individualidades.singularidades' => [['id' => 'pau-para-toda-obra']], 'individualidades.defeitos' => [['id' => 'pacifista']]])->assertOk();
        $this->editar($c, $c->ana, $lista($segunda))->assertOk();
        $this->assertTrue($c->aria->fresh()->ficha['profissoes']['lista'][1]['secundaria']);
        // só uma segunda
        $this->editar($c, $c->ana, $lista([...$segunda, ['id' => 'ferreiro', 'graduacao' => 0, 'nivel' => 1, 'secundaria' => true]]))->assertStatus(422);
    }

    public function test_servidor_aceita_as_formulas_de_efeito_da_automacao_da_akuma(): void
    {
        $c = $this->cenario();
        $efeitos = [
            ['alvo' => 'pv.max', 'modo' => 'base', 'valor' => '42+22*(@nivel-1)-5*(floor((@nivel+1)/5)+floor(@nivel/5))'],
            ['alvo' => 'salv.for', 'modo' => 'soma', 'valor' => 'max(0,10-@mod.for)'],
            ['alvo' => 'pericia.atletismo', 'modo' => 'soma', 'valor' => 'max(0,10-@mod.for)'],
            ['alvo' => 'pv.max', 'modo' => 'soma', 'valor' => 50],
        ];
        $this->editar($c, $c->ana, [
            'caracteristicas' => [['nome' => 'Físico Animalesco (Heavy Point)', 'origem' => 'Heavy Point', 'tipo' => 'ativa', 'builder' => 'akuma', 'efeitos' => $efeitos, 'descricao' => 'x']],
        ])->assertOk();
        $this->assertSame('pv.max', $c->aria->fresh()->ficha['caracteristicas'][0]['efeitos'][0]['alvo']);
    }

    public function test_o_servidor_aceita_todos_os_itens_do_catalogo_criados_pelo_mestre(): void
    {
        $c = $this->cenario();
        $itens = json_decode(file_get_contents(base_path('tests/Fixtures/itens-da-mesa.json')), true);
        $this->assertGreaterThan(130, count($itens));
        $this->withoutMiddleware(\Illuminate\Routing\Middleware\ThrottleRequests::class);
        $sessao = ['acesso_mesas' => [$c->mestre->mesa_id => [$c->mestre->id => true]]];
        foreach ($itens as $corpo) {
            $r = $this->withSession($sessao)->withHeader('X-Jogador', (string) $c->mestre->id)->postJson(route('jogo.itens.store', [$c->mesa->id]), $corpo);
            $r->assertCreated();
            $this->assertSame($corpo['dados']['catalogo']['id'], $r->json('dados.catalogo.id'), $corpo['nome']);
            if (isset($corpo['dados']['arma'])) {
                $this->assertSame($corpo['dados']['arma']['dano'], $r->json('dados.arma.dano'), $corpo['nome']);
            }
        }
        // o jogador não cria itens (nem do catálogo)
        $this->withSession(['acesso_mesas' => [$c->ana->mesa_id => [$c->ana->id => true]]])->withHeader('X-Jogador', (string) $c->ana->id)
            ->postJson(route('jogo.itens.store', [$c->mesa->id]), $itens[0])->assertForbidden();
    }
}
