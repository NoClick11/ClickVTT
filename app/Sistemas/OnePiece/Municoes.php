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
        $armaId = $itens[$armaItemId]['dados']['catalogo']['id'] ?? null;
        // Munição criada à mão (`dados.municao`): serve a qualquer arma por munição e traz o próprio dado
        $propria = $item['dados']['municao'] ?? null;
        if (is_array($propria) && is_string($propria['dano'] ?? null)) {
            return [
                'item_id' => $municaoItemId, 'id' => 'c:'.$municaoItemId, 'nome' => $item['nome'], 'dano' => $propria['dano'], 'tipo' => $propria['tipoDano'] ?? '',
                'nota' => mb_substr((string) ($propria['nota'] ?? ''), 0, 600),
            ];
        }
        $id = $item['dados']['catalogo']['id'] ?? null;
        $entrada = $id ? Itens::item($id) : null;
        if (! $entrada || $entrada['categoria'] !== 'municao' || ! is_string($entrada['arma']['dano'] ?? null)) {
            $erro("{$item['nome']} não é uma munição com dano.");
        }
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
        self::avisar($mesa, $p); // ator 0: quem atacou também aplica (o inventário mudou no servidor)
    }

    /** A munição que a Técnica gasta ("Requisito: ..., 8 munições (qualquer)"); null = não gasta. Espelha `custoDeMunicaoDaTecnica` do TS. @return array{quantidade: int, tipo: string}|null */
    public static function custoDaTecnica(string $descricao): ?array
    {
        if (! preg_match('/Requisito:[^.]*?(\d+)\s+muni[çc](?:ão|ões)\s*\((qualquer|esférica|perfurante)\)/iu', $descricao, $m)) {
            return null;
        }
        $tipo = mb_strtolower($m[2]);

        return ['quantidade' => (int) $m[1], 'tipo' => $tipo === 'esférica' ? 'esferica' : $tipo];
    }

    /** Ids de munição que servem ao tipo, na ordem de gasto (a de Kairoseki nunca é gasta sozinha). @param list<string> $aceitas @return list<string> */
    public static function paraGastar(string $tipo, array $aceitas): array
    {
        $ordem = ['municao-esferica', 'municao-perfurante'];
        if ($tipo === 'esferica' || $tipo === 'perfurante') {
            return array_values(array_filter($aceitas, fn ($id) => $id === "municao-{$tipo}"));
        }

        return array_values([...array_filter($ordem, fn ($id) => in_array($id, $aceitas, true)), ...array_filter($aceitas, fn ($id) => ! in_array($id, $ordem, true) && $id !== 'municao-de-kairoseki')]);
    }

    /**
     * Gasta a munição de uma Técnica do inventário do personagem: só munição que a arma de fogo EQUIPADA aceita, do tipo pedido, em quantidade
     * inteira (falta = 422 e nada é gasto). O custo sai da descrição da Técnica SALVA na ficha (o cliente só diz o nome).
     *
     * @return array{quantidade: int}|null null = a Técnica não gasta munição
     */
    public static function gastarDaTecnica(Mesa $mesa, Personagem $p, mixed $sistema, string $nomeDaTecnica): ?array
    {
        $erro = fn (string $m) => throw ValidationException::withMessages(['municao' => $m]);

        return DB::transaction(function () use ($mesa, $p, $sistema, $nomeDaTecnica, $erro) {
            $p = Personagem::query()->whereKey($p->id)->where('mesa_id', $mesa->id)->lockForUpdate()->firstOrFail();
            $ficha = $p->fichaCompleta($sistema);
            $tecnica = collect([...($ficha['tecnicas']['lista'] ?? []), ...($ficha['akuma']['lista'] ?? [])])->firstWhere('nome', $nomeDaTecnica);
            $custo = $tecnica ? self::custoDaTecnica((string) ($tecnica['descricao'] ?? '')) : null;
            if (! $custo) {
                return null;
            }
            $ids = $sistema->itensReferenciados($ficha);
            $itens = $ids ? $mesa->itens()->whereIn('id', $ids)->get()->mapWithKeys(fn ($i) => [$i->id => $i->paraFront()])->all() : [];
            $aceitas = [];
            foreach ($ficha['inventario'] ?? [] as $secao) {
                foreach ($secao['itens'] ?? [] as $ref) {
                    $item = $itens[(int) ($ref['item_id'] ?? 0)] ?? null;
                    if ($item && ($item['dados']['arma']['municao'] ?? false) && Regras::ativo($ref, $item)) {
                        $aceitas = [...$aceitas, ...self::daArma($item['dados']['catalogo']['id'] ?? null)];
                    }
                }
            }
            if (! $aceitas) {
                $erro('Equipe uma arma de fogo para usar esta Técnica.');
            }
            $servem = self::paraGastar($custo['tipo'], array_values(array_unique($aceitas)));
            $falta = $custo['quantidade'];
            $f = $p->ficha ?? [];
            // "qualquer" também gasta a munição criada à mão pelo mestre (depois das do catálogo)
            $fontes = [...$servem, ...($custo['tipo'] === 'qualquer' ? ['*propria'] : [])];
            foreach ($fontes as $catalogoId) {
                foreach ($f['inventario'] ?? [] as $s => $secao) {
                    foreach ($secao['itens'] ?? [] as $i => $ref) {
                        $dadosDoItem = $itens[(int) ($ref['item_id'] ?? 0)]['dados'] ?? [];
                        $bate = $catalogoId === '*propria' ? isset($dadosDoItem['municao']) : ($dadosDoItem['catalogo']['id'] ?? null) === $catalogoId;
                        if ($falta <= 0 || ! $bate || (int) $ref['qtd'] <= 0) {
                            continue;
                        }
                        $tira = min($falta, (int) $ref['qtd']);
                        $f['inventario'][$s]['itens'][$i]['qtd'] = (int) $ref['qtd'] - $tira;
                        $falta -= $tira;
                    }
                }
            }
            if ($falta > 0) {
                $erro("Faltam {$falta} de {$custo['quantidade']} munições para usar {$nomeDaTecnica}.");
            }
            foreach ($f['inventario'] as $s => $secao) {
                $f['inventario'][$s]['itens'] = array_values(array_filter($secao['itens'] ?? [], fn ($r) => (int) $r['qtd'] > 0));
            }
            $p->ficha = $f;
            $p->save();
            self::avisar($mesa, $p);

            return ['quantidade' => $custo['quantidade']];
        });
    }

    /**
     * Gasta 1 munição do atirador para UM ataque da Vigília (Overwatch: "1 munição por ataque") e devolve a escolhida no formato de `escolhida`,
     * junto da arma de fogo equipada que atira. Ordem: esférica, perfurante, outras do catálogo e, por último, as criadas à mão (nunca a de
     * Kairoseki sozinha). Sem arma de fogo equipada ou sem munição: 422 e nada é gasto.
     *
     * @return array{arma_id: int, municao: array{item_id: int, id: string, nome: string, dano: string, tipo: string, nota: string}}
     */
    public static function gastarPorAtaque(Mesa $mesa, Personagem $p, mixed $sistema): array
    {
        $erro = fn (string $m) => throw ValidationException::withMessages(['municao' => $m]);

        return DB::transaction(function () use ($mesa, $p, $sistema, $erro) {
            $p = Personagem::query()->whereKey($p->id)->where('mesa_id', $mesa->id)->lockForUpdate()->firstOrFail();
            $ficha = $p->fichaCompleta($sistema);
            $ids = $sistema->itensReferenciados($ficha);
            $itens = $ids ? $mesa->itens()->whereIn('id', $ids)->get()->mapWithKeys(fn ($i) => [$i->id => $i->paraFront()])->all() : [];
            $armaId = null;
            $aceitas = [];
            foreach ($ficha['inventario'] ?? [] as $secao) {
                foreach ($secao['itens'] ?? [] as $ref) {
                    $item = $itens[(int) ($ref['item_id'] ?? 0)] ?? null;
                    if ($item && ($item['dados']['arma']['municao'] ?? false) && Regras::ativo($ref, $item)) {
                        $armaId ??= (int) $item['id'];
                        $aceitas = [...$aceitas, ...self::daArma($item['dados']['catalogo']['id'] ?? null)];
                    }
                }
            }
            if ($armaId === null) {
                $erro('Equipe uma arma de fogo (mosquete) para atirar.');
            }
            $f = $p->ficha ?? [];
            $fontes = [...self::paraGastar('qualquer', array_values(array_unique($aceitas))), '*propria'];
            foreach ($fontes as $catalogoId) {
                foreach ($f['inventario'] ?? [] as $s => $secao) {
                    foreach ($secao['itens'] ?? [] as $i => $ref) {
                        $item = $itens[(int) ($ref['item_id'] ?? 0)] ?? null;
                        $dadosDoItem = $item['dados'] ?? [];
                        $bate = $catalogoId === '*propria' ? isset($dadosDoItem['municao']) : ($dadosDoItem['catalogo']['id'] ?? null) === $catalogoId;
                        if (! $item || ! $bate || (int) $ref['qtd'] <= 0) {
                            continue;
                        }
                        if ($catalogoId === '*propria') {
                            $m = ['item_id' => (int) $item['id'], 'id' => 'c:'.$item['id'], 'nome' => $item['nome'], 'dano' => $dadosDoItem['municao']['dano'], 'tipo' => $dadosDoItem['municao']['tipoDano'] ?? '', 'nota' => ''];
                        } else {
                            $e = Itens::item($catalogoId);
                            $m = ['item_id' => (int) $item['id'], 'id' => $catalogoId, 'nome' => $e['nome'], 'dano' => $e['arma']['dano'], 'tipo' => $e['arma']['tipoDano'], 'nota' => ''];
                        }
                        if ((int) $ref['qtd'] - 1 > 0) {
                            $f['inventario'][$s]['itens'][$i]['qtd'] = (int) $ref['qtd'] - 1;
                        } else {
                            array_splice($f['inventario'][$s]['itens'], $i, 1);
                        }
                        $p->ficha = $f;
                        $p->save();
                        self::avisar($mesa, $p);

                        return ['arma_id' => $armaId, 'municao' => $m];
                    }
                }
            }
            $erro('Sem munição para atirar: a Vigília gasta 1 por ataque.');
        });
    }

    private static function avisar(Mesa $mesa, Personagem $p): void
    {
        $canais = ['mestre', ...$p->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all()];
        Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $p->id, 'campos' => ['inventario' => $p->ficha['inventario'] ?? []], 'criacao' => $p->criacao, 'ator' => 0], $canais);
    }
}
