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
        $this->line(json_encode([
            'pp' => $atirador?->ficha['pp']['atual'] ?? null,
            'pv' => ['perto' => $pv('PertoE2E'), 'oculto' => $pv('OcultoE2E'), 'amigo' => $pv('AmigoE2E'), 'longe' => $pv('LongeE2E'), 'aliado' => $pv('AliadoE2E')],
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
