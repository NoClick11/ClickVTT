<?php

namespace App\Sistemas\OnePiece;

/**
 * Catálogo de itens do One Piece (cap. 8) no servidor: equipamentos, armas, veículos e serviços com preço, peso, raridade e
 * dados do sistema. Vem de `dados/itens.json` (gerado de `itens/` no TS e conferido por teste). A loja usa o preço de compra e
 * de venda daqui, nunca o que o cliente manda.
 */
class Itens
{
    /** @var array<string, mixed>|null */
    private static ?array $catalogo = null;

    /** @return array<string, mixed> */
    public static function catalogo(): array
    {
        return self::$catalogo ??= json_decode(file_get_contents(__DIR__.'/dados/itens.json'), true);
    }

    /** @return array<string, mixed>|null */
    public static function item(string $id): ?array
    {
        foreach (self::catalogo()['itens'] as $i) {
            if ($i['id'] === $id) {
                return $i;
            }
        }

        return null;
    }

    /** Preço de compra: o do livro vezes `$fator` (Mercado Negro: até 100 vezes, a critério do Narrador). Null se o preço não é fixo. */
    public static function precoDeCompra(array $item, float $fator = 1): ?int
    {
        if ($item['preco'] === null) {
            return null;
        }
        $max = $item['raridade'] === 'mercado-negro' ? (float) self::catalogo()['comercio']['multiplicadorMaximoDoMercadoNegro'] : 1.0;

        return (int) round($item['preco'] * min(max($fator, 0.0), $max));
    }

    /** Preço de venda: metade do preço em bom estado; serviços e itens sem preço fixo não se vendem. */
    public static function precoDeVenda(array $item, bool $bomEstado = true): ?int
    {
        if ($item['tipo'] !== 'item' || $item['preco'] === null) {
            return null;
        }

        return (int) floor($item['preco'] * ($bomEstado ? (float) self::catalogo()['comercio']['vendaDeEquipamentos'] : 0.0));
    }

    /** "฿ 80.000", "฿ 8.000/unidade" ou o texto do livro quando o preço varia. Espelha `precoFormatado` do TS. */
    public static function precoFormatado(array $i): string
    {
        if ($i['preco'] === null) {
            return $i['precoTexto'] ?? 'Sob consulta';
        }
        if (! empty($i['precoTexto'])) {
            return $i['precoTexto'];
        }
        $un = ! empty($i['unidade']) ? '/'.$i['unidade'] : '';

        return '฿ '.number_format((int) $i['preco'], 0, ',', '.').$un;
    }

    /**
     * O que a ficha calcula no item: armadura/escudo e, se o dano da arma é fixo, a arma. Espelha `dadosDoSistema` do TS.
     *
     * @return array<string, mixed>
     */
    public static function dadosDoSistema(array $i): array
    {
        $dados = ($i['dados'] ?? []) + ['catalogo' => ['id' => $i['id']]];
        $a = $i['arma'] ?? null;
        if ($a && ! empty($a['porMunicao']) && $i['categoria'] !== 'municao') {
            // pistola, mosquete, canhão, arco, zarabatana: o dado e o tipo do dano vêm da munição escolhida ao atacar
            $dados['arma'] = [
                'atributo' => 'des',
                'tipoDano' => $a['tipoDano'],
                'municao' => true,
                'distancia' => true,
            ] + self::alcanceDaArma($a) + (! empty($a['expertiseId']) ? ['forja' => ['expertise' => [$a['expertiseId']]]] : []);
        } elseif ($a && ! empty($a['dano']) && preg_match('/^\d+d\d+$/', $a['dano']) && $i['categoria'] !== 'municao') {
            $aDistancia = ! empty($a['distancia']) && ! array_filter($a['propriedades'], fn ($p) => str_starts_with($p, 'Arremesso'));
            $dados['arma'] = [
                'dano' => $a['dano'],
                'atributo' => in_array('Acuidade', $a['propriedades'], true) ? 'acuidade' : ($aDistancia ? 'des' : 'for'),
                'tipoDano' => $a['tipoDano'],
            ] + ($aDistancia ? ['distancia' => true] : []) + self::alcanceDaArma($a) + (! empty($a['expertiseId']) ? ['forja' => ['expertise' => [$a['expertiseId']]]] : []);
        }

        return $dados;
    }

    /**
     * O alcance (m) da arma do catálogo no item da mesa: Distância/Arremesso trazem normal e máximo; as demais valem o alcance corpo a corpo
     * (1,5 m, ou 3 m com a propriedade Alcance). Espelha `alcanceDaArmaDoCatalogo` do TS.
     *
     * @return array{alcanceNormal: float|int, alcanceMaximo: float|int}
     */
    public static function alcanceDaArma(array $a): array
    {
        if (! empty($a['distancia'])) {
            return ['alcanceNormal' => $a['distancia'][0], 'alcanceMaximo' => $a['distancia'][1]];
        }
        $corpo = in_array('Alcance', $a['propriedades'] ?? [], true) ? 3 : 1.5;

        return ['alcanceNormal' => $corpo, 'alcanceMaximo' => $corpo];
    }

    /** Descrição, dano, propriedades, expertise, raridade e preço, para o item da mesa. Espelha `descricaoParaAMesa` do TS. */
    public static function descricaoParaAMesa(array $i): string
    {
        $a = $i['arma'] ?? null;
        $partes = [$i['descricao']];
        if ($a) {
            $dano = ! empty($a['dano'])
                ? $a['dano'].' '.$a['tipoDano'].(! empty($a['tiposAlternativos']) ? ' ou '.implode(' ou ', $a['tiposAlternativos']) : '')
                : (! empty($a['marcial']) ? "dano desarmado +1 passo ({$a['tipoDano']})" : $a['tipoDano']);
            $partes[] = "Dano: {$dano}.";
            if ($a['propriedades']) {
                $partes[] = 'Propriedades: '.implode(', ', $a['propriedades']).'.';
            }
            if (! empty($a['expertise'])) {
                $partes[] = 'Expertise (acerto crítico natural, só com proficiência): '.$a['expertise'];
            }
        }
        $raridade = '';
        foreach (self::catalogo()['raridades'] as $r) {
            if ($r['id'] === $i['raridade']) {
                $raridade = $r['nome'];
            }
        }
        $partes[] = "Raridade: {$raridade}. Preço: ".self::precoFormatado($i).'.';

        return mb_substr(implode("\n", $partes), 0, 2000);
    }

    /**
     * Campos do item da mesa a partir de uma entrada do catálogo do sistema.
     *
     * @return array<string, mixed>
     */
    public static function paraAMesa(array $i): array
    {
        return [
            'nome' => $i['nome'], 'descricao' => self::descricaoParaAMesa($i), 'peso' => (float) $i['peso'], 'equipavel' => (bool) $i['equipavel'],
            'requer_sintonia' => false, 'efeitos' => [], 'dados' => self::dadosDoSistema($i),
        ];
    }
}
