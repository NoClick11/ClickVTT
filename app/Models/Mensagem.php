<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Mensagem extends Model
{
    protected $table = 'mensagens';

    /** `jogador_id` = quem enviou (identidade, define a visibilidade); `personagem_id` = "falando como" (opcional). */
    protected $fillable = ['jogador_id', 'personagem_id', 'tipo', 'visibilidade', 'texto', 'dados'];

    protected function casts(): array
    {
        return ['dados' => 'array'];
    }

    public function mesa(): BelongsTo
    {
        return $this->belongsTo(Mesa::class);
    }

    public function jogador(): BelongsTo
    {
        return $this->belongsTo(Jogador::class);
    }

    public function personagem(): BelongsTo
    {
        return $this->belongsTo(Personagem::class);
    }

    /** Autor exibido: o personagem quando o jogador falou "como" ele; senão o próprio jogador. */
    private function autor(): ?array
    {
        $origem = $this->personagem ?? $this->jogador;

        return $origem ? [
            'id' => $this->jogador_id, // identidade (para "(você)" e não lidas)
            'personagem_id' => $this->personagem_id,
            'nome' => $origem->nome,
            'cor' => $origem->cor,
        ] : null;
    }

    /**
     * Payload da rolagem no formato atual `{expressao, rotulo, termos[], total}`. Mensagens antigas
     * (`{dado, faces, quantidade, resultados, total}`) são convertidas na leitura.
     */
    private function dadosDeRolagem(): ?array
    {
        $d = $this->dados;
        if (! is_array($d) || isset($d['termos']) || ! isset($d['resultados'], $d['faces'])) {
            return $d;
        }
        $expressao = ($d['quantidade'] > 1 ? $d['quantidade'] : '').($d['dado'] ?? 'd'.$d['faces']);

        return [
            'expressao' => $expressao,
            'rotulo' => null,
            'termos' => [[
                'tipo' => 'dados', 'expressao' => $expressao, 'faces' => $d['faces'], 'resultados' => $d['resultados'],
                'descartados' => [], 'subtotal' => $d['total'], 'sinal' => 1,
            ]],
            'total' => $d['total'],
        ];
    }

    /**
     * Mensagem como o jogador `$quem` deve enxergar, ou null se não deve ver nada.
     * - todos: todos veem.
     * - mestre: só o mestre e o autor.
     * - secreto: o mestre vê o resultado; os demais veem só o aviso, sem números.
     */
    public function para(Jogador $quem): ?array
    {
        $mestre = $quem->papel === 'mestre';
        $autor = $this->jogador_id !== null && $this->jogador_id === $quem->id;
        $base = [
            'id' => $this->id,
            'tipo' => $this->tipo,
            'visibilidade' => $this->visibilidade,
            'autor' => $this->autor(),
            'texto' => $this->texto,
            'dados' => $this->dadosDeRolagem(),
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
            'todos' => $this->para(new Jogador(['papel' => 'jogador'])),
            'secreto' => [
                'id' => $this->id, 'tipo' => $this->tipo, 'visibilidade' => 'secreto_oculto',
                'autor' => $this->autor(), 'texto' => 'rolou dados em segredo', 'dados' => null,
                'criada_em' => $this->created_at?->toIso8601String(),
            ],
            default => null,
        };
    }
}
