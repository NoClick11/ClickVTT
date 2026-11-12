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

    protected $fillable = ['nome', 'cor', 'pasta_id'];

    /** `ficha` e `criacao` só mudam pela API da ficha (validada pelo sistema), nunca por atribuição em massa. */
    protected function casts(): array
    {
        return ['ficha' => 'array', 'criacao' => 'array'];
    }

    /**
     * A ficha salva completada com a ficha padrão do sistema: campos que passaram a existir depois de a ficha ser salva
     * (ex.: `akuma`, `pp`) valem o padrão, em vez de faltar e deixar a tela em branco. Sem ficha salva, é a padrão.
     * As listas padrão são vazias, então uma lista salva nunca é misturada com o padrão.
     *
     * @return array<string, mixed>
     */
    public function fichaCompleta(Sistema $sistema): array
    {
        return array_replace_recursive($sistema->fichaPadrao(), $this->ficha ?? []);
    }

    /**
     * Só os navios (ou, com `false`, só quem não é navio). `->>` devolve NULL de SQL tanto para a chave ausente quanto para o
     * `null` do JSON (a ficha padrão guarda `navio: null`).
     */
    public function scopeNavios($query, bool $sim = true)
    {
        return $query->whereRaw("(ficha::jsonb ->> 'navio') is ".($sim ? 'not null' : 'null'));
    }

    public function ehNavio(): bool
    {
        return is_array($this->ficha['navio'] ?? null);
    }

    /**
     * Quem recebe as mudanças desta ficha em tempo real: o mestre e os jogadores do personagem; a do navio, a mesa inteira.
     *
     * @return list<string>
     */
    public function canaisDaFicha(): array
    {
        return $this->ehNavio()
            ? ['mesa']
            : ['mestre', ...$this->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all()];
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
     * `status` (ids das condições ativas, ex.: `envenenado`) também é público: aparece como ícone no token de todo mundo.
     * `$comFicha` inclui os dados da ficha (só para o mestre e os jogadores do personagem); sem ficha salva,
     * vale a ficha padrão do `$sistema`.
     */
    public function paraFront(bool $comFicha = false, ?Sistema $sistema = null): array
    {
        return [
            ...($comFicha ? ['ficha' => $sistema ? $this->fichaCompleta($sistema) : $this->ficha, 'criacao' => $this->criacao] : []),
            'id' => $this->id,
            'pasta_id' => $this->pasta_id,
            'nome' => $this->nome,
            'cor' => $this->cor,
            'foto' => $this->ficha['foto'] ?? null,
            'foto_token' => $this->ficha['foto_token'] ?? $this->ficha['foto'] ?? null,
            'status' => array_values($this->ficha['condicoes'] ?? []),
            // NPC marcado pelo mestre como aliado dos jogadores: os jogadores não o atingem (sem fogo amigo)
            'aliado' => (bool) ($this->ficha['aliado'] ?? false),
            // NPC com 0 de vida: morto, recebe indicador e não pode ser alvo
            'morto' => (bool) (($this->ficha['npc'] ?? false) && ((int) ($this->ficha['pv']['atual'] ?? 1) <= 0)),
            // Navio: a ficha é de toda a mesa (construção, tesouro e carga compartilhados)
            'navio' => $this->ehNavio(),
            'jogadores' => $this->jogadores->map(fn (Jogador $j) => ['id' => $j->id, 'nome' => $j->nome, 'cor' => $j->cor])->values(),
        ];
    }
}
