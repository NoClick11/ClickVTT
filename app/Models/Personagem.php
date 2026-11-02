<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Personagem extends Model
{
    protected $table = 'personagens';

    public const PAPEIS = ['jogador', 'mestre'];

    protected $fillable = ['nome', 'papel', 'cor', 'senha', 'pagina_id'];

    protected $hidden = ['senha'];

    protected function casts(): array
    {
        return ['senha' => 'hashed'];
    }

    public function mesa(): BelongsTo
    {
        return $this->belongsTo(Mesa::class);
    }

    public function pagina(): BelongsTo
    {
        return $this->belongsTo(Pagina::class);
    }

    /** Dados seguros para o front (nunca expõe o hash). */
    public function paraFront(): array
    {
        return [
            'id' => $this->id,
            'nome' => $this->nome,
            'papel' => $this->papel,
            'cor' => $this->cor,
            'tem_senha' => $this->senha !== null,
            'pagina_id' => $this->pagina_id,
        ];
    }
}
