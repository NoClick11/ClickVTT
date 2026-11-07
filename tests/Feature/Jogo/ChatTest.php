<?php

namespace Tests\Feature\Jogo;

use App\Events\EventoMesa;
use App\Models\Jogador;
use App\Models\Sistema;
use App\Models\User;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Sistemas\Dnd5e\FichaDnd5e;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Event;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\TestCase;

class ChatTest extends TestCase
{
    use RefreshDatabase;

    private function cenario(): object
    {
        $dono = User::factory()->create();
        $mesa = $dono->mesas()->create(['nome' => 'T', 'slug' => 't-'.uniqid(), 'sistema_id' => Sistema::value('id'), 'tema_entrada' => 'padrao']);
        $mestre = $mesa->jogadores()->create(['nome' => 'Mestre', 'papel' => 'mestre', 'cor' => '#d4a843']);
        $ana = $mesa->jogadores()->create(['nome' => 'Ana', 'papel' => 'jogador', 'cor' => '#2563eb']);
        $bia = $mesa->jogadores()->create(['nome' => 'Bia', 'papel' => 'jogador', 'cor' => '#16a34a']);
        $aria = $mesa->personagens()->create(['nome' => 'Aria', 'cor' => '#0ea5e9']);
        $aria->jogadores()->attach($ana);
        $pagina = $mesa->paginas()->create(['nome' => 'P', 'ordem' => 1]);

        return (object) compact('mesa', 'mestre', 'ana', 'bia', 'aria', 'pagina');
    }

    private function como(Jogador $p): static
    {
        return $this->withSession(['acesso_mesas' => [$p->mesa_id => [$p->id => true]]])->withHeader('X-Jogador', (string) $p->id);
    }

    private function rolar($c, Jogador $quem, array $corpo)
    {
        return $this->como($quem)->postJson(route('jogo.rolagens.store', $c->mesa->id), $corpo + ['expressao' => '1d20', 'visibilidade' => 'todos']);
    }

    public function test_rolagem_e_sorteada_no_servidor_dentro_do_intervalo(): void
    {
        $c = $this->cenario();
        foreach ([4, 6, 8, 10, 12, 20, 100] as $faces) {
            $r = $this->rolar($c, $c->ana, ['expressao' => "6d{$faces}", 'rotulo' => 'Teste'])->assertCreated()->json();
            $termo = $r['dados']['termos'][0];
            $this->assertCount(6, $termo['resultados']);
            foreach ($termo['resultados'] as $v) {
                $this->assertGreaterThanOrEqual(1, $v);
                $this->assertLessThanOrEqual($faces, $v);
            }
            $this->assertSame(array_sum($termo['resultados']), $r['dados']['total']);
            $this->assertSame("6d{$faces}", $r['dados']['expressao']);
            $this->assertSame('Teste', $r['dados']['rotulo']);
        }
    }

    public function test_rolagem_com_modificador_e_vantagem(): void
    {
        $c = $this->cenario();
        $r = $this->rolar($c, $c->ana, ['expressao' => '2d20kh1 + 5'])->assertCreated()->json();

        $dados = $r['dados']['termos'][0];
        $this->assertCount(1, $dados['descartados']);
        $this->assertSame(max($dados['resultados']) + 5, $r['dados']['total']);
        $this->assertSame('2d20kh1+5', $r['texto']);
    }

    public function test_rejeita_expressao_invalida_e_variavel_vinda_do_cliente(): void
    {
        $c = $this->cenario();
        $this->rolar($c, $c->ana, ['expressao' => '1d7x'])->assertStatus(422)->assertJsonValidationErrors('expressao');
        $this->rolar($c, $c->ana, ['expressao' => '201d6'])->assertStatus(422);
        $this->rolar($c, $c->ana, ['expressao' => '1d20+@mod.for'])->assertStatus(422); // sem personagem não há variáveis
        $this->rolar($c, $c->ana, ['expressao' => ''])->assertStatus(422);
        $this->rolar($c, $c->ana, ['visibilidade' => 'invalida'])->assertStatus(422);
    }

    public function test_variaveis_da_rolagem_vem_da_ficha_salva_no_servidor(): void
    {
        $c = $this->cenario();
        $c->aria->forceFill(['ficha' => array_replace_recursive(FichaDnd5e::padrao(), [
            'nivel' => 5, 'atributos' => ['for' => 16, 'sab' => 17], 'pericias' => ['percepcao' => 1],
        ])])->save();

        $r = $this->rolar($c, $c->ana, ['expressao' => '1d20+@mod.for+@pericia.percepcao+@prof', 'rotulo' => 'Teste', 'personagem_id' => $c->aria->id])->assertCreated()->json();

        $variaveis = collect($r['dados']['termos'])->where('tipo', 'variavel')->mapWithKeys(fn ($t) => [$t['nome'] => $t['valor']])->all();
        // FOR 16 = +3; Percepção = mod. SAB 17 (+3) + proficiência (nível 5 = +3); proficiência = +3
        $this->assertSame(['mod.for' => 3, 'pericia.percepcao' => 6, 'prof' => 3], $variaveis);
        $dado = $r['dados']['termos'][0]['resultados'][0];
        $this->assertSame($dado + 12, $r['dados']['total']);
    }

    public function test_rolagem_usa_armadura_e_arma_dos_itens_equipados(): void
    {
        $c = $this->cenario();
        $placas = $c->mesa->itens()->create(['nome' => 'Placas', 'peso' => 30, 'dados' => ['armadura' => ['tipo' => 'pesada', 'base' => 18]]]);
        $espada = $c->mesa->itens()->create(['nome' => 'Espada Longa +1', 'peso' => 3, 'dados' => ['arma' => ['dano' => '1d8', 'atributo' => 'for', 'proficiente' => true, 'bonusMagico' => 1]]]);
        $anel = $c->mesa->itens()->create(['nome' => 'Anel', 'peso' => 0, 'requer_sintonia' => true, 'efeitos' => [['alvo' => 'ca', 'modo' => 'soma', 'valor' => 1]]]);
        $ref = fn ($item, $equipado, $sint = false) => ['item_id' => $item->id, 'qtd' => 1, 'equipado' => $equipado, 'sintonizado' => $sint];
        $c->aria->forceFill(['ficha' => array_replace_recursive(FichaDnd5e::padrao(), [
            'nivel' => 5, 'atributos' => ['for' => 16, 'des' => 8],
            'inventario' => [['secao' => 'Equipamento', 'itens' => [$ref($placas, true), $ref($espada, true), $ref($anel, true, false)]]],
        ])])->save();

        $r = $this->rolar($c, $c->ana, ['expressao' => '1d20+@arma.'.$espada->id.'.ataque+@ca', 'personagem_id' => $c->aria->id])->assertCreated()->json();
        $variaveis = collect($r['dados']['termos'])->where('tipo', 'variavel')->mapWithKeys(fn ($t) => [$t['nome'] => $t['valor']])->all();

        // ataque = FOR +3, proficiência +3, +1 mágico = 7; CA = armadura pesada 18 (ignora DES 8); o anel sem sintonia não conta
        $this->assertSame(['arma.'.$espada->id.'.ataque' => 7, 'ca' => 18], $variaveis);

        $r = $this->rolar($c, $c->ana, ['expressao' => '1d8+@arma.'.$espada->id.'.dano', 'personagem_id' => $c->aria->id])->assertCreated()->json();
        $this->assertSame(4, $r['dados']['termos'][1]['valor']); // FOR +3, +1 mágico

        // Crítico: os dados do item dobram (2d8) e o modificador entra uma vez só.
        $r = $this->rolar($c, $c->ana, ['expressao' => '2d8+@arma.'.$espada->id.'.dano', 'personagem_id' => $c->aria->id])->assertCreated()->json();
        $this->assertCount(2, $r['dados']['termos'][0]['resultados']);
        $this->assertSame(array_sum($r['dados']['termos'][0]['resultados']) + 4, $r['dados']['total']);

        // O maior dano que um item aceita (50 dados), dobrado, cabe no limite do rolador.
        $this->rolar($c, $c->ana, ['expressao' => '100d4+@arma.'.$espada->id.'.dano', 'personagem_id' => $c->aria->id])->assertCreated();
    }

    /** Cenário com uma arma equipada de margem crítica `$margem`; o sorteio devolve os valores da fila (d20 fixo). */
    private function ataqueComArma(int $margem, array $sorteios, string $expressao = '1d20+@arma.%d.ataque', array $ficha = [], array $dadosArma = []): array
    {
        $c = $this->cenario();
        $espada = $c->mesa->itens()->create(['nome' => 'Espada', 'peso' => 3, 'dados' => ['arma' => $dadosArma + ['dano' => '1d8', 'atributo' => 'for', 'proficiente' => true, 'margemCritica' => $margem]]]);
        $c->aria->forceFill(['ficha' => array_replace_recursive(FichaDnd5e::padrao(), $ficha, ['inventario' => [['secao' => 'A', 'itens' => [['item_id' => $espada->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false]]]]])])->save();
        $this->app->instance(Rolador::class, new Rolador(function (int $faces) use (&$sorteios) {
            return min($faces, array_shift($sorteios) ?? 1);
        }));

        return $this->rolar($c, $c->ana, ['expressao' => sprintf($expressao, $espada->id), 'personagem_id' => $c->aria->id])->assertCreated()->json('dados') + ['arma_id' => $espada->id, 'c' => $c];
    }

    /** As marcas do ataque sem as ações do card (que têm teste próprio). */
    private function marcas(array $r): array
    {
        return array_diff_key($r['sistema'], ['acoes' => 1]);
    }

    public function test_d20_puro_na_margem_da_arma_e_critico(): void
    {
        $r = $this->ataqueComArma(19, [19]);
        $this->assertSame(['arma' => $r['arma_id'], 'margem' => 19, 'destaque' => 'critico'], $this->marcas($r));

        $r = $this->ataqueComArma(19, [20]);
        $this->assertSame('critico', $r['sistema']['destaque']);

        $r = $this->ataqueComArma(19, [18]);
        $this->assertSame(['arma' => $r['arma_id'], 'margem' => 19], $this->marcas($r)); // ataque com arma, sem crítico

        $r = $this->ataqueComArma(18, [18]);
        $this->assertSame('critico', $r['sistema']['destaque']);
    }

    public function test_ataque_oferece_o_dano_no_card_e_o_critico_dobra_os_dados(): void
    {
        $ficha = ['atributos' => ['for' => 16]]; // FOR 16 = +3 de dano

        $normal = $this->ataqueComArma(20, [10], ficha: $ficha);
        $arma = $normal['arma_id'];
        $this->assertSame([[
            'id' => 'dano', 'rotulo' => 'Dano', 'resumo' => '1d8+3', 'expressao' => "1d8+@arma.{$arma}.dano", 'rotuloRolagem' => 'Espada',
        ]], $normal['sistema']['acoes']);

        // Crítico: "Dano crítico" (dados dobrados, em destaque) primeiro, e o dano normal ao lado.
        $critico = $this->ataqueComArma(20, [20], ficha: $ficha);
        $arma = $critico['arma_id'];
        $this->assertSame(['dano-critico', 'dano'], array_column($critico['sistema']['acoes'], 'id'));
        $this->assertSame([
            'id' => 'dano-critico', 'rotulo' => 'Dano crítico', 'resumo' => '2d8+3', 'expressao' => "2d8+@arma.{$arma}.dano",
            'rotuloRolagem' => 'Espada', 'destaque' => 'critico',
        ], $critico['sistema']['acoes'][0]);
        $this->assertSame(['Dano normal', '1d8+3'], [$critico['sistema']['acoes'][1]['rotulo'], $critico['sistema']['acoes'][1]['resumo']]);

        // Falha crítica (1 natural) erra sempre: sem botão de dano.
        $this->assertArrayNotHasKey('acoes', $this->ataqueComArma(20, [1], ficha: $ficha)['sistema']);
    }

    public function test_dano_do_card_soma_os_dados_extras_da_arma_e_dos_buffs_e_o_critico_dobra_todos(): void
    {
        $ficha = ['atributos' => ['for' => 16], 'caracteristicas' => [
            ['nome' => 'Ataque Furtivo', 'origem' => 'Ladino 1', 'tipo' => 'ativa', 'ativa' => true, 'efeitos' => [['alvo' => 'dano.arma', 'modo' => 'dados', 'valor' => '3d6']]],
            ['nome' => 'Golpe Desligado', 'origem' => 'X', 'tipo' => 'ativa', 'ativa' => false, 'efeitos' => [['alvo' => 'dano.arma', 'modo' => 'dados', 'valor' => '9d6']]],
        ]];
        $extra = ['danoExtra' => [['dados' => '2d6', 'tipo' => 'fogo']]];

        // FOR 16 = +3. A arma (1d8), o extra dela (2d6) e o buff ligado (3d6); o buff desligado não entra.
        $normal = $this->ataqueComArma(20, [10], ficha: $ficha, dadosArma: $extra);
        $a = $normal['arma_id'];
        $this->assertSame(['dano'], array_column($normal['sistema']['acoes'], 'id'));
        $this->assertSame("1d8+2d6+3d6+@arma.{$a}.dano", $normal['sistema']['acoes'][0]['expressao']);
        $this->assertSame('1d8+2d6+3d6+3', $normal['sistema']['acoes'][0]['resumo']);

        // Crítico: TODOS os dados dobram; o bônus fixo entra uma vez.
        $critico = $this->ataqueComArma(20, [20], ficha: $ficha, dadosArma: $extra);
        $a = $critico['arma_id'];
        $this->assertSame("2d8+4d6+6d6+@arma.{$a}.dano", $critico['sistema']['acoes'][0]['expressao']);
        $this->assertSame('2d8+4d6+6d6+3', $critico['sistema']['acoes'][0]['resumo']);
        $this->assertSame('1d8+2d6+3d6+3', $critico['sistema']['acoes'][1]['resumo']); // o normal ao lado

        // A ação do card rola de verdade, com todos esses dados.
        $c = $critico['c'];
        $this->app->instance(Rolador::class, new Rolador(fn (int $faces) => 2));
        $r = $this->rolar($c, $c->ana, ['expressao' => $critico['sistema']['acoes'][0]['expressao'], 'personagem_id' => $c->aria->id])->assertCreated()->json('dados');
        $this->assertSame((2 + 4 + 6) * 2 + 3, $r['total']); // 12 dados valendo 2 cada, mais o +3
    }

    public function test_extras_que_estourariam_o_limite_do_rolador_no_critico_ficam_de_fora(): void
    {
        // 50d6 + três extras de 20d6: dobrado seria 220 dados (o limite é 200). Os dois primeiros extras cabem (180).
        $r = $this->ataqueComArma(20, [20], dadosArma: ['dano' => '50d6', 'danoExtra' => [['dados' => '20d6'], ['dados' => '20d6'], ['dados' => '20d6']]]);
        $a = $r['arma_id'];

        $this->assertSame("100d6+40d6+40d6+@arma.{$a}.dano", $r['sistema']['acoes'][0]['expressao']);
        $this->assertSame("50d6+20d6+20d6+@arma.{$a}.dano", $r['sistema']['acoes'][1]['expressao']);

        // E a expressão do crítico é aceita pelo rolador (não estoura o limite).
        $c = $r['c'];
        $this->app->instance(Rolador::class, new Rolador(fn (int $faces) => 1));
        $this->rolar($c, $c->ana, ['expressao' => $r['sistema']['acoes'][0]['expressao'], 'personagem_id' => $c->aria->id])->assertCreated();
    }

    public function test_resumo_do_dano_sem_bonus_e_com_bonus_negativo(): void
    {
        $zero = $this->ataqueComArma(20, [10]); // FOR 10 = +0
        $this->assertSame('1d8', $zero['sistema']['acoes'][0]['resumo']);

        $negativo = $this->ataqueComArma(20, [10], ficha: ['atributos' => ['for' => 6]]); // FOR 6 = -2
        $this->assertSame('1d8-2', $negativo['sistema']['acoes'][0]['resumo']);
    }

    public function test_acao_do_card_rola_o_dano_como_uma_rolagem_comum(): void
    {
        $r = $this->ataqueComArma(20, [20], ficha: ['atributos' => ['for' => 16]]);
        $c = $r['c'];
        $acao = $r['sistema']['acoes'][0]; // dano crítico
        $this->app->instance(Rolador::class, new Rolador(fn (int $faces) => 4));

        $dano = $this->rolar($c, $c->ana, ['expressao' => $acao['expressao'], 'rotulo' => $acao['rotuloRolagem'], 'personagem_id' => $c->aria->id])->assertCreated()->json('dados');

        $this->assertSame('Espada', $dano['rotulo']); // só o nome do item: os dados e a fórmula dizem que é dano
        $this->assertCount(2, $dano['termos'][0]['resultados']); // 2d8
        $this->assertSame(4 + 4 + 3, $dano['total']);            // dois dados de 4 e o modificador +3 uma vez só
        $this->assertArrayNotHasKey('sistema', $dano);           // o dano não é um ataque: sem novas ações
    }

    public function test_margem_padrao_e_20_e_o_1_e_falha(): void
    {
        $this->assertArrayNotHasKey('destaque', $this->ataqueComArma(20, [19])['sistema']);
        $this->assertSame('critico', $this->ataqueComArma(20, [20])['sistema']['destaque']);
        $this->assertSame('falha', $this->ataqueComArma(20, [1])['sistema']['destaque']);
    }

    public function test_vantagem_decide_o_critico_pelo_dado_mantido(): void
    {
        // 2d20kh1: sai 4 e 19; o 19 fica → crítico (margem 19). 2d20kl1: fica o 4 → não é.
        $this->assertSame('critico', $this->ataqueComArma(19, [4, 19], '2d20kh1+@arma.%d.ataque')['sistema']['destaque']);
        $this->assertArrayNotHasKey('destaque', $this->ataqueComArma(19, [4, 19], '2d20kl1+@arma.%d.ataque')['sistema']);
    }

    public function test_so_ataque_com_arma_recebe_marca_do_sistema(): void
    {
        $c = $this->cenario();
        $c->aria->forceFill(['ficha' => FichaDnd5e::padrao()])->save();
        $this->app->instance(Rolador::class, new Rolador(fn (int $faces) => $faces));

        $r = $this->rolar($c, $c->ana, ['expressao' => '1d20+@pericia.percepcao', 'personagem_id' => $c->aria->id])->assertCreated()->json('dados');
        $this->assertArrayNotHasKey('sistema', $r); // natural 20 de perícia não é "crítico de arma"
        $this->assertArrayNotHasKey('sistema', $this->rolar($c, $c->ana, ['expressao' => '1d20'])->assertCreated()->json('dados'));
    }

    public function test_ataque_com_arma_de_sabedoria_usa_o_modificador_dela(): void
    {
        $c = $this->cenario();
        $cajado = $c->mesa->itens()->create(['nome' => 'Cajado de Combate', 'peso' => 2, 'dados' => ['arma' => ['dano' => '1d6', 'atributo' => 'sab', 'proficiente' => true]]]);
        $c->aria->forceFill(['ficha' => array_replace_recursive(FichaDnd5e::padrao(), [
            'nivel' => 5, 'atributos' => ['for' => 8, 'des' => 8, 'sab' => 18],
            'inventario' => [['secao' => 'A', 'itens' => [['item_id' => $cajado->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false]]]],
        ])])->save();

        $r = $this->rolar($c, $c->ana, ['expressao' => '1d20+@arma.'.$cajado->id.'.ataque+@arma.'.$cajado->id.'.dano', 'personagem_id' => $c->aria->id])->assertCreated()->json();
        $v = collect($r['dados']['termos'])->where('tipo', 'variavel')->mapWithKeys(fn ($t) => [$t['nome'] => $t['valor']])->all();

        // SAB 18 = +4; proficiência nível 5 = +3. Força e Destreza (-1) não entram.
        $this->assertSame(['arma.'.$cajado->id.'.ataque' => 7, 'arma.'.$cajado->id.'.dano' => 4], $v);
    }

    public function test_ataque_e_dano_da_arma_usam_atributos_diferentes(): void
    {
        $c = $this->cenario();
        $arma = fn (string $nome, array $dados) => $c->mesa->itens()->create(['nome' => $nome, 'peso' => 1, 'dados' => ['arma' => $dados + ['dano' => '1d6', 'proficiente' => true]]]);
        $misto = $arma('Mista', ['atributo' => 'car', 'atributoDano' => 'for']);
        $secundaria = $arma('Secundária', ['atributo' => 'for', 'atributoDano' => 'nenhum', 'bonusMagico' => 1]);
        $igual = $arma('Igual', ['atributo' => 'sab']);
        $ref = fn ($item) => ['item_id' => $item->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false];
        $c->aria->forceFill(['ficha' => array_replace_recursive(FichaDnd5e::padrao(), [
            'nivel' => 5, 'atributos' => ['for' => 16, 'car' => 14, 'sab' => 18],
            'inventario' => [['secao' => 'A', 'itens' => [$ref($misto), $ref($secundaria), $ref($igual)]]],
        ])])->save();

        $variaveis = app(RegistroSistemas::class)->resolver('dnd-5e')->variaveisDeRolagem($c->aria->ficha, collect([$misto, $secundaria, $igual])->mapWithKeys(fn ($i) => [$i->id => $i->paraFront()])->all());

        // nível 5: proficiência +3. FOR 16 = +3, CAR 14 = +2, SAB 18 = +4
        $this->assertSame([5, 3], [$variaveis["arma.{$misto->id}.ataque"], $variaveis["arma.{$misto->id}.dano"]]);           // bate com Carisma (+2+3), dano com Força (+3)
        $this->assertSame([7, 1], [$variaveis["arma.{$secundaria->id}.ataque"], $variaveis["arma.{$secundaria->id}.dano"]]); // dano sem modificador: só o +1 mágico
        $this->assertSame([7, 4], [$variaveis["arma.{$igual->id}.ataque"], $variaveis["arma.{$igual->id}.dano"]]);            // sem atributoDano: o mesmo do ataque
    }

    public function test_bonus_de_acerto_e_de_dano_da_arma_somam_separados(): void
    {
        $c = $this->cenario();
        $arma = fn (string $nome, array $dados) => $c->mesa->itens()->create(['nome' => $nome, 'peso' => 1, 'dados' => ['arma' => $dados + ['dano' => '1d8', 'atributo' => 'for', 'proficiente' => false]]]);
        $separados = $arma('Separados', ['bonusAtaque' => 2, 'bonusDano' => 1]);
        $antiga = $arma('Antiga', ['bonusMagico' => 3]);
        $ref = fn ($item) => ['item_id' => $item->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false];
        $c->aria->forceFill(['ficha' => array_replace_recursive(FichaDnd5e::padrao(), [
            'atributos' => ['for' => 16], 'inventario' => [['secao' => 'A', 'itens' => [$ref($separados), $ref($antiga)]]],
        ])])->save();

        $v = app(RegistroSistemas::class)->resolver('dnd-5e')->variaveisDeRolagem($c->aria->ficha, collect([$separados, $antiga])->mapWithKeys(fn ($i) => [$i->id => $i->paraFront()])->all());

        // FOR 16 = +3, sem proficiência
        $this->assertSame([5, 4], [$v["arma.{$separados->id}.ataque"], $v["arma.{$separados->id}.dano"]]); // +2 no acerto, +1 no dano
        $this->assertSame([6, 6], [$v["arma.{$antiga->id}.ataque"], $v["arma.{$antiga->id}.dano"]]);       // formato antigo: +3 nos dois
    }

    public function test_buffs_de_caracteristica_valem_passiva_sempre_e_ativa_so_ligada(): void
    {
        $c = $this->cenario();
        $c->aria->forceFill(['ficha' => array_replace(FichaDnd5e::padrao(), ['caracteristicas' => [
            ['nome' => 'Estilo de Luta: Defesa', 'origem' => 'Guerreiro 1', 'tipo' => 'passiva', 'efeitos' => [['alvo' => 'ca', 'modo' => 'soma', 'valor' => 1]]],
            ['nome' => 'Escudo da Fé', 'origem' => 'Clérigo 1', 'tipo' => 'ativa', 'ativa' => false, 'efeitos' => [['alvo' => 'ca', 'modo' => 'soma', 'valor' => 2]]],
        ]])])->save();
        $ca = fn () => collect($this->rolar($c, $c->ana, ['expressao' => '@ca', 'personagem_id' => $c->aria->id])->assertCreated()->json('dados.termos'))->firstWhere('nome', 'ca')['valor'];

        $this->assertSame(11, $ca()); // 10 + a passiva (+1); a ativa está desligada

        // Ligar o interruptor (edição normal da ficha pelo dono) faz o buff valer na próxima rolagem.
        $url = route('jogo.personagens.ficha', [$c->mesa->id, $c->aria->id]);
        $lista = $c->aria->fresh()->ficha['caracteristicas'];
        $lista[1]['ativa'] = true;
        $this->como($c->ana)->patchJson($url, ['campos' => ['caracteristicas' => $lista]])->assertOk();
        $this->assertSame(13, $ca());

        $lista[1]['ativa'] = false;
        $this->como($c->ana)->patchJson($url, ['campos' => ['caracteristicas' => $lista]])->assertOk();
        $this->assertSame(11, $ca());
    }

    public function test_arma_nao_equipada_nao_gera_variavel(): void
    {
        $c = $this->cenario();
        $espada = $c->mesa->itens()->create(['nome' => 'Espada', 'peso' => 3, 'dados' => ['arma' => ['dano' => '1d8', 'atributo' => 'for']]]);
        $c->aria->forceFill(['ficha' => array_replace(FichaDnd5e::padrao(), ['inventario' => [['secao' => 'A', 'itens' => [['item_id' => $espada->id, 'qtd' => 1, 'equipado' => false, 'sintonizado' => false]]]]])])->save();

        $this->rolar($c, $c->ana, ['expressao' => '1d20+@arma.'.$espada->id.'.ataque', 'personagem_id' => $c->aria->id])->assertStatus(422)->assertJsonValidationErrors('expressao');
    }

    public function test_variavel_inexistente_e_personagem_alheio_sao_rejeitados(): void
    {
        $c = $this->cenario();
        $this->rolar($c, $c->ana, ['expressao' => '1d20+@xyz', 'personagem_id' => $c->aria->id])->assertStatus(422)->assertJsonValidationErrors('expressao');
        // Bia não controla a Aria: não rola como ela (nem usa a ficha dela).
        $this->rolar($c, $c->bia, ['expressao' => '1d20+@mod.for', 'personagem_id' => $c->aria->id])->assertStatus(422)->assertJsonValidationErrors('personagem_id');
    }

    public function test_mensagem_antiga_de_rolagem_e_lida_no_formato_novo(): void
    {
        $c = $this->cenario();
        $c->mesa->mensagens()->create([
            'jogador_id' => $c->ana->id, 'tipo' => 'rolagem', 'visibilidade' => 'todos', 'texto' => '2d6',
            'dados' => ['dado' => 'd6', 'faces' => 6, 'quantidade' => 2, 'resultados' => [3, 4], 'total' => 7],
        ]);

        $m = $this->como($c->ana)->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->viewData('page')['props']['mensagens'][0];
        $this->assertSame('2d6', $m['dados']['expressao']);
        $this->assertSame([3, 4], $m['dados']['termos'][0]['resultados']);
        $this->assertSame(7, $m['dados']['total']);
    }

    public function test_jogador_nao_pode_rolar_em_segredo(): void
    {
        $c = $this->cenario();
        $this->rolar($c, $c->ana, ['visibilidade' => 'secreto'])->assertStatus(422);
        $this->rolar($c, $c->mestre, ['visibilidade' => 'secreto'])->assertCreated();
    }

    public function test_rolagem_para_todos_vai_ao_canal_aberto(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $this->rolar($c, $c->ana, ['visibilidade' => 'todos'])->assertCreated();
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->nome === 'mensagem' && $e->canais === ['mesa'] && $e->payload['mensagem']['dados'] !== null);
    }

    public function test_rolagem_eu_e_mestre_nunca_vai_ao_canal_aberto(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $this->rolar($c, $c->ana, ['visibilidade' => 'mestre'])->assertCreated();
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->canais === ["jogador.{$c->ana->id}", 'mestre']);
        Event::assertNotDispatched(EventoMesa::class, fn ($e) => in_array('mesa', $e->canais, true));
    }

    public function test_rolagem_secreta_mostra_aviso_sem_numeros_aos_jogadores(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $this->rolar($c, $c->mestre, ['visibilidade' => 'secreto', 'expressao' => '3d6'])->assertCreated();

        Event::assertDispatched(EventoMesa::class, function ($e) {
            return $e->canais === ['mesa'] && $e->payload['mensagem']['dados'] === null && $e->payload['mensagem']['visibilidade'] === 'secreto_oculto';
        });
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->canais === ['mestre'] && count($e->payload['mensagem']['dados']['termos'][0]['resultados']) === 3);
    }

    public function test_historico_respeita_a_visibilidade_de_cada_um(): void
    {
        $c = $this->cenario();
        $this->rolar($c, $c->ana, ['visibilidade' => 'todos'])->assertCreated();            // todos veem
        $this->rolar($c, $c->ana, ['visibilidade' => 'mestre'])->assertCreated();           // Ana + mestre
        $this->rolar($c, $c->mestre, ['visibilidade' => 'secreto'])->assertCreated();       // mestre vê; demais só aviso
        $this->rolar($c, $c->mestre, ['visibilidade' => 'mestre'])->assertCreated();        // só mestre
        $this->como($c->ana)->postJson(route('jogo.mensagens.store', $c->mesa->id), ['texto' => 'olá'])->assertCreated();

        $ver = fn (Jogador $p) => $this->como($p)->get(route('jogo', [$c->mesa->slug, $p->id]))->viewData('page')['props']['mensagens'];

        $mestre = $ver($c->mestre);
        $this->assertCount(5, $mestre);
        $this->assertNotNull(collect($mestre)->firstWhere('visibilidade', 'secreto')['dados']);

        $ana = $ver($c->ana); // todos + privada dela + aviso do segredo + texto (a privada do mestre fica de fora)
        $this->assertCount(4, $ana);
        $segredo = collect($ana)->firstWhere('visibilidade', 'secreto_oculto');
        $this->assertNull($segredo['dados']);
        $this->assertSame('rolou dados em segredo', $segredo['texto']);

        $bia = $ver($c->bia); // não vê a rolagem privada da Ana nem a do mestre
        $this->assertCount(3, $bia);
        $this->assertNull(collect($bia)->firstWhere('visibilidade', 'mestre'));
    }

    public function test_chat_de_texto_vai_ao_canal_aberto_e_exige_acesso(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $this->postJson(route('jogo.mensagens.store', $c->mesa->id), ['texto' => 'oi'])->assertForbidden();
        $this->como($c->ana)->postJson(route('jogo.mensagens.store', $c->mesa->id), ['texto' => '  oi  '])->assertCreated()->assertJsonPath('texto', 'oi');
        $this->como($c->ana)->postJson(route('jogo.mensagens.store', $c->mesa->id), ['texto' => ''])->assertStatus(422);
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->nome === 'mensagem' && $e->canais === ['mesa']);
    }

    public function test_autorizacao_dos_canais_privados(): void
    {
        $c = $this->cenario();
        $auth = fn (Jogador $p, string $canal) => $this->como($p)->post(route('jogo.broadcasting.auth', $c->mesa->id), ['channel_name' => $canal, 'socket_id' => '123.456']);
        $id = $c->mesa->id;

        $auth($c->ana, "private-mesa.{$id}")->assertOk();
        $auth($c->ana, "private-mesa.{$id}.jogador.{$c->ana->id}")->assertOk();
        $auth($c->ana, "private-mesa.{$id}.mestre")->assertForbidden();                 // jogador não escuta o canal do mestre
        $auth($c->ana, "private-mesa.{$id}.jogador.{$c->bia->id}")->assertForbidden(); // nem o de outro jogador
        $auth($c->mestre, "private-mesa.{$id}.mestre")->assertOk();
        $this->flushSession();
        $this->withHeaders(['X-Jogador' => ''])->post(route('jogo.broadcasting.auth', $id), ['channel_name' => "private-mesa.{$id}", 'socket_id' => '1.2'])->assertForbidden();
    }

    public function test_so_o_mestre_comanda_o_combate_e_o_estado_chega_aos_jogadores(): void
    {
        Event::fake([EventoMesa::class]);
        $c = $this->cenario();
        $rota = route('jogo.combate.comando', $c->mesa->id);

        $this->como($c->ana)->postJson($rota, ['comando' => 'iniciar'])->assertForbidden();
        $this->como($c->mestre)->postJson($rota, ['comando' => 'adicionar', 'personagem_id' => $c->aria->id, 'iniciativa' => 15])->assertOk();
        Event::assertDispatched(EventoMesa::class, fn ($e) => $e->nome === 'combate' && $e->canais === ['mesa']);

        $this->como($c->ana)->get(route('jogo', [$c->mesa->slug, $c->ana->id]))->assertInertia(fn (Assert $p) => $p
            ->where('combate.rodada', 1)->where('combate.itens.0.nome', 'Aria')->where('combate.itens.0.iniciativa', 15));
    }

    public function test_jogador_desenha_na_camada_jogadores_e_apaga_so_o_proprio(): void
    {
        $c = $this->cenario();
        $traco = ['camada' => 'jogadores', 'tipo' => 'traco', 'x' => 10, 'y' => 10, 'largura' => 50, 'altura' => 30,
            'dados' => ['pontos' => [0, 0, 20, 10, 50, 30], 'cor' => '#ff0000', 'espessura' => 4]];
        $url = route('jogo.objetos.store', [$c->mesa->id, $c->pagina->id]);

        $criado = $this->como($c->ana)->postJson($url, $traco)->assertCreated()->json();
        $this->assertSame($c->ana->id, $criado['jogador_id']);
        $this->assertNull($criado['personagem_id']);
        $this->como($c->ana)->postJson($url, ['camada' => 'mestre'] + $traco)->assertForbidden();                    // só Jogadores
        $this->como($c->ana)->postJson($url, ['tipo' => 'token'] + $traco)->assertForbidden();                       // só traço/texto
        $this->como($c->ana)->postJson($url, ['tipo' => 'texto', 'dados' => ['texto' => 'Olá', 'cor' => '#ffffff', 'tamanho' => 24]] + $traco)->assertCreated();

        $this->como($c->bia)->deleteJson(route('jogo.objetos.destroy', [$c->mesa->id, $criado['id']]))->assertForbidden();
        $this->como($c->ana)->deleteJson(route('jogo.objetos.destroy', [$c->mesa->id, $criado['id']]))->assertOk();
        // mestre pode desenhar em qualquer camada (menos iluminação) e apagar de qualquer um
        $this->como($c->mestre)->postJson($url, ['camada' => 'mestre'] + $traco)->assertCreated();
        $this->como($c->mestre)->postJson($url, ['camada' => 'iluminacao'] + $traco)->assertStatus(422);
    }

    public function test_pontos_do_traco_precisam_vir_em_pares(): void
    {
        $c = $this->cenario();
        $this->como($c->ana)->postJson(route('jogo.objetos.store', [$c->mesa->id, $c->pagina->id]), [
            'camada' => 'jogadores', 'tipo' => 'traco', 'x' => 0, 'y' => 0, 'largura' => 5, 'altura' => 5, 'dados' => ['pontos' => [0, 0, 1, 1, 2]],
        ])->assertStatus(422);
    }

    public function test_fala_e_rola_como_o_personagem_ativo_somente_se_for_seu(): void
    {
        $c = $this->cenario();
        $alheio = $c->mesa->personagens()->create(['nome' => 'Bruno', 'cor' => '#16a34a']); // de ninguém
        $texto = fn (Jogador $quem, ?int $personagem) => $this->como($quem)->postJson(route('jogo.mensagens.store', $c->mesa->id), ['texto' => 'oi', 'personagem_id' => $personagem]);

        $texto($c->ana, $c->aria->id)->assertCreated()->assertJsonPath('autor.nome', 'Aria')->assertJsonPath('autor.id', $c->ana->id)->assertJsonPath('autor.personagem_id', $c->aria->id);
        $texto($c->ana, null)->assertCreated()->assertJsonPath('autor.nome', 'Ana');          // sem ativo: fala como o jogador
        $texto($c->ana, $alheio->id)->assertStatus(422);                                         // não é dele
        $texto($c->bia, $c->aria->id)->assertStatus(422);                                        // é da Ana
        $texto($c->mestre, $alheio->id)->assertCreated();                                       // mestre fala como qualquer um

        $this->rolar($c, $c->ana, ['personagem_id' => $c->aria->id])->assertCreated()->assertJsonPath('autor.nome', 'Aria');
        $this->rolar($c, $c->ana, ['personagem_id' => $alheio->id])->assertStatus(422);
    }
}
