<?php

namespace App\Support;

use App\Http\Controllers\Site\ConviteController;
use App\Models\Mesa;
use App\Models\Personagem;
use Illuminate\Http\Request;

/**
 * Quem está acessando a mesa de jogo: o personagem que entrou pelo convite (sessão).
 * Mestre = personagem com papel "mestre". Não há atalho pela conta logada.
 */
final class AcessoMesa
{
    private function __construct(public readonly Personagem $personagem) {}

    public static function resolver(Request $request, Mesa $mesa): ?self
    {
        $id = $request->session()->get(ConviteController::SESSAO.'.'.$mesa->id);
        $personagem = $id ? $mesa->personagens()->find($id) : null;

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
