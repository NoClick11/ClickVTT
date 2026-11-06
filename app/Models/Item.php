<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Item da mesa (espada, armadura, poção...). Os personagens só o REFERENCIAM no inventário (`item_id`).
 * `efeitos` = buffs do núcleo ([{alvo, modo, valor}]); `dados` = o que só o sistema entende (armadura, arma...).
 * Só o mestre cria e edita.
 */
class Item extends Model
{
    protected $table = 'itens';

    protected $fillable = ['nome', 'descricao', 'peso', 'equipavel', 'requer_sintonia', 'dados', 'efeitos'];

    protected function casts(): array
    {
        return [
            'peso' => 'float',
            'equipavel' => 'boolean',
            'requer_sintonia' => 'boolean',
            'dados' => 'array',
            'efeitos' => 'array',
        ];
    }

    public function mesa(): BelongsTo
    {
        return $this->belongsTo(Mesa::class);
    }

    public function paraFront(): array
    {
        return [
            'id' => $this->id,
            'nome' => $this->nome,
            'descricao' => $this->descricao,
            'peso' => $this->peso,
            'equipavel' => $this->equipavel,
            'requer_sintonia' => $this->requer_sintonia,
            'dados' => $this->dados,
            'efeitos' => $this->efeitos ?? [],
        ];
    }
}
