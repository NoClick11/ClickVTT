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
    /**
     * Gasta 1 uso. Recusa sem a arma equipada ou com os 3 usos já gastos; avisa a ficha.
     *
     * @param  array<int, array>  $itens
     */
    public static function consumir(Mesa $mesa, ?int $personagemId, mixed $sistema, array $itens, array $ficha): void
    {
        if (! $personagemId || ! $sistema instanceof OnePiece || ! Regras::saijoEquipada($ficha, $itens)) {
            throw ValidationException::withMessages(['expressao' => 'Rolar o dano duas vezes exige uma arma Saijo Ô Wazamono equipada.']);
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
