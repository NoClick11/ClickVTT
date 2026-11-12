<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Jogador;
use App\Models\Mesa;
use App\Models\Objeto;
use App\Models\Pagina;
use App\Nucleo\Combate\CombateService;
use App\Nucleo\Combate\Pipeline;
use App\Nucleo\Combate\SistemaDeCombate;
use App\Nucleo\Loja\LojaService;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Support\AcessoMesa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
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

    public function show(Request $request, Mesa $mesa, Jogador $jogador, RegistroSistemas $sistemas, Pipeline $pipeline): Response|RedirectResponse
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

        $personagens = $mesa->personagens()->with('jogadores')->orderBy('nome')->get();

        return Inertia::render('app/Jogo', [
            'mesa' => ['id' => $mesa->id, 'slug' => $mesa->slug, 'nome' => $mesa->nome, 'capa' => $mesa->capaUrl(), 'fogo_amigo' => (bool) $mesa->fogo_amigo,
                // O que o mestre liberou aos jogadores: descansar (curto/longo) e subir de nível.
                'descanso_curto' => (bool) $mesa->descanso_curto, 'descanso_longo' => (bool) $mesa->descanso_longo, 'subir_nivel' => (bool) $mesa->subir_nivel,
                'musica' => $mesa->musica ?? null,
                'tempo' => $mesa->tempo ?? ['dia' => 1, 'hora' => 8, 'minuto' => 0]],
            // `modulo` = existe módulo do sistema no servidor; o front resolve o seu pelo mesmo slug.
            'sistema' => ['slug' => $mesa->sistema->slug, 'nome' => $mesa->sistema->nome, 'modulo' => $sistemas->possui($mesa->sistema->slug)],
            'jogador' => $acesso->jogador->paraFront(),
            'mestre' => $mestre,
            'pagina' => $pagina?->paraFront(),
            'objetos' => $objetos->map(fn (Objeto $o) => $o->paraFront())->values(),
            // Navegação entre páginas e posicionamento de jogadores: só o mestre.
            'paginas' => $mestre ? $mesa->paginas()->with(['objetos' => fn ($q) => $q->where('tipo', 'imagem')->whereNotNull('arquivo')])->get()->map->paraFront()->values() : [],
            'pastas' => $mestre ? $mesa->pastas->map(fn ($p) => ['id' => $p->id, 'nome' => $p->nome, 'ordem' => $p->ordem])->values() : [],
            // Diário (pastas e folhetos): o mestre vê tudo; o jogador, só os folhetos liberados e as pastas que os contêm.
            'diario' => $this->diario($mesa, $mestre),
            // Todos veem quem joga e os personagens (com os donos); só o mestre vê a página de cada jogador.
            'jogadores' => $mesa->jogadores()->orderByRaw("papel = 'mestre' desc")->orderBy('nome')->get()
                ->map(fn ($j) => $mestre ? $j->paraFront() : $j->publico())->values(),
            // A ficha em si só vai ao mestre e aos jogadores do personagem.
            'personagens' => $personagens->map(fn ($p) => $p->paraFront($acesso->podeControlar($p->id) || $p->ehNavio(), $sistemas->resolver($mesa->sistema->slug)))->values(),
            // Personagens que ESTE jogador controla (o mestre controla todos): tokens que ele pode mover e "falar como".
            'meusPersonagens' => $acesso->personagensPermitidos(),
            // Itens da mesa: o mestre vê todos; o jogador só os que aparecem nas fichas que ele controla.
            'itens' => $this->itensVisiveis($mesa, $acesso, $personagens, $sistemas),
            // Loja: o mestre vê as lojas abertas e os itens que criou; o jogador, só a loja aberta para ele (com os itens do mestre
            // das categorias dela). O catálogo do sistema é do módulo no front.
            'lojasAbertas' => $mestre ? $mesa->lojasAbertas()->get()->map->paraFront()->values() : [],
            'catalogoDoMestre' => $mestre ? $mesa->itensDeCatalogo()->orderBy('nome')->get()->map->paraFront()->values() : [],
            'lojaDoJogador' => $mestre ? null : $this->lojaDoJogador($mesa, $acesso),
            'combate' => CombateService::normalizar($mesa->combate),
            // Janelas de reação abertas e as ofertas dos personagens que este jogador controla (para quem entra no meio de um ataque).
            'reacoes' => $pipeline->pendentesPara($mesa, $acesso),
            // Categorias de ação do sistema da mesa (padrão, poderosa, bônus, livre, reação...): a tela rotula e trava por elas.
            'categoriasDeAcao' => ($s = $sistemas->resolver($mesa->sistema->slug)) instanceof SistemaDeCombate ? $s->categoriasDeAcao() : [],
            'mensagens' => $mesa->mensagens()->with(['personagem', 'jogador'])->latest('id')->limit(80)->get()->reverse()
                ->map(fn ($m) => $m->para($acesso->jogador))->filter()->values(),
            'sairUrl' => route('convite.sair', $mesa->convite_token, false).'?jogador='.$acesso->jogador->id,
        ]);
    }

    /** @return array{pastas: list<array>, folhetos: list<array>} */
    private function diario(Mesa $mesa, bool $mestre): array
    {
        $pastas = $mesa->diarioPastas()->get();
        $folhetos = $mesa->folhetos()->when(! $mestre, fn ($q) => $q->where('visivel', true))->get();
        if (! $mestre) {
            $porId = $pastas->keyBy('id');
            $uteis = [];
            foreach ($folhetos as $f) {
                for ($id = $f->pasta_id; $id && isset($porId[$id]) && ! isset($uteis[$id]); $id = $porId[$id]->pai_id) {
                    $uteis[$id] = true;
                }
            }
            $pastas = $pastas->filter(fn ($p) => isset($uteis[$p->id]));
        }

        return ['pastas' => $pastas->map->paraFront()->values()->all(), 'folhetos' => $folhetos->map->paraFront()->values()->all()];
    }

    /** A loja aberta para este jogador (categorias, ajuste de preço e os itens criados pelo mestre nelas) ou null. */
    private function lojaDoJogador(Mesa $mesa, AcessoMesa $acesso): ?array
    {
        $aberta = $mesa->lojasAbertas()->where('jogador_id', $acesso->jogador->id)->first();
        if (! $aberta) {
            return null;
        }

        return $aberta->paraFront() + ['itens' => app(LojaService::class)->itensProprios($mesa, $aberta->categorias, $aberta->raridades ?? [])->map->paraFront()->values()->all()];
    }

    /** @return Collection<int, array> */
    private function itensVisiveis(Mesa $mesa, AcessoMesa $acesso, $personagens, RegistroSistemas $sistemas)
    {
        if ($acesso->ehMestre()) {
            return $mesa->itens()->orderBy('nome')->get()->map->paraFront()->values();
        }
        $sistema = $sistemas->resolver($mesa->sistema->slug);
        $ids = $sistema
            ? $personagens->filter(fn ($p) => $p->ficha && ($acesso->podeControlar($p->id) || $p->ehNavio()))->flatMap(fn ($p) => $sistema->itensReferenciados($p->ficha))->unique()->values()->all()
            : [];

        return $ids ? $mesa->itens()->whereIn('id', $ids)->orderBy('nome')->get()->map->paraFront()->values() : collect();
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
