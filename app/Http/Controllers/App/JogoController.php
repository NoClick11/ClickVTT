<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Models\Objeto;
use App\Models\Pagina;
use App\Support\AcessoMesa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Mesa de jogo. O servidor decide o que cada papel recebe (a camada do mestre nunca vai ao jogador). */
class JogoController extends Controller
{
    public function show(Request $request, Mesa $mesa): Response|RedirectResponse
    {
        $acesso = AcessoMesa::resolver($request, $mesa);
        if (! $acesso) {
            return redirect()->route('convite.show', $mesa->convite_token);
        }

        $mestre = $acesso->ehMestre();
        if ($mestre && ! $mesa->paginas()->exists()) {
            $mesa->paginas()->create(['nome' => 'Página 1', 'ordem' => 1]);
        }

        $pagina = $this->paginaAtual($request, $mesa, $acesso, $mestre);
        $objetos = $pagina
            ? $pagina->objetos()->when(! $mestre, fn ($q) => $q->visivelAoJogador())->orderBy('z')->orderBy('id')->get()
            : collect();

        return Inertia::render('app/Jogo', [
            'mesa' => ['id' => $mesa->id, 'slug' => $mesa->slug, 'nome' => $mesa->nome, 'capa' => $mesa->capaUrl()],
            'personagem' => $acesso->personagem->paraFront(),
            'mestre' => $mestre,
            'pagina' => $pagina?->paraFront(),
            'objetos' => $objetos->map(fn (Objeto $o) => $o->paraFront())->values(),
            // Navegação entre páginas e posicionamento de jogadores: só o mestre.
            'paginas' => $mestre ? $mesa->paginas->map->paraFront()->values() : [],
            'pastas' => $mestre ? $mesa->pastas->map(fn ($p) => ['id' => $p->id, 'nome' => $p->nome, 'ordem' => $p->ordem])->values() : [],
            'personagens' => $mestre ? $mesa->personagens()->orderBy('nome')->get()->map->paraFront()->values() : [],
            'sairUrl' => route('convite.sair', $mesa->convite_token),
        ]);
    }

    /** Mestre navega livremente (?pagina=ID); jogador vê sempre a página onde o mestre o colocou. */
    private function paginaAtual(Request $request, Mesa $mesa, AcessoMesa $acesso, bool $mestre): ?Pagina
    {
        $escolhida = $mestre && $request->integer('pagina')
            ? $mesa->paginas()->find($request->integer('pagina'))
            : null;

        return $escolhida
            ?? ($acesso->personagem->pagina_id ? $mesa->paginas()->find($acesso->personagem->pagina_id) : null)
            ?? $mesa->paginas()->first();
    }
}
