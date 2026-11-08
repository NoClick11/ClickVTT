<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class Pagina extends Model
{
    protected $fillable = [
        'nome', 'pasta_id', 'ordem', 'colunas', 'linhas', 'tamanho_quadrado',
        'grade_quadrada', 'distancia_quadrado', 'unidade', 'iluminacao_ativa', 'luz_ambiente', 'visao_padrao', 'usar_visao', 'memoria_ativa',
    ];

    protected function casts(): array
    {
        return [
            'grade_quadrada' => 'boolean',
            'distancia_quadrado' => 'float',
            'iluminacao_ativa' => 'boolean',
            'usar_visao' => 'boolean',
            'memoria_ativa' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        // O cascade do banco remove as linhas; aqui removemos os arquivos enviados.
        static::deleting(function (Pagina $pagina) {
            $pagina->objetos()->whereNotNull('arquivo')->pluck('arquivo')
                ->each(fn ($a) => Storage::disk('public')->delete($a));
        });
    }

    public function mesa(): BelongsTo
    {
        return $this->belongsTo(Mesa::class);
    }

    public function pasta(): BelongsTo
    {
        return $this->belongsTo(Pasta::class);
    }

    public function objetos(): HasMany
    {
        return $this->hasMany(Objeto::class);
    }

    public function paraFront(): array
    {
        return [
            'id' => $this->id,
            'pasta_id' => $this->pasta_id,
            'nome' => $this->nome,
            'ordem' => $this->ordem,
            'colunas' => $this->colunas,
            'linhas' => $this->linhas,
            'tamanho_quadrado' => $this->tamanho_quadrado,
            'grade_quadrada' => $this->grade_quadrada,
            'distancia_quadrado' => $this->distancia_quadrado,
            'unidade' => $this->unidade,
            'iluminacao_ativa' => (bool) $this->iluminacao_ativa,
            'luz_ambiente' => (int) ($this->luz_ambiente ?? 0),
            'visao_padrao' => (int) ($this->visao_padrao ?? 6),
            'usar_visao' => (bool) ($this->usar_visao ?? true),
            'memoria_ativa' => (bool) ($this->memoria_ativa ?? true),
        ];
    }
}
