<?php

namespace App\Http\Controllers\Site;

use App\Http\Controllers\Controller;
use App\Http\Requests\Site\MesaRequest;
use App\Models\Mesa;
use App\Models\Sistema;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class MesaController extends Controller
{
    public function index(Request $request): Response
    {
        $mesas = $request->user()->mesas()->with('sistema')
            ->orderByDesc('favorita')->orderByDesc('updated_at')->get()
            ->map(fn (Mesa $m) => [
                'id' => $m->id,
                'slug' => $m->slug,
                'nome' => $m->nome,
                'sistema_id' => $m->sistema_id,
                'sistema' => ['nome' => $m->sistema->nome, 'icone' => $m->sistema->icone],
                'descricao' => $m->descricao,
                'capa' => $m->capaUrl(),
                'tema_entrada' => $m->tema_entrada,
                'favorita' => $m->favorita,
                'travada' => $m->travada,
            ]);

        return Inertia::render('site/Home', [
            'mesas' => $mesas,
            'sistemas' => Sistema::where('ativo', true)->orderBy('nome')->get(['id', 'nome', 'icone', 'descricao']),
        ]);
    }

    public function show(Request $request, Mesa $mesa): Response
    {
        $this->autorizar($request, $mesa);
        $mesa->load('sistema');

        return Inertia::render('site/MesaDetalhe', [
            'mesa' => [
                'id' => $mesa->id,
                'slug' => $mesa->slug,
                'nome' => $mesa->nome,
                'descricao' => $mesa->descricao,
                'capa' => $mesa->capaUrl(),
                'sistema' => ['nome' => $mesa->sistema->nome, 'icone' => $mesa->sistema->icone],
                'convite_url' => route('convite.show', $mesa->convite_token),
            ],
            'jogadores' => $mesa->jogadores()->orderByRaw("papel = 'mestre' desc")->orderBy('nome')->get()
                ->map(fn ($j) => $j->paraFront()),
            // NPCs (criados pelo botão de NPC no jogo, incluindo as cópias dos tokens) não são personagens de jogadores.
            'personagens' => $mesa->personagens()->with('jogadores')->orderBy('nome')->get()
                ->reject(fn ($p) => ! empty($p->ficha['npc']))
                ->map(fn ($p) => $p->paraFront())
                ->values(),
        ]);
    }

    public function novoConvite(Request $request, Mesa $mesa): RedirectResponse
    {
        $this->autorizar($request, $mesa);
        $mesa->forceFill(['convite_token' => \Illuminate\Support\Str::random(32)])->save();

        return back();
    }

    public function store(MesaRequest $request): RedirectResponse
    {
        $dados = $request->safe()->except(['capa', 'remover_capa']);
        if ($request->hasFile('capa')) {
            $dados['capa'] = $request->file('capa')->store('capas', 'public');
        }
        $request->user()->mesas()->create($dados);

        return back();
    }

    public function update(MesaRequest $request, Mesa $mesa): RedirectResponse
    {
        $this->autorizar($request, $mesa);
        abort_if($mesa->travada, 403, 'Mesa travada.');

        $dados = $request->safe()->except(['capa', 'remover_capa']);
        if ($request->hasFile('capa')) {
            $this->apagarCapa($mesa);
            $dados['capa'] = $request->file('capa')->store('capas', 'public');
        } elseif ($request->boolean('remover_capa')) {
            $this->apagarCapa($mesa);
            $dados['capa'] = null;
        }
        $mesa->update($dados);

        return back();
    }

    public function favoritar(Request $request, Mesa $mesa): RedirectResponse
    {
        $this->autorizar($request, $mesa);
        $mesa->update(['favorita' => ! $mesa->favorita]);

        return back();
    }

    public function travar(Request $request, Mesa $mesa): RedirectResponse
    {
        $this->autorizar($request, $mesa);
        $mesa->update(['travada' => ! $mesa->travada]);

        return back();
    }

    public function destroy(Request $request, Mesa $mesa): RedirectResponse
    {
        $this->autorizar($request, $mesa);
        abort_if($mesa->travada, 403, 'Mesa travada.');
        $mesa->delete();

        return back();
    }

    private function apagarCapa(Mesa $mesa): void
    {
        if ($mesa->capa) {
            Storage::disk('public')->delete($mesa->capa);
        }
    }

    private function autorizar(Request $request, Mesa $mesa): void
    {
        abort_unless($mesa->user_id === $request->user()->id, 403);
    }
}
