<?php

namespace App\Events;

use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;

/**
 * Evento genérico da mesa. Os destinatários são os CANAIS (quem ouve cada canal é decidido em
 * BroadcastAuthController): `mesa` (todos), `mestre` (só o mestre) ou `personagem.{id}`.
 * Cada canal recebe o payload que lhe cabe: o servidor nunca manda dado secreto a canal aberto.
 * ShouldBroadcastNow: dispensa o worker de fila.
 */
class EventoMesa implements ShouldBroadcastNow
{
    use Dispatchable, InteractsWithSockets;

    /** @param  list<string>  $canais  ex.: ['mesa'], ['mestre'], ['personagem.7', 'mestre'] */
    public function __construct(
        public int $mesaId,
        public string $nome,
        public array $payload,
        public array $canais,
    ) {}

    /** @return list<Channel> */
    public function broadcastOn(): array
    {
        return array_map(fn (string $c) => new PrivateChannel("mesa.{$this->mesaId}".($c === 'mesa' ? '' : ".{$c}")), $this->canais);
    }

    public function broadcastAs(): string
    {
        return $this->nome;
    }

    public function broadcastWith(): array
    {
        return $this->payload;
    }
}
