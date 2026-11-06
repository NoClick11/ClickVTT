<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * O inventário deixa de guardar o item por inteiro dentro da ficha (nome, peso, detalhe) e passa a referenciar uma
 * linha de `itens` da mesa (`item_id`). Esta migração cria os itens a partir do que já estava salvo (itens iguais
 * numa mesma mesa viram um só) e troca as entradas por referências. Só mexe em fichas no formato antigo.
 */
return new class extends Migration
{
    public function up(): void
    {
        $agora = now();
        $criados = []; // "mesa|nome|peso|detalhe" => id

        DB::table('personagens')->whereNotNull('ficha')->orderBy('id')->each(function ($p) use (&$criados, $agora) {
            $ficha = json_decode($p->ficha, true);
            if (! is_array($ficha) || ! isset($ficha['inventario']) || ! is_array($ficha['inventario'])) {
                return;
            }

            $mudou = false;
            foreach ($ficha['inventario'] as $s => $secao) {
                foreach ($secao['itens'] ?? [] as $i => $item) {
                    if (! is_array($item) || ! array_key_exists('nome', $item)) {
                        continue; // já no formato novo
                    }
                    $peso = round((float) ($item['peso'] ?? 0), 2);
                    $detalhe = isset($item['detalhe']) && $item['detalhe'] !== '' ? (string) $item['detalhe'] : null;
                    $chave = "{$p->mesa_id}|{$item['nome']}|{$peso}|{$detalhe}";
                    $criados[$chave] ??= DB::table('itens')->insertGetId([
                        'mesa_id' => $p->mesa_id, 'nome' => mb_substr((string) $item['nome'], 0, 120), 'descricao' => $detalhe, 'peso' => $peso,
                        'equipavel' => true, 'requer_sintonia' => false, 'created_at' => $agora, 'updated_at' => $agora,
                    ]);
                    $ficha['inventario'][$s]['itens'][$i] = [
                        'item_id' => $criados[$chave], 'qtd' => (int) ($item['qtd'] ?? 1),
                        'equipado' => (bool) ($item['equipado'] ?? false), 'sintonizado' => false,
                    ];
                    $mudou = true;
                }
            }
            if ($mudou) {
                DB::table('personagens')->where('id', $p->id)->update(['ficha' => json_encode($ficha, JSON_UNESCAPED_UNICODE)]);
            }
        });
    }

    public function down(): void
    {
        $itens = DB::table('itens')->get()->keyBy('id');

        DB::table('personagens')->whereNotNull('ficha')->orderBy('id')->each(function ($p) use ($itens) {
            $ficha = json_decode($p->ficha, true);
            if (! is_array($ficha) || ! isset($ficha['inventario']) || ! is_array($ficha['inventario'])) {
                return;
            }
            $mudou = false;
            foreach ($ficha['inventario'] as $s => $secao) {
                foreach ($secao['itens'] ?? [] as $i => $ref) {
                    if (! is_array($ref) || ! array_key_exists('item_id', $ref)) {
                        continue;
                    }
                    $item = $itens[$ref['item_id']] ?? null;
                    $ficha['inventario'][$s]['itens'][$i] = [
                        'nome' => $item->nome ?? 'Item removido', 'qtd' => (int) $ref['qtd'], 'peso' => (float) ($item->peso ?? 0),
                        'equipado' => (bool) ($ref['equipado'] ?? false), 'detalhe' => $item->descricao ?? null,
                    ];
                    $mudou = true;
                }
            }
            if ($mudou) {
                DB::table('personagens')->where('id', $p->id)->update(['ficha' => json_encode($ficha, JSON_UNESCAPED_UNICODE)]);
            }
        });
    }
};
