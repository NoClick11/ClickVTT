<?php

namespace App\Support;

use App\Events\EventoMesa;
use App\Models\Mesa;
use Illuminate\Support\Facades\Log;
use Throwable;

/** Envia eventos em tempo real. Se o Reverb estiver fora do ar, o jogo segue funcionando (sem ao vivo). */
final class Transmitir
{
    /**
     * Avisa que a cena mudou: os clientes recarregam o que precisam. `ator` evita eco para quem agiu.
     * Mudanças que só o mestre enxerga (camada Mestre, paredes) vão só ao canal do mestre.
     */
    public static function cena(Mesa|int $mesa, ?int $paginaId, ?int $atorId, bool $somenteMestre = false): void
    {
        self::enviar($mesa, 'cena', ['pagina_id' => $paginaId, 'ator' => $atorId], $somenteMestre ? ['mestre'] : ['mesa']);
    }

    /** @param  list<string>  $canais */
    public static function enviar(Mesa|int $mesa, string $nome, array $payload, array $canais): void
    {
        try {
            broadcast(new EventoMesa($mesa instanceof Mesa ? $mesa->id : $mesa, $nome, $payload, $canais));
        } catch (Throwable $e) {
            Log::warning("Broadcast '{$nome}' falhou: {$e->getMessage()}");
        }
    }
}
