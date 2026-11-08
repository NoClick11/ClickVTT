<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class Mesa extends Model
{
    protected $fillable = [
        'nome', 'slug', 'sistema_id', 'descricao', 'capa', 'tema_entrada', 'favorita', 'travada', 'fogo_amigo',
    ];

    protected function casts(): array
    {
        return [
            'combate' => 'array',
            'favorita' => 'boolean',
            'travada' => 'boolean',
            'fogo_amigo' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::creating(function (Mesa $mesa) {
            $mesa->convite_token ??= Str::random(32);
        });

        static::deleted(function (Mesa $mesa) {
            if ($mesa->capa) {
                Storage::disk('public')->delete($mesa->capa);
            }
        });
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function sistema(): BelongsTo
    {
        return $this->belongsTo(Sistema::class);
    }

    public function personagens(): HasMany
    {
        return $this->hasMany(Personagem::class);
    }

    public function jogadores(): HasMany
    {
        return $this->hasMany(Jogador::class);
    }

    public function paginas(): HasMany
    {
        return $this->hasMany(Pagina::class)->orderBy('ordem')->orderBy('id');
    }

    public function pastas(): HasMany
    {
        return $this->hasMany(Pasta::class)->orderBy('ordem')->orderBy('id');
    }

    public function diarioPastas(): HasMany
    {
        return $this->hasMany(DiarioPasta::class)->orderBy('nome');
    }

    public function folhetos(): HasMany
    {
        return $this->hasMany(Folheto::class)->orderBy('nome');
    }

    public function itensDeCatalogo(): HasMany
    {
        return $this->hasMany(ItemDeCatalogo::class);
    }

    public function lojasAbertas(): HasMany
    {
        return $this->hasMany(LojaAberta::class);
    }

    public function itens(): HasMany
    {
        return $this->hasMany(Item::class);
    }

    public function eventosDeCombate(): HasMany
    {
        return $this->hasMany(EventoDeCombate::class);
    }

    public function mensagens(): HasMany
    {
        return $this->hasMany(Mensagem::class);
    }

    public function capaUrl(): ?string
    {
        return $this->capa ? '/storage/'.$this->capa : null;
    }
}
