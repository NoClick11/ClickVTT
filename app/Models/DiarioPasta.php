<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** Pasta do diário da mesa: guarda personagens, folhetos e outras pastas. */
class DiarioPasta extends Model
{
    protected $table = 'diario_pastas';

    protected $fillable = ['nome', 'pai_id'];

    public function paraFront(): array
    {
        return ['id' => $this->id, 'nome' => $this->nome, 'pai_id' => $this->pai_id];
    }
}
