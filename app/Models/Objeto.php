<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Objeto extends Model
{
    public const CAMADAS = ['mapa', 'mestre', 'jogadores', 'iluminacao'];

    public const TIPOS = ['imagem', 'token', 'luz', 'parede', 'traco', 'texto'];

    protected $table = 'objetos';

    protected $fillable = [
        'camada', 'tipo', 'personagem_id', 'nome', 'x', 'y', 'largura', 'altura', 'z',
        'arquivo', 'arquivo_tipo', 'dados',
    ];

    protected function casts(): array
    {
        return [
            'x' => 'float', 'y' => 'float', 'largura' => 'float', 'altura' => 'float',
            'dados' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::deleted(function (Objeto $o) {
            if ($o->arquivo) {
                Storage::disk('public')->delete($o->arquivo);
            }
        });
    }

    public function pagina(): BelongsTo
    {
        return $this->belongsTo(Pagina::class);
    }

    public function personagem(): BelongsTo
    {
        return $this->belongsTo(Personagem::class);
    }

    /**
     * O que um JOGADOR pode receber: mapa, jogadores e apenas o brilho das luzes.
     * A camada do mestre e as paredes nunca saem do servidor para jogadores.
     */
    public function scopeVisivelAoJogador(Builder $query): Builder
    {
        return $query->where(function (Builder $q) {
            $q->whereIn('camada', ['mapa', 'jogadores'])
                ->orWhere(fn (Builder $l) => $l->where('camada', 'iluminacao')->where('tipo', 'luz'));
        });
    }

    public function paraFront(): array
    {
        return [
            'id' => $this->id,
            'camada' => $this->camada,
            'tipo' => $this->tipo,
            'personagem_id' => $this->personagem_id,
            'nome' => $this->nome,
            'x' => $this->x, 'y' => $this->y,
            'largura' => $this->largura, 'altura' => $this->altura,
            'z' => $this->z,
            'arquivo' => $this->arquivo ? '/storage/'.$this->arquivo : null,
            'arquivo_tipo' => $this->arquivo_tipo,
            'dados' => $this->dados,
        ];
    }
}
