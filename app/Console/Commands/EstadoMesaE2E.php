<?php

namespace App\Console\Commands;

use App\Models\Mesa;
use App\Models\Personagem;
use Illuminate\Console\Command;

/** O estado da mesa fixa dos testes de ponta a ponta, em JSON (o roteiro do Playwright confere o que o SERVIDOR decidiu). */
class EstadoMesaE2E extends Command
{
    protected $signature = 'e2e:estado';

    protected $description = 'Mostra o estado da mesa de testes (PP, PV, Técnicas ativas, cards do gatilho)';

    public function handle(): int
    {
        $mesa = Mesa::query()->where('nome', PrepararMesaE2E::NOME)->firstOrFail();
        $pv = fn (string $nome) => Personagem::query()->where('mesa_id', $mesa->id)->where('nome', $nome)->first()?->ficha['pv']['atual'] ?? null;
        $atirador = Personagem::query()->where('mesa_id', $mesa->id)->where('nome', 'AtiradorE2E')->first();
        $c = $mesa->combate ?? [];
        // inventário do Atirador por item do catálogo (munições e armas) e as condições de cada NPC
        $qtds = [];
        foreach ($atirador?->ficha['inventario'] ?? [] as $secao) {
            foreach ($secao['itens'] ?? [] as $ref) {
                $item = $mesa->itens()->find($ref['item_id']);
                $qtds[$item?->catalogo_id ?? ('#'.$ref['item_id'])] = ($qtds[$item?->catalogo_id ?? ('#'.$ref['item_id'])] ?? 0) + $ref['qtd'];
            }
        }
        $condicoes = fn (string $nome) => Personagem::query()->where('mesa_id', $mesa->id)->where('nome', $nome)->first()?->ficha['condicoes'] ?? [];
        $cards = $mesa->mensagens()->where('tipo', 'tecnica')->orderBy('id')->get()->map(fn ($m) => [
            'nome' => $m->dados['tecnica']['nome'], 'cd' => $m->dados['tecnica']['cd'], 'estado' => $m->dados['estado'],
            'alvos' => array_column($m->dados['alvos'], 'nome'), 'dano' => $m->dados['tecnica']['dano']['expressao'] ?? null,
        ])->all();
        $this->line(json_encode([
            'pp' => $atirador?->ficha['pp']['atual'] ?? null,
            'pv' => ['perto' => $pv('PertoE2E'), 'oculto' => $pv('OcultoE2E'), 'amigo' => $pv('AmigoE2E'), 'longe' => $pv('LongeE2E'), 'aliado' => $pv('AliadoE2E')],
            'qtds' => $qtds,
            'vigia' => collect($c['ativas'] ?? [])->where('tipo', 'vigia')->map(fn ($a) => ['rodadas' => $a['rodadas'], 'zona' => $a['zona']])->values()->all(),
            'vigia_cards' => $mesa->mensagens()->where('tipo', 'gatilho')->get()->filter(fn ($m) => $m->dados['vigia'] ?? false)->map(fn ($m) => ['alvo' => $m->dados['alvo']['nome'], 'motivo' => $m->dados['motivo'], 'estado' => $m->dados['estado'], 'salvaguarda' => $m->dados['salvaguarda']['passou'] ?? null])->values()->all(),
            'ferreiro' => (function () use ($mesa) {
                $f = Personagem::query()->where('mesa_id', $mesa->id)->where('nome', 'FerreiroE2E')->first()?->ficha ?? [];
                $lingotes = 0;
                foreach ($f['inventario'] ?? [] as $secao) {
                    foreach ($secao['itens'] ?? [] as $ref) {
                        $lingotes += $mesa->itens()->find($ref['item_id'])?->catalogo_id === 'lingote-de-metal' ? $ref['qtd'] : 0;
                    }
                }

                return ['belly' => $f['belly'] ?? null, 'lingotes' => $lingotes, 'condicoes' => $f['condicoes'] ?? []];
            })(),
            // as armas do Atirador (depois de aprimoradas pelo Ferreiro): melhoria e alcance máximo
            'armas_atirador' => collect($atirador?->ficha['inventario'][0]['itens'] ?? [])->map(fn ($r) => $mesa->itens()->find($r['item_id']))
                ->filter(fn ($i) => $i && isset($i->dados['arma']))->map(fn ($i) => ['nome' => $i->nome, 'melhoria' => $i->dados['arma']['melhoria'] ?? null, 'alcanceMaximo' => $i->dados['arma']['alcanceMaximo'] ?? null])->values()->all(),
            'condicoes' => ['fruta' => $condicoes('FrutaE2E'), 'perto' => $condicoes('PertoE2E')],
            'duracoes_fruta' => Personagem::query()->where('mesa_id', $mesa->id)->where('nome', 'FrutaE2E')->first()?->ficha['duracoes'] ?? [],
            'cards' => $cards,
            'pv_fruta' => $pv('FrutaE2E'),
            'fogo_amigo' => (bool) $mesa->fogo_amigo,
            'aliado' => (bool) (Personagem::query()->where('mesa_id', $mesa->id)->where('nome', 'AliadoE2E')->first()?->ficha['aliado'] ?? false),
            'rodada' => $c['rodada'] ?? null,
            'atual' => $c['atual'] ?? null,
            'ativas' => array_map(fn ($a) => ['nome' => $a['nome'], 'rodadas' => $a['rodadas'], 'alcance' => $a['alcance']], $c['ativas'] ?? []),
            'acoes_atirador' => collect($c['itens'] ?? [])->firstWhere('id', 'a')['acoes'] ?? [],
            'gatilhos' => $mesa->mensagens()->where('tipo', 'gatilho')->get()->map(fn ($m) => ['alvo' => $m->dados['alvo']['nome'], 'estado' => $m->dados['estado'], 'visibilidade' => $m->visibilidade])->all(),
        ], JSON_UNESCAPED_UNICODE));

        return self::SUCCESS;
    }
}
