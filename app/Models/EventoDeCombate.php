<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Um evento do combate que espera resposta (ex.: ataque com a janela de reações aberta). A lógica está em `Pipeline`. */
class EventoDeCombate extends Model
{
    protected $table = 'eventos_de_combate';

    protected $fillable = ['tipo', 'estado', 'contexto', 'ofertas', 'respostas', 'resultado'];

    protected function casts(): array
    {
        return ['contexto' => 'array', 'ofertas' => 'array', 'respostas' => 'array', 'resultado' => 'array'];
    }

    public function mesa(): BelongsTo
    {
        return $this->belongsTo(Mesa::class);
    }

    /** Quem ainda não respondeu (ids de personagem). */
    public function aguardando(): array
    {
        return array_values(array_filter(array_map('intval', array_keys($this->ofertas)), fn ($id) => ! isset($this->respostas[$id])));
    }
}
