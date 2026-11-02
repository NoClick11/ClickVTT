<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Mensagem extends Model
{
    protected $table = 'mensagens';

    public const DADOS = ['d4' => 4, 'd6' => 6, 'd8' => 8, 'd10' => 10, 'd12' => 12, 'd20' => 20, 'd100' => 100];

    protected $fillable = ['personagem_id', 'tipo', 'visibilidade', 'texto', 'dados'];

    protected function casts(): array
    {
        return ['dados' => 'array'];
    }

    public function mesa(): BelongsTo
    {
        return $this->belongsTo(Mesa::class);
    }

    public function personagem(): BelongsTo
    {
        return $this->belongsTo(Personagem::class);
    }

    /**
     * Mensagem como o personagem `$verId` (mestre?) deve enxergar, ou null se não deve ver nada.
     * - todos: todos veem.
     * - mestre: só o mestre e o autor.
     * - secreto: o mestre vê o resultado; os demais veem só o aviso, sem números.
     */
    public function para(Personagem $quem): ?array
    {
        $mestre = $quem->papel === 'mestre';
        $autor = $this->personagem_id === $quem->id;
        $base = [
            'id' => $this->id,
            'tipo' => $this->tipo,
            'visibilidade' => $this->visibilidade,
            'autor' => $this->personagem ? ['id' => $this->personagem->id, 'nome' => $this->personagem->nome, 'cor' => $this->personagem->cor] : null,
            'texto' => $this->texto,
            'dados' => $this->dados,
            'criada_em' => $this->created_at?->toIso8601String(),
        ];

        return match ($this->visibilidade) {
            'todos' => $base,
            'mestre' => ($mestre || $autor) ? $base : null,
            'secreto' => $mestre ? $base : [...$base, 'texto' => 'rolou dados em segredo', 'dados' => null, 'visibilidade' => 'secreto_oculto'],
            default => null,
        };
    }

    /** Versão sem dados secretos, para o canal aberto da mesa. */
    public function publica(): ?array
    {
        return match ($this->visibilidade) {
            'todos' => $this->para(new Personagem(['papel' => 'jogador'])),
            'secreto' => [
                'id' => $this->id, 'tipo' => $this->tipo, 'visibilidade' => 'secreto_oculto',
                'autor' => $this->personagem ? ['id' => $this->personagem->id, 'nome' => $this->personagem->nome, 'cor' => $this->personagem->cor] : null,
                'texto' => 'rolou dados em segredo', 'dados' => null, 'criada_em' => $this->created_at?->toIso8601String(),
            ],
            default => null,
        };
    }
}
