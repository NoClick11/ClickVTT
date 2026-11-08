<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

/** Imagem (com texto opcional) que o mestre guarda no diário e mostra aos jogadores. */
class Folheto extends Model
{
    protected $fillable = ['nome', 'pasta_id', 'imagem', 'texto', 'visivel'];

    protected function casts(): array
    {
        return ['visivel' => 'boolean'];
    }

    protected static function booted(): void
    {
        static::deleted(fn (self $f) => Storage::disk('public')->delete($f->imagem));
    }

    public function paraFront(): array
    {
        return [
            'id' => $this->id,
            'nome' => $this->nome,
            'pasta_id' => $this->pasta_id,
            'imagem' => '/storage/'.$this->imagem,
            'texto' => $this->texto,
            'visivel' => $this->visivel,
        ];
    }
}
