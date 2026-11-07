<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Loja aberta pelo mestre para um jogador: as categorias à venda e o ajuste de preço (%). */
class LojaAberta extends Model
{
    protected $table = 'lojas_abertas';

    protected $fillable = ['jogador_id', 'categorias', 'raridades', 'fator'];

    protected function casts(): array
    {
        return ['categorias' => 'array', 'raridades' => 'array', 'fator' => 'integer'];
    }

    public function jogador(): BelongsTo
    {
        return $this->belongsTo(Jogador::class);
    }

    public function paraFront(): array
    {
        return ['jogador_id' => $this->jogador_id, 'categorias' => $this->categorias, 'raridades' => $this->raridades ?? [], 'fator' => $this->fator];
    }
}
