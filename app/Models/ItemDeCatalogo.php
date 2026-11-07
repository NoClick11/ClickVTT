<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Item que o mestre cria para o catálogo e a loja da mesa (além dos do sistema). Só o mestre cria e edita. */
class ItemDeCatalogo extends Model
{
    protected $table = 'itens_de_catalogo';

    protected $fillable = ['nome', 'descricao', 'categoria', 'raridade', 'preco', 'peso', 'equipavel', 'requer_sintonia', 'dados', 'efeitos'];

    protected function casts(): array
    {
        return ['peso' => 'float', 'preco' => 'integer', 'equipavel' => 'boolean', 'requer_sintonia' => 'boolean', 'dados' => 'array', 'efeitos' => 'array'];
    }

    public function mesa(): BelongsTo
    {
        return $this->belongsTo(Mesa::class);
    }

    public function paraFront(): array
    {
        return [
            'id' => $this->id, 'nome' => $this->nome, 'descricao' => $this->descricao, 'categoria' => $this->categoria, 'raridade' => $this->raridade,
            'preco' => $this->preco, 'peso' => $this->peso, 'equipavel' => $this->equipavel, 'requer_sintonia' => $this->requer_sintonia,
            'dados' => $this->dados, 'efeitos' => $this->efeitos ?? [],
        ];
    }

    /** A entrada como a loja a enxerga (mesmo formato das do catálogo do sistema). */
    public function comoEntrada(): array
    {
        return [
            'id' => "c:{$this->id}", 'nome' => $this->nome, 'descricao' => (string) $this->descricao, 'categoria' => $this->categoria, 'raridade' => $this->raridade,
            'preco' => $this->preco, 'peso' => $this->peso, 'tipo' => 'item', 'equipavel' => $this->equipavel, 'loja' => true,
            'requer_sintonia' => $this->requer_sintonia, 'dados' => $this->dados, 'efeitos' => $this->efeitos ?? [], 'propria' => true,
        ];
    }
}
