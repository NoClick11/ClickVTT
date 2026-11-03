<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** Ficha (PC ou NPC). Pode pertencer a vários jogadores e um jogador pode ter vários personagens. */
class Personagem extends Model
{
    protected $table = 'personagens';

    protected $fillable = ['nome', 'cor'];

    public function mesa(): BelongsTo
    {
        return $this->belongsTo(Mesa::class);
    }

    public function jogadores(): BelongsToMany
    {
        return $this->belongsToMany(Jogador::class, 'jogador_personagem');
    }

    /** Público: nome, cor e quem joga com ele (carregue `jogadores` antes para evitar N+1). */
    public function paraFront(): array
    {
        return [
            'id' => $this->id,
            'nome' => $this->nome,
            'cor' => $this->cor,
            'jogadores' => $this->jogadores->map(fn (Jogador $j) => ['id' => $j->id, 'nome' => $j->nome, 'cor' => $j->cor])->values(),
        ];
    }
}
