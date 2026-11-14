<?php

namespace App\Sistemas\OnePiece;

/**
 * Até onde um ataque normal (arma ou desarmado) alcança. Arma à distância: até o alcance normal ataca sem nada; do normal ao máximo, com desvantagem; além do máximo não se ataca. Corpo a corpo:
 * o alcance da arma (1,5 m, ou 3 m com a propriedade Alcance) mais o que os efeitos somam ao alcance corpo a corpo. As Técnicas têm o alcance próprio.
 */
final class AlcanceDoAtaque
{
    /**
     * @param  array<string, int|float>  $variaveis  da ficha (`alcance.corpo` em decímetros)
     * @param  array<int, array>  $itens  itens da ficha, por id
     * @return array{normal: float, maximo: float, nome: string}|null null = a rolagem não é um ataque normal (ou a arma não tem alcance conhecido)
     */
    public static function limite(string $expressao, array $variaveis, array $itens): ?array
    {
        $corpo = ((float) ($variaveis['alcance.corpo'] ?? 15)) / 10;
        if (preg_match('/@arma\.(\d+)\.ataque/', $expressao, $m)) {
            $item = $itens[(int) $m[1]] ?? null;
            if (! $item) {
                return null;
            }
            $arma = $item['dados']['arma'] ?? null;
            $maximo = $arma['alcanceMaximo'] ?? null;
            $normal = $arma['alcanceNormal'] ?? null;
            if ($maximo === null) { // item antigo, de antes do campo existir: o catálogo completa
                $id = $item['dados']['catalogo']['id'] ?? null;
                $catalogo = $id ? (Itens::item($id)['arma'] ?? null) : null;
                $alcance = $catalogo ? Itens::alcanceDaArma($catalogo) : null;
                $maximo = $alcance['alcanceMaximo'] ?? null;
                $normal = $alcance['alcanceNormal'] ?? null;
            }
            if ($maximo === null) {
                return null;
            }
            $extraCorpo = ! empty($arma['distancia']) ? 0.0 : max(0.0, $corpo - 1.5);

            return [
                'normal' => min((float) ($normal ?? $maximo), (float) $maximo) + $extraCorpo,
                'maximo' => (float) $maximo + $extraCorpo,
                'nome' => (string) ($item['nome'] ?? 'a arma'),
            ];
        }
        if (str_contains($expressao, '@ataque.desarmado')) {
            return ['normal' => $corpo, 'maximo' => $corpo, 'nome' => 'o ataque desarmado'];
        }

        return null;
    }
}
