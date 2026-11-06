<?php

namespace App\Models;

use App\Nucleo\Sistemas\Sistema;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** Ficha (PC ou NPC). Pode pertencer a vários jogadores e um jogador pode ter vários personagens. */
class Personagem extends Model
{
    protected $table = 'personagens';

    protected $fillable = ['nome', 'cor'];

    /** `ficha` e `criacao` só mudam pela API da ficha (validada pelo sistema), nunca por atribuição em massa. */
    protected function casts(): array
    {
        return ['ficha' => 'array', 'criacao' => 'array'];
    }

    public function mesa(): BelongsTo
    {
        return $this->belongsTo(Mesa::class);
    }

    public function jogadores(): BelongsToMany
    {
        return $this->belongsToMany(Jogador::class, 'jogador_personagem');
    }

    /**
     * Público: nome, cor e quem joga com ele (carregue `jogadores` antes para evitar N+1).
     * `$comFicha` inclui os dados da ficha (só para o mestre e os jogadores do personagem); sem ficha salva,
     * vale a ficha padrão do `$sistema`.
     */
    public function paraFront(bool $comFicha = false, ?Sistema $sistema = null): array
    {
        return [
            ...($comFicha ? ['ficha' => $this->ficha ?? $sistema?->fichaPadrao(), 'criacao' => $this->criacao] : []),
            'id' => $this->id,
            'nome' => $this->nome,
            'cor' => $this->cor,
            'jogadores' => $this->jogadores->map(fn (Jogador $j) => ['id' => $j->id, 'nome' => $j->nome, 'cor' => $j->cor])->values(),
        ];
    }
}
