<?php

namespace App\Support;

use App\Http\Controllers\Site\ConviteController;
use App\Models\Jogador;
use App\Models\Mesa;
use Illuminate\Http\Request;

/**
 * Quem está acessando a mesa de jogo: um JOGADOR que entrou pelo convite (senha).
 * A sessão guarda TODOS os jogadores autenticados neste navegador
 * (`acesso_mesas.{mesa}.{jogador} = true`), então o mestre e um jogador podem estar abertos ao
 * mesmo tempo, cada um na sua aba. Cada aba informa QUEM é: pela URL (`/jogo/{mesa}/{jogador}`)
 * ou pelo cabeçalho `X-Jogador` nas chamadas da API. Só vale se já entrou (senha) neste navegador.
 * Mestre = jogador com papel "mestre". Não há atalho pela conta logada.
 */
final class AcessoMesa
{
    /** @var list<int>|null */
    private ?array $permitidos = null;

    private function __construct(public readonly Jogador $jogador, private readonly Mesa $mesa) {}

    /** Ids dos jogadores que já entraram nesta mesa neste navegador. */
    public static function autorizados(Request $request, Mesa $mesa): array
    {
        return array_map('intval', array_keys((array) $request->session()->get(ConviteController::SESSAO.'.'.$mesa->id, [])));
    }

    public static function resolver(Request $request, Mesa $mesa, ?int $jogadorId = null): ?self
    {
        $autorizados = self::autorizados($request, $mesa);
        $id = $jogadorId ?? ($request->header('X-Jogador') !== null ? (int) $request->header('X-Jogador') : null);
        // Sem indicação, só vale se houver um único jogador autenticado (sem ambiguidade).
        $id ??= count($autorizados) === 1 ? $autorizados[0] : null;
        if ($id === null || ! in_array($id, $autorizados, true)) {
            return null;
        }
        $jogador = $mesa->jogadores()->find($id);

        return $jogador ? new self($jogador, $mesa) : null;
    }

    /** Exige acesso (qualquer papel); aborta 403 se não entrou pelo convite. */
    public static function exigir(Request $request, Mesa $mesa): self
    {
        return self::resolver($request, $mesa) ?? abort(403, 'Entre pelo link de convite.');
    }

    /** Exige que o acesso seja do Mestre. */
    public static function exigirMestre(Request $request, Mesa $mesa): self
    {
        $acesso = self::exigir($request, $mesa);
        abort_unless($acesso->ehMestre(), 403, 'Apenas o mestre pode fazer isso.');

        return $acesso;
    }

    public function ehMestre(): bool
    {
        return $this->jogador->papel === 'mestre';
    }

    /**
     * Personagens que este jogador controla: os do pivô; o mestre controla todos da mesa.
     *
     * @return list<int>
     */
    public function personagensPermitidos(): array
    {
        return $this->permitidos ??= ($this->ehMestre()
            ? $this->mesa->personagens()->pluck('id')->all()
            : $this->jogador->personagens()->pluck('personagens.id')->all());
    }

    public function podeControlar(?int $personagemId): bool
    {
        return $personagemId !== null && in_array($personagemId, $this->personagensPermitidos(), true);
    }
}
