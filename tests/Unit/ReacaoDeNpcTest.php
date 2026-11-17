<?php

namespace Tests\Unit;

use App\Sistemas\OnePiece\FichaOnePiece;
use App\Sistemas\OnePiece\OnePiece;
use PHPUnit\Framework\TestCase;

/** Reações defensivas de NPC (`ficha.npc.reacoes[].auto`): oferta na janela de reação, custo de PP e redução do dano. */
class ReacaoDeNpcTest extends TestCase
{
    private function npc(int $pp, array $reacoes): array
    {
        return [...FichaOnePiece::padrao(), 'pp' => ['atual' => $pp, 'max' => 25], 'npc' => ['reacoes' => $reacoes]];
    }

    public function test_reacao_com_auto_e_oferecida_so_com_pp_e_sem_auto_fica_so_texto(): void
    {
        $reacoes = [
            ['nome' => 'Defesa Poderosa', 'texto' => 'x', 'pp' => 5, 'auto' => ['reducao' => ['reserva' => '10d8']]],
            ['nome' => 'Aparar', 'texto' => 'x', 'auto' => ['defesa' => 5]],
            ['nome' => 'Retaliação', 'texto' => 'x'],
        ];
        $sistema = new OnePiece;

        $com = $sistema->ofertasDeReacao('ataque_declarado', [], $this->npc(5, $reacoes), []);
        $this->assertSame(['n:0', 'n:1'], array_column($com, 'id'));
        $this->assertSame(['pp' => 5], $com[0]['custo']);
        $this->assertSame([['alvo' => 'defesa', 'modo' => 'soma', 'valor' => 5]], $com[1]['efeitos']);

        $sem = $sistema->ofertasDeReacao('ataque_declarado', [], $this->npc(4, $reacoes), []);
        $this->assertSame(['n:1'], array_column($sem, 'id')); // 4 PP < 5: a Defesa Poderosa não é oferecida
    }

    public function test_pagar_desconta_o_pp_e_arma_a_reducao(): void
    {
        $sistema = new OnePiece;
        $ficha = $this->npc(20, [['nome' => 'Defesa Poderosa', 'texto' => 'x', 'pp' => 5, 'auto' => ['reducao' => ['reserva' => '1d2']]]]);
        $oferta = $sistema->ofertasDeReacao('ataque_declarado', [], $ficha, [])[0];
        $oferta['reducao']['turnos'] = 1;

        $pago = $sistema->pagarReacao($ficha, $oferta);
        $this->assertSame(15, $pago['pp.atual']);
        $this->assertGreaterThanOrEqual(1, $pago['reducao.reserva']);
        $this->assertLessThanOrEqual(2, $pago['reducao.reserva']); // 1d2
    }

    public function test_metade_corta_o_proximo_dano_e_se_desarma(): void
    {
        $sistema = new OnePiece;
        $ficha = [...FichaOnePiece::padrao(), 'reducao' => ['metade' => true, 'turnos' => 1]];

        $r = $sistema->absorverDano($ficha, 21, ['origem' => 'ataque']);
        $this->assertSame(10, $r['final']);
        $this->assertFalse($r['campos']['reducao.metade']);
    }
}
