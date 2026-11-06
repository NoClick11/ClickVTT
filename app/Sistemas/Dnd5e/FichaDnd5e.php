<?php

namespace App\Sistemas\Dnd5e;

use Illuminate\Validation\Rule;

/**
 * Formato da ficha de D&D 5e (espelha `resources/js/app/ficha/dnd5e.ts`): valores iniciais e regras de validação.
 * Objetos são editados campo a campo; listas (inventário, características, magias) são trocadas por inteiro.
 */
final class FichaDnd5e
{
    public const ATRIBUTOS = ['for', 'des', 'con', 'int', 'sab', 'car'];

    /** Perícia => atributo-base. */
    public const PERICIAS = [
        'acrobacia' => 'des', 'adestrar' => 'sab', 'arcanismo' => 'int', 'atletismo' => 'for', 'atuacao' => 'car', 'enganacao' => 'car',
        'furtividade' => 'des', 'historia' => 'int', 'intimidacao' => 'car', 'intuicao' => 'sab', 'investigacao' => 'int', 'medicina' => 'sab',
        'natureza' => 'int', 'percepcao' => 'sab', 'persuasao' => 'car', 'prestidigitacao' => 'des', 'religiao' => 'int', 'sobrevivencia' => 'sab',
    ];

    public const MOEDAS = ['pl', 'po', 'pe', 'pp', 'pc'];

    public const TEXTOS = ['classe', 'subclasse', 'especie', 'antecedente', 'alinhamento'];

    public const LISTAS_DE_TEXTO = ['sentidos', 'idiomas', 'resistencias', 'imunidades', 'vulnerabilidades', 'proficienciasArmas', 'proficienciasArmaduras'];

    public const MAX_SINTONIA = 3;

    public const TIPOS_ARMADURA = ['leve', 'media', 'pesada', 'escudo'];

    public const BIOGRAFIA = ['personalidade', 'ideais', 'vinculos', 'defeitos', 'aparencia', 'texto'];

    public static function padrao(): array
    {
        $porChave = fn (array $chaves, mixed $valor) => array_fill_keys($chaves, $valor);

        return [
            'classe' => '', 'subclasse' => '', 'nivel' => 1, 'especie' => '', 'antecedente' => '', 'alinhamento' => '',
            'xp' => ['atual' => 0],
            'inspiracao' => false,
            'atributos' => $porChave(self::ATRIBUTOS, 10),
            'salvaguardas' => [],
            'pericias' => $porChave(array_keys(self::PERICIAS), 0),
            'deslocamento' => '9 m',
            'pv' => ['atual' => 0, 'max' => 0, 'temp' => 0],
            'dadosVida' => ['restantes' => 1, 'tipo' => 'd8'],
            'morte' => ['sucessos' => 0, 'falhas' => 0],
            'exaustao' => 0,
            'sentidos' => [], 'idiomas' => [], 'resistencias' => [], 'imunidades' => [], 'vulnerabilidades' => [],
            'proficienciasArmas' => [], 'proficienciasArmaduras' => [],
            'ferramentas' => [],
            'moedas' => $porChave(self::MOEDAS, 0),
            'inventario' => [],
            'condicoes' => [],
            'caracteristicas' => [],
            'magias' => [
                'atributo' => 'sab', 'preparadas' => ['max' => 0],
                'espacos' => [], 'lista' => [],
            ],
            'biografia' => $porChave(self::BIOGRAFIA, ''),
            // Ajustes manuais somados aos valores derivados (Regras::calcular): bônus de itens, magias, efeitos...
            'ajustes' => [
                'proficiencia' => 0, 'ca' => 0, 'iniciativa' => 0, 'cd' => 0, 'ataque' => 0, 'cargaMax' => 0,
                'salvaguardas' => $porChave(self::ATRIBUTOS, 0),
                'pericias' => $porChave(array_keys(self::PERICIAS), 0),
            ],
        ];
    }

    /** @return array<string, mixed> */
    public static function regras(): array
    {
        $texto = ['string', 'max:80'];
        $inteiro = fn (int $min, int $max) => ['integer:strict', "between:{$min},{$max}"];
        $r = [];

        foreach (self::TEXTOS as $c) {
            $r[$c] = $texto;
        }
        $r['nivel'] = $inteiro(1, 20);
        $r['xp.atual'] = $inteiro(0, 10_000_000);
        $r['inspiracao'] = ['boolean:strict'];
        foreach (self::ATRIBUTOS as $a) {
            $r["atributos.{$a}"] = $inteiro(1, 30);
        }
        $r['salvaguardas'] = ['array', 'max:6'];
        $r['salvaguardas.*'] = ['string', Rule::in(self::ATRIBUTOS)];
        foreach (array_keys(self::PERICIAS) as $p) {
            $r["pericias.{$p}"] = ['integer:strict', Rule::in([0, 1, 2])];
        }
        $r['deslocamento'] = $texto;
        foreach (['atual', 'max', 'temp'] as $c) {
            $r["pv.{$c}"] = $inteiro(0, 9999);
        }
        $r['dadosVida.restantes'] = $inteiro(0, 40);
        $r['dadosVida.tipo'] = ['string', Rule::in(['d4', 'd6', 'd8', 'd10', 'd12'])];
        $r['morte.sucessos'] = $inteiro(0, 3);
        $r['morte.falhas'] = $inteiro(0, 3);
        $r['exaustao'] = $inteiro(0, 6);

        foreach (self::LISTAS_DE_TEXTO as $c) {
            $r[$c] = ['array', 'max:50'];
            $r["{$c}.*"] = ['string', 'max:80'];
        }
        $r['ferramentas'] = ['array', 'max:30'];
        $r['ferramentas.*.nome'] = ['required', 'string', 'max:80'];
        $r['ferramentas.*.prof'] = ['required', 'integer:strict', Rule::in([0, 1, 2])];
        $r['ferramentas.*.atributo'] = ['required', 'string', Rule::in(self::ATRIBUTOS)];

        foreach (self::MOEDAS as $m) {
            $r["moedas.{$m}"] = $inteiro(0, 1_000_000_000);
        }

        $r['inventario'] = ['array', 'max:30', function (string $atributo, mixed $inventario, \Closure $fail) {
            $sintonizados = 0;
            foreach ($inventario as $secao) {
                foreach (is_array($secao) ? ($secao['itens'] ?? []) : [] as $ref) {
                    $sintonizados += is_array($ref) && ($ref['sintonizado'] ?? false) === true ? 1 : 0;
                }
            }
            if ($sintonizados > self::MAX_SINTONIA) {
                $fail('No máximo '.self::MAX_SINTONIA.' itens podem estar sintonizados.');
            }
        }];
        $r['inventario.*.secao'] = ['required', 'string', 'max:80'];
        $r['inventario.*.itens'] = ['present', 'array', 'max:300'];
        $r['inventario.*.itens.*.item_id'] = ['required', 'integer:strict', 'min:1'];
        $r['inventario.*.itens.*.qtd'] = ['required', 'integer:strict', 'between:0,100000'];
        $r['inventario.*.itens.*.equipado'] = ['required', 'boolean:strict'];
        $r['inventario.*.itens.*.sintonizado'] = ['required', 'boolean:strict'];

        $r['condicoes'] = ['array', 'max:'.count(Condicoes::ids())];
        $r['condicoes.*'] = ['string', Rule::in(Condicoes::ids()), 'distinct'];

        $r['caracteristicas'] = ['array', 'max:200'];
        $r['caracteristicas.*.nome'] = ['required', 'string', 'max:120'];
        $r['caracteristicas.*.origem'] = ['required', 'string', 'max:120'];
        $r['caracteristicas.*.tipo'] = ['required', 'string', Rule::in(['ativa', 'passiva'])];
        $r['caracteristicas.*.usos.atual'] = $inteiro(0, 999);
        $r['caracteristicas.*.usos.max'] = $inteiro(0, 999);

        $r['magias.atributo'] = ['string', Rule::in(self::ATRIBUTOS)];
        $r['magias.preparadas.max'] = $inteiro(0, 200);
        $r['magias.espacos'] = ['array', 'max:9'];
        $r['magias.espacos.*.nivel'] = ['required', ...$inteiro(1, 9)];
        $r['magias.espacos.*.usados'] = ['required', ...$inteiro(0, 99)];
        $r['magias.espacos.*.total'] = ['required', ...$inteiro(0, 99)];
        $r['magias.lista'] = ['array', 'max:10'];
        $r['magias.lista.*.nivel'] = ['required', ...$inteiro(0, 9)];
        $r['magias.lista.*.magias'] = ['present', 'array', 'max:300'];
        $r['magias.lista.*.magias.*.nome'] = ['required', 'string', 'max:120'];
        $r['magias.lista.*.magias.*.escola'] = ['required', 'string', 'max:40'];
        $r['magias.lista.*.magias.*.preparada'] = ['required', 'boolean:strict'];

        foreach (self::BIOGRAFIA as $c) {
            $r["biografia.{$c}"] = ['string', 'max:'.($c === 'texto' ? 20000 : 5000)];
        }

        foreach (['proficiencia', 'ca', 'iniciativa', 'cd', 'ataque'] as $c) {
            $r["ajustes.{$c}"] = $inteiro(-20, 20);
        }
        $r['ajustes.cargaMax'] = $inteiro(-999, 999);
        foreach (self::ATRIBUTOS as $a) {
            $r["ajustes.salvaguardas.{$a}"] = $inteiro(-20, 20);
        }
        foreach (array_keys(self::PERICIAS) as $p) {
            $r["ajustes.pericias.{$p}"] = $inteiro(-20, 20);
        }

        return $r;
    }

    /**
     * Regras de `Item::dados` no D&D 5e: `armadura` (tipo + base: CA base, ou o bônus do escudo) e `arma` (dado de
     * dano — até 50 dados, para o crítico (que dobra) caber no limite de 100 dados por termo —, atributo que entra no
     * ataque/dano, proficiência e bônus mágico). Sem regra no pai: só o declarado é guardado.
     *
     * @return array<string, mixed>
     */
    public static function regrasItem(): array
    {
        return [
            'dados.armadura.tipo' => ['required_with:dados.armadura.base', 'string', Rule::in(self::TIPOS_ARMADURA)],
            'dados.armadura.base' => ['required_with:dados.armadura.tipo', 'integer:strict', 'between:0,30'],
            'dados.arma.dano' => ['required_with:dados.arma.atributo', 'string', 'regex:/^(?:[1-9]|[1-4]\d|50)d(?:[2-9]|[1-9]\d{1,2})$/'],
            'dados.arma.atributo' => ['required_with:dados.arma.dano', 'string', Rule::in([...self::ATRIBUTOS, 'acuidade'])],
            // Atributo do dano; sem ele, o dano usa o mesmo do ataque. `nenhum` = dano sem modificador (mão secundária).
            'dados.arma.atributoDano' => ['nullable', 'string', Rule::in([...self::ATRIBUTOS, 'acuidade', 'nenhum'])],
            'dados.arma.tipoDano' => ['nullable', 'string', 'max:30'],
            'dados.arma.proficiente' => ['boolean:strict'],
            // Bônus simples (inteiros) somados ao acerto e ao dano. `bonusMagico` é o formato antigo: um só valor para os dois.
            'dados.arma.bonusAtaque' => ['nullable', 'integer:strict', 'between:-10,20'],
            'dados.arma.bonusDano' => ['nullable', 'integer:strict', 'between:-10,20'],
            'dados.arma.bonusMagico' => ['integer:strict', 'between:-3,10'],
            'dados.arma.margemCritica' => ['integer:strict', 'between:10,20'], // d20 puro igual ou maior é crítico (padrão 20)
        ];
    }
}
