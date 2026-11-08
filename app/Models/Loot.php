<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/** Conteúdo de um objeto "loot" do mapa: dinheiro e itens (`loot_itens`). Só o mestre monta; os jogadores só retiram. */
class Loot extends Model
{
    protected $table = 'loots';

    protected $fillable = ['mesa_id', 'objeto_id', 'dinheiro'];

    protected function casts(): array
    {
        return ['dinheiro' => 'integer'];
    }

    public function objeto(): BelongsTo
    {
        return $this->belongsTo(Objeto::class);
    }

    public function itens(): HasMany
    {
        return $this->hasMany(LootItem::class);
    }

    /** O que quem abre o loot enxerga (o item vem completo: o jogador ainda não o tem na ficha). */
    public function paraFront(): array
    {
        return [
            'objeto_id' => $this->objeto_id,
            'nome' => $this->objeto?->nome,
            'dinheiro' => (int) $this->dinheiro,
            'itens' => $this->itens()->with('item')->orderBy('id')->get()->map->paraFront()->values()->all(),
        ];
    }
}
