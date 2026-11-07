<?php

namespace Tests\Unit\Nucleo;

use App\Sistemas\OnePiece\Individualidades;
use App\Sistemas\OnePiece\Treinamentos;
use PHPUnit\Framework\TestCase;

/** Individualidades no servidor: os mesmos casos do TS (`tests/paridade/individualidades.test.mjs`) rodam aqui. */
class IndividualidadesTest extends TestCase
{
    public function test_as_regras_batem_com_o_ts(): void
    {
        $casos = json_decode(file_get_contents(__DIR__.'/../../paridade/individualidades-casos.json'), true);
        $this->assertGreaterThan(15, count($casos));
        foreach ($casos as $c) {
            $p = Individualidades::problemas($c['ficha']);
            if ($c['contem'] === null) {
                $this->assertSame([], $p, $c['nome']);
            } else {
                $this->assertNotEmpty(array_filter($p, fn ($x) => str_contains($x, $c['contem'])), $c['nome'].' '.json_encode($p, JSON_UNESCAPED_UNICODE));
            }
        }
    }

    public function test_disciplinado_da_pt_a_cada_nivel_par(): void
    {
        $f = ['nivel' => 6, 'atributos' => ['sab' => 10], 'caracteristicas' => []];
        $sem = Treinamentos::resumoDosPT($f)['ganhos'];
        $f['caracteristicas'][] = ['nome' => 'Disciplinado', 'builder' => 'individualidade'];
        $this->assertSame(3, Treinamentos::resumoDosPT($f)['ganhos'] - $sem);
        $f['caracteristicas'] = [['nome' => 'Disciplinado']];
        $this->assertSame($sem, Treinamentos::resumoDosPT($f)['ganhos']);
    }
}
