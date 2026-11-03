<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Models\Objeto;
use App\Models\Pagina;
use App\Models\Jogador;
use App\Support\AcessoMesa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

/** Mesa de jogo. O servidor decide o que cada papel recebe (a camada do mestre nunca vai ao jogador). */
class JogoController extends Controller
{
    /** Sem personagem na URL: entra direto se houver um só personagem autenticado; senão, convite. */
    public function entrada(Request $request, Mesa $mesa): RedirectResponse
    {
        $acesso = AcessoMesa::resolver($request, $mesa);

        return $acesso
            ? to_route('jogo', [$mesa->slug, $acesso->jogador->id])
            : redirect()->route('convite.show', $mesa->convite_token);
    }

    public function show(Request $request, Mesa $mesa, Jogador $jogador): Response|RedirectResponse
    {
        abort_unless($jogador->mesa_id === $mesa->id, 404);
        $acesso = AcessoMesa::resolver($request, $mesa, $jogador->id);
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
            'jogador' => $acesso->jogador->paraFront(),
            'mestre' => $mestre,
            'pagina' => $pagina?->paraFront(),
            'objetos' => $objetos->map(fn (Objeto $o) => $o->paraFront())->values(),
            // Navegação entre páginas e posicionamento de jogadores: só o mestre.
            'paginas' => $mestre ? $mesa->paginas->map->paraFront()->values() : [],
            'pastas' => $mestre ? $mesa->pastas->map(fn ($p) => ['id' => $p->id, 'nome' => $p->nome, 'ordem' => $p->ordem])->values() : [],
            // Todos veem quem joga e os personagens (com os donos); só o mestre vê a página de cada jogador.
            'jogadores' => $mesa->jogadores()->orderByRaw("papel = 'mestre' desc")->orderBy('nome')->get()
                ->map(fn ($j) => $mestre ? $j->paraFront() : $j->publico())->values(),
            'personagens' => $mesa->personagens()->with('jogadores')->orderBy('nome')->get()->map->paraFront()->values(),
            // Personagens que ESTE jogador controla (o mestre controla todos): tokens que ele pode mover e "falar como".
            'meusPersonagens' => $acesso->personagensPermitidos(),
            'combate' => $mesa->combate ?? ['ativo' => false, 'rodada' => 1, 'atual' => null, 'itens' => []],
            'mensagens' => $mesa->mensagens()->with(['personagem', 'jogador'])->latest('id')->limit(80)->get()->reverse()
                ->map(fn ($m) => $m->para($acesso->jogador))->filter()->values(),
            'sairUrl' => route('convite.sair', $mesa->convite_token).'?jogador='.$acesso->jogador->id,
        ]);
    }

    /** Mestre navega livremente (?pagina=ID); jogador vê sempre a página onde o mestre o colocou. */
    private function paginaAtual(Request $request, Mesa $mesa, AcessoMesa $acesso, bool $mestre): ?Pagina
    {
        $escolhida = $mestre && $request->integer('pagina')
            ? $mesa->paginas()->find($request->integer('pagina'))
            : null;

        return $escolhida
            ?? ($acesso->jogador->pagina_id ? $mesa->paginas()->find($acesso->jogador->pagina_id) : null)
            ?? $mesa->paginas()->first();
    }
}
