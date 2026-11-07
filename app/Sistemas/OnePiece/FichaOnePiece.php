<?php

namespace App\Sistemas\OnePiece;

use App\Nucleo\Efeitos\Efeitos;
use Illuminate\Validation\Rule;

/**
 * Formato da ficha de One Piece (espelha `resources/js/app/sistemas/onepiece/regras.ts`): valores iniciais e regras de validação.
 * Objetos são editados campo a campo; listas (inventário, características, técnicas) são trocadas por inteiro.
 */
final class FichaOnePiece
{
    public const ATRIBUTOS = ['for', 'des', 'con', 'sab', 'pre', 'von'];

    /** Perícia => atributo-base. */
    public const PERICIAS = [
        'atletismo' => 'for',
        'acrobacia' => 'des', 'furtividade' => 'des', 'prestidigitacao' => 'des',
        'historia' => 'sab', 'investigacao' => 'sab', 'medicina' => 'sab', 'natureza' => 'sab', 'sobrevivencia' => 'sab',
        'atuacao' => 'pre', 'enganacao' => 'pre', 'intimidacao' => 'pre', 'persuasao' => 'pre', 'provocacao' => 'pre',
        'haki' => 'von', 'intuicao' => 'von', 'percepcao' => 'von', 'sobrenatural' => 'von', 'sorte' => 'von',
    ];

    /** Pontos de poder ganhos por nível: 4, ou 5 com certas características. */
    public const PP_POR_NIVEL = [4, 5];

    public const MAX_TECNICAS = 200;

    /** Categorias de ação do combate (ver `OnePiece::categoriasDeAcao`). */
    public const CATEGORIAS_DE_ACAO = ['padrao', 'poderosa', 'bonus', 'livre', 'reacao'];

    /** Tipos da Akuma no Mi ('' = sem tipo definido). */
    public const TIPOS_AKUMA = ['', 'paramecia', 'zoan', 'logia'];

    public const TEXTOS = ['especie', 'estilo', 'profissao', 'fruta', 'antecedente'];

    public const LISTAS_DE_TEXTO = ['sentidos', 'idiomas', 'resistencias', 'imunidades', 'vulnerabilidades', 'proficienciasArmas', 'proficienciasArmaduras'];

    public const MAX_SINTONIA = 3;

    public const MAX_DANO_EXTRA = 3;

    public const TIPOS_ARMADURA = ['leve', 'media', 'pesada', 'escudo'];

    /**
     * Alvos que um efeito pode ter no D&D 5e (os valores calculados da ficha). `OnePiece::alvosDeEfeito()` devolve estes.
     *
     * @return list<string>
     */
    public static function alvosDeEfeito(): array
    {
        return [
            // numéricos (soma, base, mín., máx.)
            'ca', 'iniciativa', 'cd', 'ataque', 'ataque.arma', 'dano.arma', 'carga.max', 'pv.max',
            'salv.*', 'pericia.*', 'atributos.*', 'pp.max', 'dano.tecnica',
            // alcance corpo a corpo e deslocamentos (em decímetros: 15 = 1,5 m) e a fração do dano das armas à distância (100 = inteiro)
            'alcance.corpo', 'movimento.*', 'movimento.normal', 'movimento.nado', 'movimento.escalada', 'movimento.voo', 'dano.distancia.pct',
            // só para vantagem/desvantagem: testes de atributo e de ferramenta (os demais alvos de rolagem são os de cima)
            'teste.*', 'ferramenta.*', ...array_map(fn ($a) => "teste.{$a}", self::ATRIBUTOS),
            ...array_map(fn ($a) => "salv.{$a}", self::ATRIBUTOS),
            ...array_map(fn ($a) => "atributos.{$a}", self::ATRIBUTOS),
            ...array_map(fn ($p) => "pericia.{$p}", array_keys(self::PERICIAS)),
        ];
    }

    public static function padrao(): array
    {
        $porChave = fn (array $chaves, mixed $valor) => array_fill_keys($chaves, $valor);

        return [
            'nivel' => 1, 'especie' => '', 'estilo' => '', 'profissao' => '', 'fruta' => '', 'antecedente' => '',
            'xp' => ['atual' => 0],
            'inspiracao' => false,
            'tamanho' => 'Médio',
            'movimento' => ['normal' => 9, 'nado' => 0, 'escalada' => 0, 'voo' => 0],
            'ancestralidade' => '',
            // Anão com Hóspede Feérico: id do personagem em cujo espaço ele está (null = em lugar nenhum).
            'hospedado' => null,
            'recompensa' => 0,
            'belly' => 0,
            'atributos' => $porChave(self::ATRIBUTOS, 10),
            'salvaguardas' => [],
            'pericias' => $porChave(array_keys(self::PERICIAS), 0),
            'deslocamento' => '9 m',
            'pv' => ['atual' => 0, 'max' => 0, 'temp' => 0],
            'pp' => ['atual' => 0, 'porNivel' => 4],
            'dadosVida' => ['restantes' => 1, 'tipo' => 'd8'],
            'exaustao' => 0,
            'sentidos' => [], 'idiomas' => [], 'resistencias' => [], 'imunidades' => [], 'vulnerabilidades' => [],
            'proficienciasArmas' => [], 'proficienciasArmaduras' => [],
            'ferramentas' => [],
            'inventario' => [],
            'condicoes' => [],
            // Condições com duração: id da condição => {turnos que faltam, acaba ao receber dano}. Quem mexe é o servidor (turnos, dano).
            'duracoes' => [],
            'caracteristicas' => [],
            'tecnicas' => ['atributo' => 'von', 'lista' => []],
            // A Akuma no Mi: o nome é `fruta`; os poderes têm o mesmo formato das técnicas e gastam os mesmos PP.
            'akuma' => ['tipo' => '', 'despertada' => false, 'lista' => []],
            // Ajustes manuais somados aos valores derivados (Regras::calcular): bônus de itens, técnicas, efeitos...
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
        $r['tamanho'] = ['string', 'max:40'];
        foreach (['normal', 'nado', 'escalada', 'voo'] as $m) {
            $r["movimento.{$m}"] = ['numeric', 'between:0,999'];
        }
        $r['ancestralidade'] = ['string', 'max:2000'];
        $r['hospedado'] = ['nullable', 'integer:strict', 'min:1'];
        $r['recompensa'] = $inteiro(0, 1_000_000_000_000);
        $r['belly'] = $inteiro(0, 1_000_000_000_000);
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
        $r['pp.atual'] = $inteiro(0, 9999);
        $r['pp.porNivel'] = ['integer:strict', Rule::in(self::PP_POR_NIVEL)];
        $r['exaustao'] = $inteiro(0, 6);

        foreach (self::LISTAS_DE_TEXTO as $c) {
            $r[$c] = ['array', 'max:50'];
            $r["{$c}.*"] = ['string', 'max:80'];
        }
        $r['ferramentas'] = ['array', 'max:30'];
        $r['ferramentas.*.nome'] = ['required', 'string', 'max:80'];
        $r['ferramentas.*.prof'] = ['required', 'integer:strict', Rule::in([0, 1, 2])];
        $r['ferramentas.*.atributo'] = ['required', 'string', Rule::in(self::ATRIBUTOS)];

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
        $r['duracoes'] = ['array', 'max:'.count(Condicoes::ids())];
        foreach (Condicoes::ids() as $id) {
            $r["duracoes.{$id}.turnos"] = $inteiro(1, 99);
            $r["duracoes.{$id}.aoDano"] = ['boolean:strict'];
        }

        $r['caracteristicas'] = ['array', 'max:200'];
        $r['caracteristicas.*.nome'] = ['required', 'string', 'max:120'];
        $r['caracteristicas.*.origem'] = ['required', 'string', 'max:120'];
        $r['caracteristicas.*.tipo'] = ['required', 'string', Rule::in(['ativa', 'passiva'])];
        $r['caracteristicas.*.usos.atual'] = $inteiro(0, 999);
        $r['caracteristicas.*.usos.max'] = $inteiro(0, 999);
        // Máximo igual ao bônus de proficiência (o front recalcula).
        $r['caracteristicas.*.usos.porProf'] = ['nullable', 'boolean'];
        // Máximo igual ao nível do personagem (Heat, Electro...).
        $r['caracteristicas.*.usos.porNivel'] = ['nullable', 'boolean'];
        $r['caracteristicas.*.descricao'] = ['nullable', 'string', 'max:4000'];
        // Quem criou: o assistente de criação marca `especie`/`variacao` para refazer o passo sem duplicar.
        $r['caracteristicas.*.builder'] = ['nullable', 'string', Rule::in(['especie', 'variacao'])];
        // Etiquetas de combate mostradas na ficha (ex.: "Alcança alvos Enormes", "Ignora terreno difícil").
        // Categoria de ação que ligar/usar a característica gasta (nenhuma = não gasta ação).
        $r['caracteristicas.*.acao'] = ['nullable', 'string', Rule::in(self::CATEGORIAS_DE_ACAO)];
        $r['caracteristicas.*.acoes.*.acao'] = ['nullable', 'string', Rule::in(self::CATEGORIAS_DE_ACAO)];
        $r['caracteristicas.*.etiquetas'] = ['nullable', 'array', 'max:8'];
        $r['caracteristicas.*.etiquetas.*'] = ['string', 'max:80'];
        // Limite por rodada compartilhado entre características do mesmo grupo (Heat, Electro, Potencializador) e a rodada do último uso.
        $r['caracteristicas.*.grupoRodada'] = ['nullable', 'string', 'max:30'];
        $r['caracteristicas.*.usadoNaRodada'] = ['nullable', 'integer:strict', 'between:0,9999'];
        // Forma alternativa (junto da jogada de ataque, sem ação bônus): contador próprio de usos.
        $r['caracteristicas.*.alternativo.atual'] = ['nullable', 'integer:strict', 'between:0,99'];
        $r['caracteristicas.*.alternativo.max'] = ['nullable', 'integer:strict', 'between:0,99'];
        // Ações da característica: aplicar uma condição (a si ou ao alvo mirado, com salvaguarda e duração), hospedar-se no alvo ou
        // rolar um dado extra de dano.
        $r['caracteristicas.*.acoes'] = ['nullable', 'array', 'max:6'];
        $r['caracteristicas.*.acoes.*.rotulo'] = ['required', 'string', 'max:60'];
        $r['caracteristicas.*.acoes.*.tipo'] = ['required', 'string', Rule::in(['condicao', 'hospedar', 'dadoExtra'])];
        $r['caracteristicas.*.acoes.*.alvo'] = ['nullable', 'string', Rule::in(['proprio', 'mirado'])];
        $r['caracteristicas.*.acoes.*.condicao'] = ['nullable', 'string', Rule::in(Condicoes::ids())];
        $r['caracteristicas.*.acoes.*.atributo'] = ['nullable', 'string', Rule::in(self::ATRIBUTOS)];
        $r['caracteristicas.*.acoes.*.cd'] = ['nullable', 'integer:strict', 'between:1,40'];
        $r['caracteristicas.*.acoes.*.turnos'] = ['nullable', 'string', 'regex:/^\d{1,2}(d\d{1,2})?$/'];
        $r['caracteristicas.*.acoes.*.aoDano'] = ['nullable', 'boolean'];
        // Buffs de estilo de luta, fruta ou haki: uma característica também carrega efeitos (os mesmos dos itens). A passiva sempre vale; a ativa
        // vale enquanto `ativa` estiver ligada (o interruptor da ficha).
        $r['caracteristicas.*.ativa'] = ['boolean:strict'];
        // Em que descanso os usos voltam (padrão: o longo). Qualquer descanso desliga os buffs ativos.
        $r['caracteristicas.*.descanso'] = ['nullable', 'string', Rule::in(['curto', 'longo'])];
        $r += Efeitos::regras('caracteristicas.*.efeitos', self::alvosDeEfeito());

        $r['tecnicas.atributo'] = ['string', Rule::in(self::ATRIBUTOS)];
        $r['tecnicas.lista'] = ['array', 'max:'.self::MAX_TECNICAS];
        $r['tecnicas.lista.*.nome'] = ['required', 'string', 'max:120'];
        $r['tecnicas.lista.*.origem'] = ['present', 'string', 'max:120'];
        $r['tecnicas.lista.*.custo'] = ['required', ...$inteiro(0, 99)];
        $r['tecnicas.lista.*.alcance'] = ['present', 'string', 'max:60'];
        $r['tecnicas.lista.*.efeito'] = ['present', 'string', 'max:120'];
        $r['tecnicas.lista.*.descricao'] = ['present', 'string', 'max:2000'];
        // Rolagem opcional da técnica (ex.: 3d8+@mod.for); vazia = a técnica só gasta PP. O rolador valida a expressão ao rolar.
        $r['tecnicas.lista.*.rolagem'] = ['present', 'string', 'max:100'];
        // Tipo do dano da técnica (fogo, elétrico...): respeita resistências e imunidades ao aplicar o dano no alvo.
        $r['tecnicas.lista.*.tipoDano'] = ['nullable', 'string', 'max:30'];
        // Categoria de ação que a técnica gasta (padrão: poderosa).
        $r['tecnicas.lista.*.acao'] = ['nullable', 'string', Rule::in(self::CATEGORIAS_DE_ACAO)];
        // Quem criou a técnica: o assistente de criação marca `especie` para refazer o passo sem duplicar.
        $r['tecnicas.lista.*.builder'] = ['nullable', 'string', Rule::in(['especie'])];

        // Reação (usada fora do turno, ex.: ao ser atacado): gatilho, a quem serve, bônus na defesa e cura.
        foreach (['tecnicas.lista.*', 'akuma.lista.*', 'caracteristicas.*'] as $base) {
            $r["{$base}.reacao.gatilho"] = ['nullable', 'string', Rule::in(['ataque_declarado'])];
            $r["{$base}.reacao.alcance"] = ['nullable', 'string', Rule::in(['si', 'aliado', 'ambos'])];
            $r["{$base}.reacao.defesa"] = ['nullable', 'integer:strict', 'between:-20,20'];
            $r["{$base}.reacao.cura"] = ['nullable', 'string', 'regex:/^\d{1,3}$|^\d{1,2}d\d{1,3}$/'];
        }

        $r['akuma.tipo'] = ['string', Rule::in(self::TIPOS_AKUMA)];
        $r['akuma.despertada'] = ['boolean:strict'];
        $r['akuma.lista'] = ['array', 'max:'.self::MAX_TECNICAS];
        $r['akuma.lista.*.nome'] = ['required', 'string', 'max:120'];
        $r['akuma.lista.*.origem'] = ['present', 'string', 'max:120'];
        $r['akuma.lista.*.custo'] = ['required', ...$inteiro(0, 99)];
        $r['akuma.lista.*.alcance'] = ['present', 'string', 'max:60'];
        $r['akuma.lista.*.efeito'] = ['present', 'string', 'max:120'];
        $r['akuma.lista.*.descricao'] = ['present', 'string', 'max:2000'];
        $r['akuma.lista.*.rolagem'] = ['present', 'string', 'max:100'];
        $r['akuma.lista.*.tipoDano'] = ['nullable', 'string', 'max:30'];
        $r['akuma.lista.*.acao'] = ['nullable', 'string', Rule::in(self::CATEGORIAS_DE_ACAO)];
        $r['akuma.lista.*.builder'] = ['nullable', 'string', Rule::in(['especie'])];

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
            // Dados extras DA ARMA (ex.: +2d6 de fogo): até 3, cada um com o tipo do dano. Sem regra no pai, para só o declarado
            // ser guardado; o limite de 3 vai na regra de cada um.
            'dados.arma.danoExtra.*.dados' => ['required', 'string', 'regex:'.Efeitos::REGEX_DADOS, function (string $atributo, mixed $valor, \Closure $fail) {
                if (preg_match('/danoExtra\.(\d+)\./', $atributo, $m) && (int) $m[1] >= self::MAX_DANO_EXTRA) {
                    $fail('No máximo '.self::MAX_DANO_EXTRA.' dados extras por arma.');
                }
            }],
            'dados.arma.danoExtra.*.tipo' => ['nullable', 'string', 'max:30'],
            // Arma à distância (o anão com Armas Reduzidas causa metade do dano) e tamanho da arma (gigantes só usam armas de gigante).
            'dados.arma.distancia' => ['boolean:strict'],
            'dados.arma.tamanho' => ['nullable', 'string', Rule::in(['padrao', 'gigante'])],
            'dados.arma.margemCritica' => ['integer:strict', 'between:10,20'], // d20 puro igual ou maior é crítico (padrão 20)
        ];
    }
}
