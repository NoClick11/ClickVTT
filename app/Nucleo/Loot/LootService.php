<?php

namespace App\Nucleo\Loot;

use App\Models\Item;
use App\Models\Loot;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Sistemas\SistemaComLoja;
use Illuminate\Support\Facades\DB;

/**
 * O que acontece dentro de um loot. Vários jogadores podem clicar ao mesmo tempo: toda mudança roda numa transação que
 * TRAVA a linha do loot (`lockForUpdate`) antes de ler a quantidade, então as retiradas entram uma de cada vez e ninguém
 * leva o que já saiu nem o mesmo item duas vezes. A ordem das travas é sempre loot → personagem (a loja só trava o
 * personagem), logo não há impasse. Quem chegou tarde recebe `LootIndisponivel`.
 */
final class LootService
{
    private const MAX = 100000;

    /**
     * Um jogador tira itens do loot para a ficha de um personagem seu.
     *
     * @return array{personagem: Personagem, item: Item, qtd: int}
     */
    public function pegarItem(Mesa $mesa, SistemaComLoja $sistema, int $lootId, int $lootItemId, int $personagemId, int $qtd, bool $tudo): array
    {
        return DB::transaction(function () use ($mesa, $sistema, $lootId, $lootItemId, $personagemId, $qtd, $tudo) {
            $loot = Loot::query()->where('mesa_id', $mesa->id)->whereKey($lootId)->lockForUpdate()->firstOrFail();
            $linha = $loot->itens()->whereKey($lootItemId)->lockForUpdate()->first();
            if (! $linha) {
                throw new LootIndisponivel('Esse item já foi levado.');
            }
            $qtd = $tudo ? $linha->qtd : $qtd;
            if ($qtd < 1) {
                throw new LootIndisponivel('Quantidade inválida.');
            }
            if ($qtd > $linha->qtd) {
                throw new LootIndisponivel("Só restam {$linha->qtd} aqui.");
            }
            $item = Item::query()->where('mesa_id', $mesa->id)->findOrFail($linha->item_id);
            $p = Personagem::query()->where('mesa_id', $mesa->id)->whereKey($personagemId)->lockForUpdate()->firstOrFail();
            $p->ficha = $sistema->entregarNoInventario($p->ficha ?? $sistema->fichaPadrao(), $item->id, $qtd);
            $p->save();
            if ($qtd === $linha->qtd) {
                $linha->delete();
            } else {
                $linha->update(['qtd' => $linha->qtd - $qtd]);
            }

            return ['personagem' => $p, 'item' => $item, 'qtd' => $qtd];
        });
    }

    /**
     * Um jogador tira dinheiro do loot para a ficha de um personagem seu.
     *
     * @return array{personagem: Personagem, qtd: int, saldo: int}
     */
    public function pegarDinheiro(Mesa $mesa, SistemaComLoja $sistema, int $lootId, int $personagemId, int $qtd, bool $tudo): array
    {
        return DB::transaction(function () use ($mesa, $sistema, $lootId, $personagemId, $qtd, $tudo) {
            $loot = Loot::query()->where('mesa_id', $mesa->id)->whereKey($lootId)->lockForUpdate()->firstOrFail();
            if ($loot->dinheiro < 1) {
                throw new LootIndisponivel('O dinheiro já foi levado.');
            }
            $qtd = $tudo ? $loot->dinheiro : $qtd;
            if ($qtd < 1) {
                throw new LootIndisponivel('Quantidade inválida.');
            }
            if ($qtd > $loot->dinheiro) {
                throw new LootIndisponivel("Só restam {$loot->dinheiro} aqui.");
            }
            $p = Personagem::query()->where('mesa_id', $mesa->id)->whereKey($personagemId)->lockForUpdate()->firstOrFail();
            $campo = $sistema->moedaDaLoja()['campo'];
            $ficha = $p->ficha ?? $sistema->fichaPadrao();
            $saldo = (int) data_get($ficha, $campo, 0) + $qtd;
            data_set($ficha, $campo, $saldo);
            $p->ficha = $ficha;
            $p->save();
            $loot->update(['dinheiro' => $loot->dinheiro - $qtd]);

            return ['personagem' => $p, 'qtd' => $qtd, 'saldo' => $saldo];
        });
    }

    /** O mestre põe `$qtd` unidades de um item no loot (soma à linha existente). */
    public function guardarItem(int $lootId, Item $item, int $qtd): void
    {
        DB::transaction(function () use ($lootId, $item, $qtd) {
            $loot = Loot::query()->whereKey($lootId)->lockForUpdate()->firstOrFail();
            $linha = $loot->itens()->where('item_id', $item->id)->lockForUpdate()->first();
            if ($linha) {
                $linha->update(['qtd' => min(self::MAX, $linha->qtd + $qtd)]);
            } else {
                $loot->itens()->create(['item_id' => $item->id, 'qtd' => min(self::MAX, $qtd)]);
            }
        });
    }

    /** O mestre define a quantidade de uma linha (0 ou menos remove). */
    public function definirQtd(int $lootId, int $lootItemId, int $qtd): void
    {
        DB::transaction(function () use ($lootId, $lootItemId, $qtd) {
            $loot = Loot::query()->whereKey($lootId)->lockForUpdate()->firstOrFail();
            $linha = $loot->itens()->whereKey($lootItemId)->lockForUpdate()->first();
            if (! $linha) {
                return;
            }
            $qtd < 1 ? $linha->delete() : $linha->update(['qtd' => min(self::MAX, $qtd)]);
        });
    }

    /** O mestre define o dinheiro que sobra no loot. */
    public function definirDinheiro(int $lootId, int $dinheiro): void
    {
        DB::transaction(fn () => Loot::query()->whereKey($lootId)->lockForUpdate()->firstOrFail()->update(['dinheiro' => max(0, $dinheiro)]));
    }

    /**
     * Baú do tesouro: guarda no loot o que o d100 deu (dinheiro e itens) e registra o sorteio. Só uma vez por baú; o mestre pode sortear de novo.
     *
     * @param  list<array{item: Item, qtd: int}>  $itens
     */
    public function guardarSorteio(int $lootId, int $d100, array $roll, array $itens, bool $mestre): void
    {
        DB::transaction(function () use ($lootId, $d100, $roll, $itens, $mestre) {
            $loot = Loot::query()->whereKey($lootId)->lockForUpdate()->firstOrFail();
            if (! $loot->tesouro) {
                throw new LootIndisponivel('Este loot não é um baú do tesouro.');
            }
            if ($loot->sorteio && ! $mestre) {
                throw new LootIndisponivel('O tesouro deste baú já foi sorteado.');
            }
            foreach ($itens as $i) {
                $this->guardarItem($loot->id, $i['item'], $i['qtd']);
            }
            $loot->update([
                'dinheiro' => min(PHP_INT_MAX, $loot->dinheiro + $roll['dinheiro']),
                'sorteio' => ['d100' => $d100, 'texto' => $roll['texto'], 'manual' => $roll['manual']],
            ]);
        });
    }
}
