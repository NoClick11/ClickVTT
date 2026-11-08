<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Quadrados maiores: 70 px → 100 px. A distância por quadrado não muda; as páginas que ainda usam 70 px
 * têm posição, tamanho, raio de luz e pontos de paredes/traços reescalados na mesma proporção.
 */
return new class extends Migration
{
    private const DE = 70;

    private const PARA = 100;

    public function up(): void
    {
        $f = self::PARA / self::DE;

        DB::transaction(function () use ($f) {
            $paginas = DB::table('paginas')->where('tamanho_quadrado', self::DE)->pluck('id');

            foreach ($paginas as $id) {
                DB::table('objetos')->where('pagina_id', $id)->orderBy('id')->each(function ($o) use ($f) {
                    $dados = $o->dados ? json_decode($o->dados, true) : null;
                    if (is_array($dados)) {
                        if (isset($dados['raio'])) {
                            $dados['raio'] = round($dados['raio'] * $f, 2);
                        }
                        if (isset($dados['pontos']) && is_array($dados['pontos'])) {
                            $dados['pontos'] = array_map(fn ($v) => round($v * $f, 2), $dados['pontos']);
                        }
                    }
                    DB::table('objetos')->where('id', $o->id)->update([
                        'x' => $o->x * $f, 'y' => $o->y * $f,
                        'largura' => $o->largura * $f, 'altura' => $o->altura * $f,
                        'dados' => $dados === null ? $o->dados : json_encode($dados),
                    ]);
                });
                DB::table('paginas')->where('id', $id)->update(['tamanho_quadrado' => self::PARA]);
            }
        });
    }

    public function down(): void {}
};
