<?php

namespace App\Sistemas\OnePiece;

use App\Models\Mesa;
use App\Models\Personagem;
use App\Support\Transmitir;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Os 3 usos da Saijo Ô Wazamono por descanso longo (rolar o dano da Técnica duas vezes e ficar com o maior), contados no servidor. */
final class ConsumoDaSaijo
{
    /** A característica "Execução Perfeita" (Rei Atirador): 3 usos; rola o dano da Técnica da arma melhorada duas vezes e fica com o maior. */
    private static function consumirExecucaoPerfeita(Mesa $mesa, int $personagemId): void
    {
        $p = DB::transaction(function () use ($personagemId, $mesa) {
            $p = Personagem::query()->whereKey($personagemId)->where('mesa_id', $mesa->id)->lockForUpdate()->firstOrFail();
            $f = $p->ficha ?? [];
            $i = collect($f['caracteristicas'] ?? [])->search(fn ($c) => str_contains((string) ($c['nome'] ?? ''), 'Execução Perfeita'));
            if ($i === false) {
                throw ValidationException::withMessages(['expressao' => 'Rolar o dano duas vezes exige a Saijo Ô Wazamono equipada ou a característica Execução Perfeita.']);
            }
            if ((int) ($f['caracteristicas'][$i]['usos']['atual'] ?? 0) <= 0) {
                throw ValidationException::withMessages(['expressao' => 'Os usos da Execução Perfeita acabaram até o descanso longo.']);
            }
            $f['caracteristicas'][$i]['usos']['atual'] = (int) $f['caracteristicas'][$i]['usos']['atual'] - 1;
            $p->ficha = $f;
            $p->save();

            return [$p, $i, $f['caracteristicas'][$i]['usos']['atual']];
        });
        [$p, $i, $atual] = $p;
        $canais = ['mestre', ...$p->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all()];
        Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $p->id, 'campos' => ["caracteristicas.{$i}.usos.atual" => $atual], 'criacao' => $p->criacao, 'ator' => 0], $canais);
    }

    /**
     * Gasta 1 uso. Recusa sem a arma equipada ou com os 3 usos já gastos; avisa a ficha.
     *
     * @param  array<int, array>  $itens
     */
    public static function consumir(Mesa $mesa, ?int $personagemId, mixed $sistema, array $itens, array $ficha): void
    {
        if (! $personagemId || ! $sistema instanceof OnePiece) {
            throw ValidationException::withMessages(['expressao' => 'Rolar o dano duas vezes exige uma arma Saijo Ô Wazamono equipada.']);
        }
        // Sem a Saijo, o Rei Atirador rola duas vezes com a Execução Perfeita (3 usos por descanso longo, contados na característica)
        if (! Regras::saijoEquipada($ficha, $itens)) {
            self::consumirExecucaoPerfeita($mesa, $personagemId);

            return;
        }
        [$n, $p] = DB::transaction(function () use ($personagemId, $mesa) {
            $p = Personagem::query()->whereKey($personagemId)->where('mesa_id', $mesa->id)->lockForUpdate()->firstOrFail();
            $f = $p->ficha ?? [];
            $n = (int) ($f['meito']['usados'] ?? 0);
            if ($n >= 3) {
                throw ValidationException::withMessages(['expressao' => 'Os 3 usos da Saijo Ô Wazamono já foram gastos até o descanso longo.']);
            }
            $f['meito']['usados'] = $n + 1;
            $p->ficha = $f;
            $p->save();

            return [$n + 1, $p];
        });
        $canais = ['mestre', ...$p->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all()];
        // ator 0: quem rolou também aplica (o contador mudou no servidor)
        Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $p->id, 'campos' => ['meito.usados' => $n], 'criacao' => $p->criacao, 'ator' => 0], $canais);
    }
}
