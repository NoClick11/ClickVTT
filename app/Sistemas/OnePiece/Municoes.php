<?php

namespace App\Sistemas\OnePiece;

use App\Models\Mesa;
use App\Models\Personagem;
use App\Support\Transmitir;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Munição das armas por munição (pistola, mosquete, canhão, arco, zarabatana): ao atacar escolhe-se a munição do inventário, que dá o dado e o
 * tipo do dano e gasta 1 unidade. Qual serve a qual arma sai de `dados/municoes.json` (pelo nome, Cap. 8), conferido contra o TS.
 */
final class Municoes
{
    private static ?array $mapa = null;

    /** @return array<string, list<string>> arma do catálogo => munições do catálogo */
    public static function mapa(): array
    {
        return (self::$mapa ??= json_decode(file_get_contents(__DIR__.'/dados/municoes.json'), true))['armas'];
    }

    /** As munições (ids do catálogo) que a arma aceita; arma sem item do catálogo aceita qualquer munição de alguma arma. @return list<string> */
    public static function daArma(?string $armaCatalogoId): array
    {
        if ($armaCatalogoId === null || $armaCatalogoId === '') {
            return array_values(array_unique(array_merge(...array_values(self::mapa()))));
        }

        return self::mapa()[$armaCatalogoId] ?? [];
    }

    /**
     * Confere a munição escolhida para atacar com a arma e a devolve do catálogo: o item está no inventário (com unidades), serve à arma e tem
     * dado de dano. Recusa (422) com o motivo; não gasta nada.
     *
     * @param  array<string, mixed>  $ficha
     * @param  array<int, array>  $itens  os itens da mesa (do `paraFront`)
     * @return array{item_id: int, id: string, nome: string, dano: string, tipo: string, nota: string}
     */
    public static function escolhida(array $ficha, array $itens, int $armaItemId, ?int $municaoItemId): array
    {
        $erro = fn (string $m) => throw ValidationException::withMessages(['municao_item_id' => $m]);
        if (! $municaoItemId) {
            $erro('Escolha a munição para atacar com esta arma.');
        }
        $tem = false;
        foreach ($ficha['inventario'] ?? [] as $secao) {
            foreach ($secao['itens'] ?? [] as $ref) {
                $tem = $tem || ((int) ($ref['item_id'] ?? 0) === $municaoItemId && (int) ($ref['qtd'] ?? 0) > 0);
            }
        }
        $item = $itens[$municaoItemId] ?? null;
        if (! $tem || ! $item) {
            $erro('Você não tem essa munição.');
        }
        $id = $item['dados']['catalogo']['id'] ?? null;
        $entrada = $id ? Itens::item($id) : null;
        if (! $entrada || $entrada['categoria'] !== 'municao' || ! is_string($entrada['arma']['dano'] ?? null)) {
            $erro("{$item['nome']} não é uma munição com dano.");
        }
        $armaId = $itens[$armaItemId]['dados']['catalogo']['id'] ?? null;
        if (! in_array($id, self::daArma($armaId), true)) {
            $erro("{$entrada['nome']} não serve a {$itens[$armaItemId]['nome']}.");
        }

        return [
            'item_id' => $municaoItemId, 'id' => $id, 'nome' => $entrada['nome'], 'dano' => $entrada['arma']['dano'], 'tipo' => $entrada['arma']['tipoDano'],
            // o que a munição faz além do dano (explosão da bola explosiva, Kairoseki), para o card lembrar
            'nota' => in_array($id, ['bola-explosiva', 'municao-de-kairoseki'], true) ? mb_substr($entrada['descricao'], 0, 600) : '',
        ];
    }

    /** Gasta 1 unidade da munição do inventário do personagem (some a linha ao zerar) e avisa a ficha. */
    public static function consumir(Mesa $mesa, int $personagemId, int $municaoItemId): void
    {
        $p = DB::transaction(function () use ($mesa, $personagemId, $municaoItemId) {
            $p = Personagem::query()->whereKey($personagemId)->where('mesa_id', $mesa->id)->lockForUpdate()->firstOrFail();
            $f = $p->ficha ?? [];
            foreach ($f['inventario'] ?? [] as $s => $secao) {
                foreach ($secao['itens'] ?? [] as $i => $ref) {
                    if ((int) ($ref['item_id'] ?? 0) !== $municaoItemId) {
                        continue;
                    }
                    $resta = (int) $ref['qtd'] - 1;
                    if ($resta > 0) {
                        $f['inventario'][$s]['itens'][$i]['qtd'] = $resta;
                    } else {
                        unset($f['inventario'][$s]['itens'][$i]);
                        $f['inventario'][$s]['itens'] = array_values($f['inventario'][$s]['itens']);
                    }
                    $p->ficha = $f;
                    $p->save();

                    return $p;
                }
            }

            return $p;
        });
        $canais = ['mestre', ...$p->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all()];
        // ator 0: quem atacou também aplica (o inventário mudou no servidor)
        Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $p->id, 'campos' => ['inventario' => $p->ficha['inventario'] ?? []], 'criacao' => $p->criacao, 'ator' => 0], $canais);
    }
}
