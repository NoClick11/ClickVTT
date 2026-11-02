<?php

namespace App\Support;

use App\Http\Controllers\Site\ConviteController;
use App\Models\Mesa;
use App\Models\Personagem;
use Illuminate\Http\Request;

/**
 * Quem está acessando a mesa de jogo. A sessão guarda TODOS os personagens autenticados neste
 * navegador (`acesso_mesas.{mesa}.{personagem} = true`), então o mestre e um jogador podem
 * estar abertos ao mesmo tempo, cada um na sua aba. Cada aba informa QUEM é: pela URL
 * (`/jogo/{mesa}/{personagem}`) ou pelo cabeçalho `X-Personagem` nas chamadas da API.
 * O personagem informado só vale se já tiver entrado (senha) neste navegador.
 * Mestre = personagem com papel "mestre". Não há atalho pela conta logada.
 */
final class AcessoMesa
{
    private function __construct(public readonly Personagem $personagem) {}

    /** Ids dos personagens que já entraram nesta mesa neste navegador. */
    public static function autorizados(Request $request, Mesa $mesa): array
    {
        return array_map('intval', array_keys((array) $request->session()->get(ConviteController::SESSAO.'.'.$mesa->id, [])));
    }

    public static function resolver(Request $request, Mesa $mesa, ?int $personagemId = null): ?self
    {
        $autorizados = self::autorizados($request, $mesa);
        $id = $personagemId ?? ($request->header('X-Personagem') !== null ? (int) $request->header('X-Personagem') : null);
        // Sem indicação, só vale se houver um único personagem autenticado (sem ambiguidade).
        $id ??= count($autorizados) === 1 ? $autorizados[0] : null;
        if ($id === null || ! in_array($id, $autorizados, true)) {
            return null;
        }
        $personagem = $mesa->personagens()->find($id);

        return $personagem ? new self($personagem) : null;
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
        return $this->personagem->papel === 'mestre';
    }
}
