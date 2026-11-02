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
