<?php

namespace App\Nucleo\Combate;

use App\Models\Mesa;
use App\Models\Personagem;
use Illuminate\Validation\ValidationException;

/**
 * Sem fogo amigo: dano e efeitos hostis não atingem quem é do mesmo lado. Os lados são dois, jogadores e inimigos. Em combate em curso vale a
 * disposição de cada participante (`jogadores` e `aliado` de um lado, `inimigo` do outro); fora dele, personagem com jogador é do lado dos
 * jogadores e NPC (sem jogador) é do lado dos inimigos. Espelha `resources/js/app/nucleo/combate/equipes.ts`.
 */
final class Equipes
{
    public const JOGADORES = 'jogadores';

    public const INIMIGOS = 'inimigos';

    /** O lado do personagem agora. */
    public static function de(Mesa $mesa, int $personagemId): string
    {
        $c = CombateService::normalizar($mesa->combate);
        if ($c['fase'] === 'em_curso') {
            $item = collect($c['itens'])->firstWhere('personagem_id', $personagemId);
            if ($item) {
                return $item['disposicao'] === 'inimigo' ? self::INIMIGOS : self::JOGADORES;
            }
        }

        return Personagem::query()->whereKey($personagemId)->first()?->jogadores()->exists() ? self::JOGADORES : self::INIMIGOS;
    }

    /** Os dois personagens são do mesmo lado (e são pessoas diferentes)? */
    public static function mesmoLado(Mesa $mesa, int $a, int $b): bool
    {
        return $a !== $b && self::de($mesa, $a) === self::de($mesa, $b);
    }

    /** Recusa (422) um dano ou efeito hostil de `$de` em `$para` quando são do mesmo lado. */
    public static function exigirInimigos(Mesa $mesa, int $de, int $para, string $campo = 'alvo'): void
    {
        if (self::mesmoLado($mesa, $de, $para)) {
            $nome = Personagem::query()->whereKey($para)->value('nome') ?? 'o alvo';
            throw ValidationException::withMessages([$campo => "Sem fogo amigo: {$nome} é do mesmo lado."]);
        }
    }
}
