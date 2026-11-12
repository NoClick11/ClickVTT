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
        // quem entra no turno perde o que durava "até o início do próximo turno" dele
        $entrou = collect($depois['itens'] ?? [])->firstWhere('id', $depois['atual'] ?? null);
        if (($entrou['personagem_id'] ?? null) !== null) {
            self::iniciarTurno($mesa, (int) $entrou['personagem_id']);
        }
    }

    /** Início do turno do personagem: os PV temporários dados por uma reação (Costura Interna) acabam. */
    public static function iniciarTurno(Mesa $mesa, int $personagemId): void
    {
        $sistema = app(RegistroSistemas::class)->resolver($mesa->sistema->slug);
        if (! $sistema) {
            return;
        }
        $campos = DB::transaction(function () use ($mesa, $personagemId, $sistema, &$p) {
            $p = Personagem::query()->where('mesa_id', $mesa->id)->whereKey($personagemId)->lockForUpdate()->first();
            $ficha = $p?->fichaCompleta($sistema);
            $dado = (int) ($ficha['reducao']['pvTemp'] ?? 0);
            if (! $p || $dado <= 0) {
                return null;
            }
            $ficha['pv']['temp'] = max(0, (int) ($ficha['pv']['temp'] ?? 0) - $dado);
            $ficha['reducao']['pvTemp'] = 0;
            $p->ficha = $ficha;
            $p->save();

            return ['pv.temp' => $ficha['pv']['temp'], 'reducao' => $ficha['reducao']];
        });
        if ($campos) {
            self::transmitir($mesa, $p, $campos, false);
        }
    }

    /** Fim do encontro: sai o que tinha duração em turnos (condições e a redução armada), que sem o combate nunca acabaria. */
    public static function aoEncerrarCombate(Mesa $mesa, Personagem $p): void
    {
        $ficha = $p->ficha ?? [];
        $duracoes = $ficha['duracoes'] ?? [];
        if (! $duracoes && ! ($ficha['reducao'] ?? []) && ! ($ficha['bonusTecnica'] ?? [])) {
            return;
        }
        $ficha['condicoes'] = array_values(array_diff($ficha['condicoes'] ?? [], array_keys($duracoes)));
        $ficha['duracoes'] = [];
        // PV temporários de reação (Costura Interna) não ficam depois do encontro
        $ficha['pv']['temp'] = max(0, (int) ($ficha['pv']['temp'] ?? 0) - (int) ($ficha['reducao']['pvTemp'] ?? 0));
        $ficha['reducao'] = [];
        $ficha['bonusTecnica'] = [];
        $p->ficha = $ficha;
        $p->save();
        self::transmitir($mesa, $p, ['condicoes' => $ficha['condicoes'], 'duracoes' => [], 'reducao' => [], 'bonusTecnica' => [], 'pv.temp' => $ficha['pv']['temp']], true);
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
            // Bônus armado para a próxima Técnica (Fire Lash, Strike): vale até o fim do turno do dono
            if (! empty($ficha['bonusTecnica'])) {
                $ficha['bonusTecnica'] = [];
                $p->ficha = $ficha;
                $p->save();
                self::transmitir($mesa, $p, ['bonusTecnica' => []], false);
            }
            if (($reducao['turnos'] ?? 0) > 0) {
                $restam = (int) $reducao['turnos'] - 1;
                $ficha['reducao'] = $restam > 0 ? [...$reducao, 'turnos' => $restam] : array_intersect_key($reducao, ['pvTemp' => 1]); // os PV temporários da reação acabam no início do turno
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
        Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $p->id, 'campos' => $campos, 'ator' => 0], $p->canaisDaFicha());
        $mudouPvNpc = ($p->ficha['npc'] ?? false)
            && collect(array_keys($campos))->contains(fn ($k) => $k === 'pv' || str_starts_with((string) $k, 'pv.'));
        if ($status || $mudouPvNpc) {
            Transmitir::enviar($mesa, 'status', [
                'personagem_id' => $p->id,
                'status' => array_values($p->ficha['condicoes'] ?? []),
                'morto' => (bool) (($p->ficha['npc'] ?? false) && ((int) ($p->ficha['pv']['atual'] ?? 1) <= 0)),
                'aliado' => (bool) ($p->ficha['aliado'] ?? false),
            ], ['mesa']);
        }
    }
}
