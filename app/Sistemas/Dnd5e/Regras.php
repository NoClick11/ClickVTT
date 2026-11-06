<?php

namespace App\Sistemas\Dnd5e;

use App\Nucleo\Efeitos\Efeitos;

/**
 * Regras derivadas da ficha de D&D 5e. ESPELHA `resources/js/app/sistemas/dnd5e/regras.ts` (o cliente mostra
 * ao vivo, o servidor decide as rolagens): qualquer mudança aqui tem de ser feita nos dois e é
 * conferida pelos casos de `tests/paridade/dnd5e.json`, que rodam nas duas implementações.
 *
 * Tudo o que é derivável é calculado. O que muda o cálculo são os EFEITOS (motor do núcleo, `Efeitos`):
 * os dos itens ativos e os AJUSTES manuais (`ficha.ajustes`, que entram como efeitos de soma).
 *
 * Fases (sem dependência circular):
 *  1. efeitos sobre `atributos.*` (ex.: Cinto de Força, mínimo 21) → atributos e modificadores efetivos;
 *  2. valores-base (CA = 10 + mod. DES, perícias, salvaguardas...) calculados com os atributos efetivos;
 *  3. os demais efeitos sobre esses valores-base; fórmulas veem os valores da fase 2 (nunca o resultado de
 *     outros efeitos).
 */
final class Regras
{
    /** XP necessário para chegar ao nível seguinte, por nível atual (no 20 vale o último). */
    public const XP_PROXIMO = [1 => 300, 2 => 900, 3 => 2700, 4 => 6500, 5 => 14000, 6 => 23000, 7 => 34000, 8 => 48000, 9 => 64000, 10 => 85000, 11 => 100000, 12 => 120000, 13 => 140000, 14 => 165000, 15 => 195000, 16 => 225000, 17 => 265000, 18 => 305000, 19 => 355000, 20 => 355000];

    public static function modificador(int $valor): int
    {
        return (int) floor(($valor - 10) / 2);
    }

    /** O item conta? Em inventário (qtd > 0), equipado se for equipável, sintonizado se exigir. */
    public static function ativo(array $ref, array $item): bool
    {
        return ($ref['qtd'] ?? 0) > 0
            && (($item['equipavel'] ?? true) ? ($ref['equipado'] ?? false) : true)
            && (($item['requer_sintonia'] ?? false) ? ($ref['sintonizado'] ?? false) : true);
    }

    /**
     * Efeitos que o item gera a partir dos `dados` do sistema (a armadura define a CA base).
     *
     * @return list<array{alvo: string, modo: string, valor: int|string}>
     */
    public static function efeitosDoItem(array $item): array
    {
        $a = $item['dados']['armadura'] ?? null;
        if (! is_array($a)) {
            return [];
        }
        $base = (int) $a['base'];

        return match ($a['tipo']) {
            'leve' => [['alvo' => 'ca', 'modo' => 'base', 'valor' => "{$base}+@mod.des"]],
            'media' => [['alvo' => 'ca', 'modo' => 'base', 'valor' => "{$base}+min(@mod.des,2)"]],
            'pesada' => [['alvo' => 'ca', 'modo' => 'base', 'valor' => $base]],
            'escudo' => [['alvo' => 'ca', 'modo' => 'soma', 'valor' => $base]],
            default => [],
        };
    }

    /**
     * Efeitos ativos da ficha: itens (na ordem do inventário), condições (na ordem salva), depois os ajustes manuais (soma).
     *
     * @param  array<int, array>  $itens  itens da mesa por id (`Item::paraFront()`)
     * @return list<array{fonte: string, alvo: string, modo: string, valor: mixed}>
     */
    public static function efeitosAtivos(array $f, array $itens): array
    {
        $efeitos = [];
        foreach ($f['inventario'] ?? [] as $secao) {
            foreach ($secao['itens'] ?? [] as $ref) {
                $item = $itens[$ref['item_id']] ?? null; // item excluído da mesa: ignorado
                if ($item === null || ! self::ativo($ref, $item)) {
                    continue;
                }
                array_push($efeitos, ...Efeitos::deFonte((string) ($item['nome'] ?? 'Item'), [...($item['efeitos'] ?? []), ...self::efeitosDoItem($item)]));
            }
        }

        // Condições ativas (ex.: Envenenado dá desvantagem em ataques e testes)
        foreach ($f['condicoes'] ?? [] as $id) {
            array_push($efeitos, ...Efeitos::deFonte(Condicoes::nomeDe($id), Condicoes::efeitosDe($id)));
        }

        $aj = $f['ajustes'] ?? [];
        $manuais = [];
        foreach (['ca', 'iniciativa', 'cd', 'ataque'] as $k) {
            $manuais[$k] = $aj[$k] ?? 0;
        }
        $manuais['carga.max'] = $aj['cargaMax'] ?? 0;
        foreach (FichaDnd5e::ATRIBUTOS as $a) {
            $manuais["salv.{$a}"] = $aj['salvaguardas'][$a] ?? 0;
        }
        foreach (array_keys(FichaDnd5e::PERICIAS) as $p) {
            $manuais["pericia.{$p}"] = $aj['pericias'][$p] ?? 0;
        }
        foreach ($manuais as $alvo => $valor) {
            if ($valor !== 0) {
                $efeitos[] = ['fonte' => 'Ajuste manual', 'alvo' => $alvo, 'modo' => 'soma', 'valor' => $valor];
            }
        }

        return $efeitos;
    }

    /**
     * Valores derivados da ficha, em mapa plano (também são as variáveis de rolagem: `@mod.for`, `@pericia.percepcao`,
     * `@arma.7.ataque`...). Chaves: nivel, prof, atributos.<atr> (efetivo), mod.<atr>, salv.<atr>, pericia.<id>,
     * passiva.<id>, ferramenta.<i>, iniciativa, ca, cd, ataque, ataque.arma, dano.arma, pv.max, carga.atual, carga.max,
     * xp.proximo, dv.max, preparadas.atual e, por arma ativa, arma.<item_id>.ataque / .dano / .margem.
     * Tolerante a chaves ausentes (ficha salva antes de um campo existir): usa 0.
     *
     * @param  array<int, array>  $itens  itens da mesa por id (`Item::paraFront()`)
     * @return array<string, int|float>
     */
    public static function calcular(array $f, array $itens = []): array
    {
        $efeitos = self::efeitosAtivos($f, $itens);
        $nivel = (int) $f['nivel'];
        $prof = 2 + intdiv($nivel - 1, 4) + ($f['ajustes']['proficiencia'] ?? 0);
        $r = ['nivel' => $nivel, 'prof' => $prof];

        // Fase 1: atributos efetivos
        $mod = [];
        foreach (FichaDnd5e::ATRIBUTOS as $a) {
            $r["atributos.{$a}"] = Efeitos::aplicar("atributos.{$a}", $f['atributos'][$a], $efeitos, ['nivel' => $nivel])['valor'];
            $mod[$a] = self::modificador($r["atributos.{$a}"]);
            $r["mod.{$a}"] = $mod[$a];
        }

        // Fase 2: valores-base
        $base = [];
        foreach (FichaDnd5e::ATRIBUTOS as $a) {
            $base["salv.{$a}"] = $mod[$a] + (in_array($a, $f['salvaguardas'], true) ? $prof : 0);
        }
        foreach (FichaDnd5e::PERICIAS as $p => $atributo) {
            $base["pericia.{$p}"] = $mod[$atributo] + ($f['pericias'][$p] ?? 0) * $prof;
        }
        $conjuracao = $mod[$f['magias']['atributo']];
        $base['iniciativa'] = $mod['des'];
        $base['ca'] = 10 + $mod['des'];
        $base['cd'] = 8 + $prof + $conjuracao;
        $base['ataque'] = $prof + $conjuracao;
        $base['ataque.arma'] = 0;
        $base['dano.arma'] = 0;
        $base['carga.max'] = 15 * $r['atributos.for'];
        $base['pv.max'] = $f['pv']['max'] ?? 0;

        // Fase 3: efeitos sobre os valores-base (as fórmulas veem a fase 2)
        $variaveis = $r + $base;
        foreach ($base as $chave => $valor) {
            $r[$chave] = Efeitos::aplicar($chave, $valor, $efeitos, $variaveis)['valor'];
        }
        foreach (array_keys(FichaDnd5e::PERICIAS) as $p) {
            $r["passiva.{$p}"] = 10 + $r["pericia.{$p}"];
        }
        foreach ($f['ferramentas'] as $i => $t) {
            $r["ferramenta.{$i}"] = $mod[$t['atributo']] + $t['prof'] * $prof;
        }

        // Armas ativas: ataque e dano por item (`@arma.<id>.ataque`, `@arma.<id>.dano`)
        foreach ($f['inventario'] ?? [] as $secao) {
            foreach ($secao['itens'] ?? [] as $ref) {
                $item = $itens[$ref['item_id']] ?? null;
                $arma = $item['dados']['arma'] ?? null;
                if ($item === null || ! is_array($arma) || ! self::ativo($ref, $item)) {
                    continue;
                }
                // Ataque e dano podem usar atributos diferentes; sem `atributoDano`, o dano usa o mesmo do ataque.
                $mAtaque = self::modificadorDaArma($arma['atributo'], $mod);
                $mDano = self::modificadorDaArma($arma['atributoDano'] ?? $arma['atributo'], $mod);
                // Bônus simples de acerto e de dano, separados; armas antigas (só `bonusMagico`) usam o mesmo nos dois.
                $bonusAtaque = $arma['bonusAtaque'] ?? $arma['bonusMagico'] ?? 0;
                $bonusDano = $arma['bonusDano'] ?? $arma['bonusMagico'] ?? 0;
                $id = (int) $ref['item_id'];
                $r["arma.{$id}.ataque"] = $mAtaque + (($arma['proficiente'] ?? false) ? $prof : 0) + $bonusAtaque + $r['ataque.arma'];
                $r["arma.{$id}.dano"] = $mDano + $bonusDano + $r['dano.arma'];
                $r["arma.{$id}.margem"] = $arma['margemCritica'] ?? 20; // d20 puro igual ou maior que isto é crítico
            }
        }

        $peso = 0;
        foreach ($f['inventario'] as $secao) {
            foreach ($secao['itens'] as $ref) {
                $peso += $ref['qtd'] * ($itens[$ref['item_id']]['peso'] ?? 0); // item removido da mesa não pesa
            }
        }
        $preparadas = 0;
        foreach ($f['magias']['lista'] as $grupo) {
            foreach ($grupo['magias'] as $m) {
                $preparadas += $grupo['nivel'] >= 1 && $m['preparada'] ? 1 : 0;
            }
        }

        return $r + [
            'carga.atual' => round($peso, 2),
            'xp.proximo' => self::XP_PROXIMO[min(max($nivel, 1), 20)],
            'dv.max' => $nivel,
            'preparadas.atual' => $preparadas,
        ];
    }

    /**
     * Modificador que a arma usa: qualquer atributo (Força, Destreza, Sabedoria...), `acuidade` (o maior entre Força e
     * Destreza) ou `nenhum` (zero: o dano da mão secundária, por exemplo). Valor desconhecido usa a Força.
     *
     * @param  array<string, int>  $mod  modificadores efetivos por atributo
     */
    private static function modificadorDaArma(string $atributo, array $mod): int
    {
        return match ($atributo) {
            'acuidade' => max($mod['for'], $mod['des']),
            'nenhum' => 0,
            default => $mod[$atributo] ?? $mod['for'],
        };
    }

    /**
     * Marca o ataque com arma: o d20 PURO (o mantido, se houve vantagem ou desvantagem) igual ou acima da margem
     * crítica da arma é `critico` (20 por padrão; armas específicas baixam para 19 ou 18); 1 é `falha`.
     * Rolagens que não usam `@arma.<id>.ataque` não são marcadas.
     *
     * Num ataque com arma o card do chat também oferece o DANO: um botão "Dano" (`1d8+4`) e, se o ataque foi crítico,
     * "Dano crítico" (`2d8+4`: os dados do item dobram; o modificador entra uma vez) em destaque, com o normal ao lado.
     * Falha crítica (1 natural) erra sempre: não oferece dano.
     *
     * @param  list<array>  $termos
     * @param  array<int, array>  $itens
     * @return array<string, mixed>
     */
    public static function metadadosDaRolagem(array $termos, array $variaveis, array $itens = []): array
    {
        $arma = null;
        foreach ($termos as $t) {
            if (($t['tipo'] ?? null) === 'variavel' && preg_match('/^arma\.(\d+)\.ataque$/', $t['nome'], $m)) {
                $arma = (int) $m[1];
                break;
            }
        }
        if ($arma === null) {
            return [];
        }

        $natural = null;
        foreach ($termos as $t) {
            if (($t['tipo'] ?? null) !== 'dados' || $t['faces'] !== 20) {
                continue;
            }
            foreach ($t['resultados'] as $i => $v) {
                if (! in_array($i, $t['descartados'], true)) {
                    $natural = $v;
                    break 2;
                }
            }
        }

        $margem = (int) ($variaveis["arma.{$arma}.margem"] ?? 20);
        $meta = ['arma' => $arma, 'margem' => $margem];
        if ($natural !== null) {
            if ($natural >= $margem) {
                $meta['destaque'] = 'critico';
            } elseif ($natural === 1) {
                $meta['destaque'] = 'falha';
            }
        }

        $dano = $itens[$arma]['dados']['arma']['dano'] ?? null;
        if (is_string($dano) && isset($variaveis["arma.{$arma}.dano"]) && ($meta['destaque'] ?? null) !== 'falha') {
            $nome = (string) ($itens[$arma]['nome'] ?? 'Arma');
            $bonus = $variaveis["arma.{$arma}.dano"];
            $acao = fn (string $id, string $rotulo, string $dados, string $rotuloRolagem) => [
                'id' => $id, 'rotulo' => $rotulo, 'resumo' => $dados.($bonus > 0 ? "+{$bonus}" : ($bonus < 0 ? (string) $bonus : '')),
                'expressao' => "{$dados}+@arma.{$arma}.dano", 'rotuloRolagem' => $rotuloRolagem,
            ];
            $normal = $acao('dano', 'Dano', $dano, $nome);
            $meta['acoes'] = ($meta['destaque'] ?? null) === 'critico'
                ? [
                    [...$acao('dano-critico', 'Dano crítico', self::dobrarDados($dano), $nome), 'destaque' => 'critico'],
                    [...$normal, 'rotulo' => 'Dano normal'],
                ]
                : [$normal];
        }

        return $meta;
    }

    /** Dados do item dobrados para o crítico (`1d8` → `2d8`); formato inesperado volta como está. */
    private static function dobrarDados(string $dano): string
    {
        return preg_match('/^(\d+)d(\d+)$/', $dano, $m) ? ($m[1] * 2).'d'.$m[2] : $dano;
    }
}
