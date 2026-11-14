<?php

namespace App\Nucleo\Combate;

use App\Models\Objeto;

/**
 * Distância entre dois personagens no mapa, na régua da grade (como no D&D): um token vizinho, inclusive na diagonal, está a 1 quadrado;
 * tokens grandes contam pela borda. O token solto fora da grade vale o quadrado mais próximo. A altura (`dados.elevacao`, na unidade da página)
 * entra como mais um eixo da régua: vale o maior entre a distância no chão e a diferença de altura, ambas em quadrados.
 */
final class Alcance
{
    /**
     * Metros entre o atacante e o alvo, ou null se não dá para medir (um deles sem token, ou os tokens em mapas diferentes).
     * Com mais de um token do mesmo personagem na mesma página, vale o par mais próximo.
     */
    public static function entrePersonagens(int $atacanteId, int $alvoId): ?float
    {
        $tokens = Objeto::query()->where('tipo', 'token')->whereIn('personagem_id', [$atacanteId, $alvoId])->get()->groupBy('personagem_id');
        $melhor = null;
        foreach ($tokens->get($atacanteId, collect()) as $a) {
            foreach ($tokens->get($alvoId, collect()) as $b) {
                if ($a->pagina_id !== $b->pagina_id) {
                    continue;
                }
                $d = self::entreTokens($a, $b);
                $melhor = $melhor === null ? $d : min($melhor, $d);
            }
        }

        return $melhor;
    }

    public static function entreTokens(Objeto $a, Objeto $b): float
    {
        $pagina = $a->pagina;
        $quadrado = max(1.0, (float) $pagina->tamanho_quadrado);
        $dx = abs(($a->x + $a->largura / 2) - ($b->x + $b->largura / 2));
        $dy = abs(($a->y + $a->altura / 2) - ($b->y + $b->altura / 2));
        $vao = max(0.0, $dx - ($a->largura + $b->largura) / 2, $dy - ($a->altura + $b->altura) / 2);
        $noChao = round($vao / $quadrado) + 1;
        $porAltura = round(abs(self::elevacao($a) - self::elevacao($b)) / max(0.01, (float) $pagina->distancia_quadrado));
        $quadrados = max($noChao, $porAltura);

        return $quadrados * (float) $pagina->distancia_quadrado * Movimento::fatorParaMetros($pagina->unidade);
    }

    /** A altura do token (na unidade da página); sem valor, ao nível do chão. */
    public static function elevacao(Objeto $token): float
    {
        return (float) ($token->dados['elevacao'] ?? 0);
    }
}
