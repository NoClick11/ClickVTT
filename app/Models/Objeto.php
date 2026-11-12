<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

class Objeto extends Model
{
    public const CAMADAS = ['mapa', 'mestre', 'jogadores', 'iluminacao'];

    public const TIPOS = ['imagem', 'token', 'luz', 'parede', 'traco', 'texto', 'loot', 'viagem'];

    protected $table = 'objetos';

    protected $fillable = [
        'camada', 'tipo', 'personagem_id', 'jogador_id', 'nome', 'x', 'y', 'largura', 'altura', 'z',
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
                self::apagarArquivoSeOrfao($o->arquivo);
            }
        });
    }

    /**
     * Apaga o arquivo de um objeto excluído, mas só se ninguém mais o usa. A foto do token (`personagens/...`) é do PERSONAGEM
     * (todos os tokens dele, em todas as páginas, apontam para o mesmo arquivo: quem a troca ou remove é a tela de foto), e uma
     * página duplicada divide os arquivos com a original. Sem isto, excluir um token apagava a imagem de todos os outros.
     *
     * @param  int|null  $foraDaPagina  ignora os objetos desta página (ela está sendo excluída)
     */
    public static function apagarArquivoSeOrfao(string $arquivo, ?int $foraDaPagina = null): void
    {
        if (str_starts_with($arquivo, 'personagens/') || str_starts_with($arquivo, '/storage/personagens/') || str_starts_with($arquivo, 'http')) {
            return;
        }
        $emUso = self::query()->where('arquivo', $arquivo)
            ->when($foraDaPagina !== null, fn ($q) => $q->where('pagina_id', '!=', $foraDaPagina))
            ->exists();
        if (! $emUso) {
            Storage::disk('public')->delete($arquivo);
        }
    }

    public function pagina(): BelongsTo
    {
        return $this->belongsTo(Pagina::class);
    }

    public function jogador(): BelongsTo
    {
        return $this->belongsTo(Jogador::class);
    }

    public function personagem(): BelongsTo
    {
        return $this->belongsTo(Personagem::class);
    }

    /**
     * O que um JOGADOR pode receber: mapa, jogadores, as luzes e a geometria das paredes. A camada do mestre nunca sai do servidor
     * para jogadores.
     */
    public function scopeVisivelAoJogador(Builder $query): Builder
    {
        return $query->where(function (Builder $q) {
            $q->whereIn('camada', ['mapa', 'jogadores'])
                // As paredes vão ao navegador do jogador porque ele calcula a visão e as sombras (e antecipa o bloqueio do movimento);
                // elas não são desenhadas para ele, só as portas e janelas viram um controle.
                ->orWhere(fn (Builder $l) => $l->where('camada', 'iluminacao')->whereIn('tipo', ['luz', 'parede']));
        });
    }

    public function paraFront(): array
    {
        return [
            'id' => $this->id,
            'camada' => $this->camada,
            'tipo' => $this->tipo,
            'personagem_id' => $this->personagem_id,
            'jogador_id' => $this->jogador_id,
            'nome' => $this->nome,
            'x' => $this->x, 'y' => $this->y,
            'largura' => $this->largura, 'altura' => $this->altura,
            'z' => $this->z,
            'arquivo' => $this->arquivo
                ? (str_starts_with($this->arquivo, 'http://') || str_starts_with($this->arquivo, 'https://') || str_starts_with($this->arquivo, '/storage/')
                    ? $this->arquivo
                    : '/storage/'.$this->arquivo)
                : null,
            'arquivo_tipo' => $this->arquivo_tipo,
            'dados' => $this->dados,
        ];
    }
}
