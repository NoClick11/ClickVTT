<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LootItem extends Model
{
    protected $table = 'loot_itens';

    protected $fillable = ['loot_id', 'item_id', 'qtd'];

    protected function casts(): array
    {
        return ['qtd' => 'integer'];
    }

    public function loot(): BelongsTo
    {
        return $this->belongsTo(Loot::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }

    public function paraFront(): array
    {
        $i = $this->item;

        return [
            'id' => $this->id, 'qtd' => $this->qtd,
            'item' => ['id' => $i->id, 'nome' => $i->nome, 'descricao' => $i->descricao, 'peso' => $i->peso, 'efeitos' => $i->efeitos ?? []],
        ];
    }
}
