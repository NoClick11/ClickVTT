<?php

namespace Tests\Unit\Nucleo;

use App\Sistemas\OnePiece\Criador;
use PHPUnit\Framework\TestCase;

/** Criador de Técnicas no servidor: os mesmos casos do TS (`tests/paridade/criador.test.mjs`) rodam aqui. */
class CriadorTest extends TestCase
{
    private function json(string $arquivo): array
    {
        return json_decode(file_get_contents(__DIR__."/../../paridade/{$arquivo}"), true);
    }

    public function test_o_custo_bate_com_as_tecnicas_do_livro(): void
    {
        foreach ($this->json('criador-custos.json') as $c) {
            $this->assertSame($c['total'], Criador::custoDaTecnica($c['escolhas'])['total'], $c['nome']);
        }
    }

    public function test_os_limites_de_grau_e_nivel_batem_com_o_ts(): void
    {
        foreach ($this->json('criador-problemas.json') as $c) {
            $p = Criador::problemas($c['escolhas'], $c['ctx']);
            if ($c['contem'] === null) {
                $this->assertSame([], $p, $c['nome']);
            } else {
                $achou = array_filter($p, fn ($x) => str_contains($x, $c['contem']));
                $this->assertNotEmpty($achou, $c['nome'].' '.json_encode($p, JSON_UNESCAPED_UNICODE));
            }
        }
    }

    public function test_espacos_por_tipo_de_usuario(): void
    {
        $s = Criador::espacos(['nivel' => 12, 'usuario' => 'simples', 'despertado' => false]);
        $this->assertSame([1, 2, 3], $s['graus']);
        $this->assertSame(1, $s['auxiliares']);
        $this->assertSame(1, $s['manifestacoes']);
        $a = Criador::espacos(['nivel' => 20, 'usuario' => 'avancado', 'despertado' => true]);
        $this->assertSame([1, 2, 3, 4, 5, 6, 7], $a['graus']);
        $this->assertSame(3, $a['auxiliares']);
        $this->assertSame(2, $a['auxiliaresDespertas']);
        $this->assertSame(3, $a['manifestacoes']);
    }

    public function test_reducao_prolongada_e_tipo_de_dano_opcional(): void
    {
        $base = $this->json('criador-custos.json')[0]['escolhas'];
        $this->assertSame(10, Criador::custoDaTecnica($base)['total']);
        $this->assertSame(1, Criador::custoDoTipoDeDano('Fogo', 3));
        $this->assertSame(3, Criador::custoDoTipoDeDano('Verdadeiro', 3));
        $this->assertSame(1, Criador::custoDoTipoDeDano('Energia', 1));
        $this->assertSame(0, Criador::custoDoTipoDeDano('Cortante', 5));
    }
}
