<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Loot;
use App\Models\Mesa;
use App\Models\Objeto;
use App\Models\Pagina;
use App\Nucleo\Loja\LojaService;
use App\Nucleo\Loot\LootIndisponivel;
use App\Nucleo\Loot\LootService;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Nucleo\Sistemas\SistemaComLoja;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Loot no mapa: um objeto (baú, saco...) com itens e dinheiro. SÓ O MESTRE cria e monta; na camada Mestre ninguém mais o vê, e na
 * camada Jogadores qualquer jogador da mesma página abre e pega. Quem manda é o servidor: a retirada trava o loot (ver LootService),
 * então cliques simultâneos nunca duplicam nem passam do que existe; quem chega tarde recebe 409 já com o estado atualizado.
 */
class LootController extends Controller
{
    public function criar(Request $request, Mesa $mesa, Pagina $pagina): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($pagina->mesa_id === $mesa->id, 404);
        $d = $request->validate([
            'nome' => ['nullable', 'string', 'max:80'],
            'camada' => ['required', Rule::in(['mestre', 'jogadores'])],
            'x' => ['required', 'numeric'],
            'y' => ['required', 'numeric'],
        ]);
        $lado = (float) $pagina->tamanho_quadrado;
        $loot = DB::transaction(function () use ($mesa, $pagina, $d, $lado) {
            $objeto = $pagina->objetos()->create([
                'camada' => $d['camada'], 'tipo' => 'loot', 'nome' => trim($d['nome'] ?? '') ?: 'Loot',
                'x' => $d['x'], 'y' => $d['y'], 'largura' => $lado, 'altura' => $lado, 'z' => 1,
            ]);

            return Loot::query()->create(['mesa_id' => $mesa->id, 'objeto_id' => $objeto->id])->refresh();
        });
        Transmitir::cena($mesa, $pagina->id, $acesso->jogador->id, $d['camada'] === 'mestre');

        return response()->json(['objeto' => $loot->objeto->paraFront(), 'loot' => $loot->paraFront()], 201);
    }

    /** Mestre: o catálogo (do sistema e o que ele criou) para escolher o que pôr no loot. */
    public function catalogo(Request $request, Mesa $mesa, RegistroSistemas $sistemas): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        $sistema = $this->sistema($mesa, $sistemas);
        $itens = collect($sistema->catalogoDeLoja()['itens'])
            ->concat($mesa->itensDeCatalogo()->get()->map->comoEntrada())
            ->filter(fn (array $i) => ($i['tipo'] ?? 'item') === 'item')
            ->map(fn (array $i) => ['ref' => $i['id'], 'nome' => $i['nome'], 'categoria' => $i['categoria'], 'raridade' => $i['raridade'] ?? null])
            ->sortBy('nome', SORT_NATURAL | SORT_FLAG_CASE)->values()->all();

        return response()->json(['itens' => $itens]);
    }

    /** O conteúdo do loot, para quem pode vê-lo. */
    public function mostrar(Request $request, Mesa $mesa, Objeto $objeto): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $loot = $this->doObjeto($mesa, $objeto);
        $this->exigirVisivel($mesa, $acesso, $objeto);

        return response()->json($loot->paraFront());
    }

    /** O jogador tira um item (ou o dinheiro) do loot para um personagem SEU. */
    public function pegar(Request $request, Mesa $mesa, Objeto $objeto, RegistroSistemas $sistemas): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $loot = $this->doObjeto($mesa, $objeto);
        $this->exigirVisivel($mesa, $acesso, $objeto);
        $sistema = $this->sistema($mesa, $sistemas);
        $d = $request->validate([
            'personagem_id' => ['required', 'integer'],
            'loot_item_id' => ['nullable', 'integer', 'required_without:dinheiro'],
            'dinheiro' => ['nullable', 'boolean'],
            'qtd' => ['nullable', 'integer', 'between:1,100000'],
            'tudo' => ['nullable', 'boolean'],
        ]);
        abort_unless($acesso->podeControlar($d['personagem_id']), 403, 'Esta ficha não é sua.');
        $tudo = (bool) ($d['tudo'] ?? false);
        $qtd = (int) ($d['qtd'] ?? 1);
        $servico = app(LootService::class);

        try {
            if (! empty($d['dinheiro'])) {
                $r = $servico->pegarDinheiro($mesa, $sistema, $loot->id, $d['personagem_id'], $qtd, $tudo);
                $campos = [$sistema->moedaDaLoja()['campo'] => $r['saldo']];
                $texto = sprintf('%s %s', $sistema->moedaDaLoja()['simbolo'], number_format($r['qtd'], 0, ',', '.'));
            } else {
                $r = $servico->pegarItem($mesa, $sistema, $loot->id, (int) $d['loot_item_id'], $d['personagem_id'], $qtd, $tudo);
                $campos = ['inventario' => $r['personagem']->ficha['inventario']];
                $texto = "{$r['qtd']}× {$r['item']->nome}";
            }
        } catch (LootIndisponivel $e) {
            // Quem chegou tarde: a mensagem e o conteúdo de agora (a janela dele se corrige sozinha).
            return response()->json(['message' => $e->getMessage(), 'loot' => $loot->fresh()->paraFront()], 409);
        }

        $p = $r['personagem'];
        $canais = ['mestre', ...$p->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all()];
        Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $p->id, 'campos' => $campos, 'criacao' => $p->criacao, 'ator' => $acesso->jogador->id], $canais);
        $estado = $loot->fresh()->paraFront();
        $this->avisar($mesa, $objeto, $estado, "{$p->nome} pegou {$texto} de {$estado['nome']}.", $acesso->jogador->id);

        return response()->json(['campos' => $campos, 'loot' => $estado, 'texto' => $texto]);
    }

    /** Mestre: põe um item no loot (do catálogo, da aba Itens ou um novo, criado na hora). */
    public function adicionarItem(Request $request, Mesa $mesa, Objeto $objeto, RegistroSistemas $sistemas, LojaService $loja): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        $loot = $this->doObjeto($mesa, $objeto);
        $d = $request->validate([
            'origem' => ['required', Rule::in(['catalogo', 'item', 'novo'])],
            'ref' => ['required_if:origem,catalogo', 'nullable', 'string', 'max:60'],
            'item_id' => ['required_if:origem,item', 'nullable', 'integer'],
            'nome' => ['required_if:origem,novo', 'nullable', 'string', 'max:120'],
            'descricao' => ['nullable', 'string', 'max:2000'],
            'peso' => ['nullable', 'numeric', 'between:0,100000'],
            'qtd' => ['nullable', 'integer', 'between:1,100000'],
        ]);
        $item = match ($d['origem']) {
            'catalogo' => $this->itemDoCatalogo($mesa, $this->sistema($mesa, $sistemas), $loja, $d['ref']),
            'item' => $mesa->itens()->findOrFail($d['item_id']),
            'novo' => $mesa->itens()->create([
                'catalogo_id' => 'loot:'.Str::uuid(), 'nome' => trim($d['nome']), 'descricao' => $d['descricao'] ?? null,
                'peso' => $d['peso'] ?? 0, 'equipavel' => true, 'requer_sintonia' => false, 'efeitos' => [],
            ]),
        };
        app(LootService::class)->guardarItem($loot->id, $item, (int) ($d['qtd'] ?? 1));

        return $this->devolver($mesa, $objeto, $loot);
    }

    /** Mestre: muda a quantidade de uma linha (0 remove). */
    public function definirQtd(Request $request, Mesa $mesa, Objeto $objeto, int $linha): JsonResponse
    {
        AcessoMesa::exigirMestre($request, $mesa);
        $loot = $this->doObjeto($mesa, $objeto);
        $d = $request->validate(['qtd' => ['required', 'integer', 'between:0,100000']]);
        app(LootService::class)->definirQtd($loot->id, $linha, $d['qtd']);

        return $this->devolver($mesa, $objeto, $loot);
    }

    /** Mestre: define o dinheiro do loot e/ou o nome. */
    public function atualizar(Request $request, Mesa $mesa, Objeto $objeto): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $loot = $this->doObjeto($mesa, $objeto);
        $d = $request->validate(['dinheiro' => ['sometimes', 'integer', 'between:0,1000000000000'], 'nome' => ['sometimes', 'string', 'max:80']]);
        if (isset($d['dinheiro'])) {
            app(LootService::class)->definirDinheiro($loot->id, $d['dinheiro']);
        }
        if (isset($d['nome']) && trim($d['nome']) !== '') {
            $objeto->update(['nome' => trim($d['nome'])]);
            Transmitir::cena($mesa, $objeto->pagina_id, $acesso->jogador->id, $objeto->camada === 'mestre');
        }

        return $this->devolver($mesa, $objeto, $loot);
    }

    private function itemDoCatalogo(Mesa $mesa, SistemaComLoja $sistema, LojaService $loja, string $ref): Item
    {
        $entrada = $loja->entrada($mesa, $sistema, $ref);
        if (! $entrada || ($entrada['tipo'] ?? 'item') !== 'item') {
            throw ValidationException::withMessages(['ref' => 'Este item não pode ir para um loot (serviços e despesas não são itens).']);
        }

        return $loja->materializar($mesa, $sistema, $entrada);
    }

    private function devolver(Mesa $mesa, Objeto $objeto, Loot $loot): JsonResponse
    {
        $estado = $loot->fresh()->paraFront();
        $this->avisar($mesa, $objeto, $estado);

        return response()->json($estado);
    }

    /** O estado novo para quem está com o loot aberto (no loot da camada Mestre, só o mestre). */
    private function avisar(Mesa $mesa, Objeto $objeto, array $estado, ?string $aviso = null, ?int $ator = null): void
    {
        $canais = $objeto->camada === 'mestre' ? ['mestre'] : ['mesa'];
        Transmitir::enviar($mesa, 'loot', ['loot' => $estado, 'aviso' => $aviso, 'ator' => $ator], $canais);
    }

    private function doObjeto(Mesa $mesa, Objeto $objeto): Loot
    {
        abort_unless($objeto->tipo === 'loot' && $objeto->pagina()->where('mesa_id', $mesa->id)->exists(), 404);

        return Loot::query()->where('objeto_id', $objeto->id)->firstOrFail();
    }

    /** O mestre abre qualquer loot; o jogador, só os da camada Jogadores da página onde ele está. */
    private function exigirVisivel(Mesa $mesa, AcessoMesa $acesso, Objeto $objeto): void
    {
        if ($acesso->ehMestre()) {
            return;
        }
        $pagina = $acesso->jogador->pagina_id ?? $mesa->paginas()->value('id');
        abort_unless($objeto->camada === 'jogadores' && $objeto->pagina_id === $pagina, 404);
    }

    private function sistema(Mesa $mesa, RegistroSistemas $sistemas): SistemaComLoja
    {
        $s = $sistemas->resolver($mesa->sistema->slug);
        abort_unless($s instanceof SistemaComLoja, 422, 'Este sistema ainda não tem itens para o loot.');

        return $s;
    }
}
