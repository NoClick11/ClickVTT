<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sistema extends Model
{
    protected $fillable = ['slug', 'nome', 'descricao', 'icone', 'ativo'];

    protected function casts(): array
    {
        return ['ativo' => 'boolean'];
    }

    public function mesas(): HasMany
    {
        return $this->hasMany(Mesa::class);
    }
}
