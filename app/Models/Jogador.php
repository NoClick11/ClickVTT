<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;

/** Quem entra na mesa pelo convite (o mestre também é um jogador). Um jogador pode ter vários personagens. */
class Jogador extends Model
{
    protected $table = 'jogadores';

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

    public function personagens(): BelongsToMany
    {
        return $this->belongsToMany(Personagem::class, 'jogador_personagem');
    }

    public function ehMestre(): bool
    {
        return $this->papel === 'mestre';
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

    /** Versão pública (visível a todos na mesa). */
    public function publico(): array
    {
        return ['id' => $this->id, 'nome' => $this->nome, 'papel' => $this->papel, 'cor' => $this->cor];
    }
}
