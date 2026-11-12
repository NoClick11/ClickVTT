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

    /**
     * Envia imediatamente uma criação, atualização ou remoção de objeto do mapa pelo WebSocket,
     * sem esperar o ciclo de reload do Inertia.
     *
     * @param  'salvar'|'remover'  $acao
     * @param  array<string, mixed>|null  $objeto
     */
    public static function objeto(
        Mesa|int $mesa,
        int $paginaId,
        string $acao,
        ?array $objeto,
        int $id,
        ?int $atorId,
        bool $somenteMestre = false,
    ): void {
        self::enviar($mesa, 'objeto', [
            'acao' => $acao,
            'pagina_id' => $paginaId,
            'objeto' => $objeto,
            'id' => $id,
            'ator' => $atorId,
        ], $somenteMestre ? ['mestre'] : ['mesa']);
    }

    /** @param  list<string>  $canais */
    public static function enviar(Mesa|int $mesa, string $nome, array $payload, array $canais): void
    {
        if (($payload['ator'] ?? null) !== 0 && ! array_key_exists('socket', $payload)) {
            $socket = request()->header('X-Socket-ID');
            if ($socket) {
                $payload['socket'] = $socket;
            }
        }

        try {
            broadcast(new EventoMesa($mesa instanceof Mesa ? $mesa->id : $mesa, $nome, $payload, $canais));
        } catch (Throwable $e) {
            Log::warning("Broadcast '{$nome}' falhou: {$e->getMessage()}");
            // O evento não saiu (payload grande demais, Reverb reiniciando): manda um aviso mínimo de "cena mudou" aos MESMOS canais,
            // para quem devia recebê-lo recarregar o estado do servidor (fichas, combate, objetos) em vez de ficar desatualizado.
            if ($nome !== 'cena') {
                try {
                    $ator = is_int($payload['ator'] ?? null) ? $payload['ator'] : null;
                    broadcast(new EventoMesa($mesa instanceof Mesa ? $mesa->id : $mesa, 'cena', ['pagina_id' => null, 'ator' => $ator, 'socket' => $payload['socket'] ?? null], $canais));
                } catch (Throwable) {
                    // sem tempo real: os clientes se acertam na próxima recarga
                }
            }
        }
    }
}
