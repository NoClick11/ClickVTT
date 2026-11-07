<?php

namespace App\Nucleo\Combate;

use App\Models\Objeto;

/**
 * Camadas e o que os jogadores enxergam: a camada do Mestre nunca vai ao jogador. Um personagem cujos tokens estão TODOS na camada do Mestre é
 * "oculto": os jogadores não o veem, então as Técnicas deles não o atingem nem o revelam (um alvo oculto não é "que você veja") e o que um
 * personagem oculto faz com Técnicas ativas só aparece para o mestre.
 */
final class Visibilidade
{
    public static function oculto(int $personagemId): bool
    {
        $camadas = Objeto::query()->where('tipo', 'token')->where('personagem_id', $personagemId)->pluck('camada');

        return $camadas->isNotEmpty() && $camadas->every(fn ($c) => $c === 'mestre');
    }

    /** A visibilidade das mensagens que um personagem gera: só o mestre vê o que um personagem oculto faz. */
    public static function mensagem(int $personagemId): string
    {
        return self::oculto($personagemId) ? 'mestre' : 'todos';
    }
}
