<?php

namespace App\Nucleo\Combate;

use App\Models\Mesa;
use App\Models\Personagem;
use Illuminate\Validation\ValidationException;

/**
 * Sem fogo amigo (o mestre pode ligar na mesa). Dois tipos de personagem: JOGADOR (tem jogador atribuído) e NPC (sem jogador). Com o fogo
 * amigo desligado:
 * - o jogador só acerta NPC, e nunca um NPC marcado como ALIADO (`aliado` na ficha do NPC, só o mestre muda);
 * - o NPC só acerta jogador (NPC contra NPC nunca, aliado ou não).
 * Com o fogo amigo ligado nada disso vale. Quem age sobre si mesmo não conta como "outro". Espelha `resources/js/app/nucleo/combate/equipes.ts`.
 */
final class Equipes
{
    public static function ehJogador(int $personagemId): bool
    {
        return Personagem::query()->whereKey($personagemId)->first()?->jogadores()->exists() ?? false;
    }

    public static function ehAliado(int $personagemId): bool
    {
        return (bool) (Personagem::query()->whereKey($personagemId)->first()?->ficha['aliado'] ?? false);
    }

    /** `$de` pode atingir `$para` com dano ou efeito hostil? */
    public static function podeAtingir(Mesa $mesa, int $de, int $para): bool
    {
        if ($de === $para || $mesa->fogo_amigo) {
            return true;
        }
        if (self::ehJogador($de)) {
            return ! self::ehJogador($para) && ! self::ehAliado($para);
        }

        return self::ehJogador($para);
    }

    /** Recusa (422) um dano ou efeito hostil de `$de` em `$para` quando as regras de fogo amigo não deixam. */
    public static function exigirPodeAtingir(Mesa $mesa, int $de, int $para, string $campo = 'alvo'): void
    {
        if (! self::podeAtingir($mesa, $de, $para)) {
            $nome = Personagem::query()->whereKey($para)->value('nome') ?? 'o alvo';
            $motivo = self::ehJogador($de)
                ? (self::ehJogador($para) ? 'é de outro jogador' : 'é aliado')
                : 'é um NPC';
            throw ValidationException::withMessages([$campo => "Sem fogo amigo: {$nome} {$motivo} (o mestre pode ligar o fogo amigo)."]);
        }
    }
}
