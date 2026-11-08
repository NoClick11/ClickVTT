<?php

namespace App\Nucleo\Combate;

use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Support\Transmitir;
use Illuminate\Support\Facades\DB;

/**
 * Condições com duração em turnos. A ficha guarda `duracoes[<id da condição>] = {turnos, aoDano}`: `turnos` é quanto
 * falta (a condição acaba no FIM do turno do afetado que zera a contagem) e `aoDano` encerra a condição ao receber dano.
 */
final class Duracoes
{
    /**
     * Chamado quando o combate muda: se o turno passou de um participante para outro, termina o turno do anterior
     * (um turno a menos nas condições dele). Só vale para participantes ligados a um personagem.
     *
     * @param  array<string, mixed>  $antes  combate antes da mudança
     * @param  array<string, mixed>  $depois  combate depois
     */
    public static function aoMudarOCombate(Mesa $mesa, array $antes, array $depois): void
    {
        $anterior = $antes['atual'] ?? null;
        if (! $anterior || $anterior === ($depois['atual'] ?? null) || ! ($antes['ativo'] ?? false)) {
            return;
        }
        $item = collect($antes['itens'] ?? [])->firstWhere('id', $anterior);
        $personagemId = $item['personagem_id'] ?? null;
        if ($personagemId) {
            self::terminarTurno($mesa, (int) $personagemId);
        }
    }

    /** Fim do encontro: sai o que tinha duração em turnos (condições e a redução armada), que sem o combate nunca acabaria. */
    public static function aoEncerrarCombate(Mesa $mesa, Personagem $p): void
    {
        $ficha = $p->ficha ?? [];
        $duracoes = $ficha['duracoes'] ?? [];
        if (! $duracoes && ! ($ficha['reducao'] ?? [])) {
            return;
        }
        $ficha['condicoes'] = array_values(array_diff($ficha['condicoes'] ?? [], array_keys($duracoes)));
        $ficha['duracoes'] = [];
        $ficha['reducao'] = [];
        $p->ficha = $ficha;
        $p->save();
        self::transmitir($mesa, $p, ['condicoes' => $ficha['condicoes'], 'duracoes' => [], 'reducao' => []], true);
    }

    /** Um turno a menos nas condições com duração do personagem; as que zeram saem da lista. */
    public static function terminarTurno(Mesa $mesa, int $personagemId): void
    {
        $sistema = app(RegistroSistemas::class)->resolver($mesa->sistema->slug);
        if (! $sistema) {
            return;
        }
        $resultado = DB::transaction(function () use ($mesa, $personagemId, $sistema) {
            $p = Personagem::query()->where('mesa_id', $mesa->id)->whereKey($personagemId)->lockForUpdate()->first();
            if (! $p) {
                return null;
            }
            $ficha = $p->fichaCompleta($sistema);
            $duracoes = $ficha['duracoes'] ?? [];
            // Redução armada por reação defensiva: vence quando acabam os turnos dela (o resto some junto)
            $reducao = $ficha['reducao'] ?? [];
            if (($reducao['turnos'] ?? 0) > 0) {
                $restam = (int) $reducao['turnos'] - 1;
                $ficha['reducao'] = $restam > 0 ? [...$reducao, 'turnos' => $restam] : [];
                $p->ficha = $ficha;
                $p->save();
                self::transmitir($mesa, $p, ['reducao' => $ficha['reducao']], false);
            }
            if (! $duracoes) {
                return null;
            }
            $acabaram = [];
            foreach ($duracoes as $id => $d) {
                $restam = (int) ($d['turnos'] ?? 0) - 1;
                if ($restam <= 0) {
                    $acabaram[] = $id;
                    unset($duracoes[$id]);
                } else {
                    $duracoes[$id]['turnos'] = $restam;
                }
            }
            $ficha['duracoes'] = $duracoes;
            $ficha['condicoes'] = array_values(array_diff($ficha['condicoes'] ?? [], $acabaram));
            $p->ficha = $ficha;
            $p->save();

            return [$p, $acabaram];
        });
        if ($resultado) {
            self::transmitir($mesa, $resultado[0], ['condicoes' => $resultado[0]->ficha['condicoes'], 'duracoes' => $resultado[0]->ficha['duracoes']], true);
        }
    }

    /**
     * Avisa o mestre e os donos do personagem do que mudou na ficha (campos já aplicados) e, se `status`, todos da mesa
     * dos ícones de efeito. Sem `ator`: quem agiu também recebe (o servidor mudou a ficha, não ele).
     *
     * @param  array<string, mixed>  $campos
     */
    public static function transmitir(Mesa $mesa, Personagem $p, array $campos, bool $status = false): void
    {
        $canais = ['mestre', ...$p->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all()];
        Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $p->id, 'campos' => $campos, 'criacao' => $p->criacao, 'ator' => 0], $canais);
        if ($status) {
            Transmitir::enviar($mesa, 'status', ['personagem_id' => $p->id, 'status' => array_values($p->ficha['condicoes'] ?? [])], ['mesa']);
        }
    }
}
