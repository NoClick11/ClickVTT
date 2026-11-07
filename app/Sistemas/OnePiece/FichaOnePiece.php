<?php

namespace App\Sistemas\OnePiece;

use App\Nucleo\Efeitos\Efeitos;
use App\Nucleo\Efeitos\Formula;
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
        // a perícia da Profissão (cap. 4): treinada com a profissão, soma a proficiência em Testes de qualquer atributo ligados a ela
        'oficio' => 'sab',
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
            'ca', 'iniciativa', 'cd', 'ataque', 'ataque.arma', 'dano.arma', 'carga.max', 'pv.max', 'escudo.max',
            'salv.*', 'pericia.*', 'atributos.*', 'pp.max', 'dano.tecnica',
            // alcance corpo a corpo e deslocamentos (em decímetros: 15 = 1,5 m) e a fração do dano das armas à distância (100 = inteiro)
            'alcance.corpo', 'passo.corpo', 'passo.distancia', 'passo.desarmado', 'passo.tecnica', 'margem.corpo', 'margem.distancia', 'ataques.acao', 'ataques.distancia', 'ataque.desarmado', 'dano.desarmado', 'concentracao', 'movimento.*', 'movimento.normal', 'movimento.nado', 'movimento.escalada', 'movimento.voo', 'dano.distancia.pct',
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
            'aliado' => false,
            'itensIniciais' => [],
            'dinheiroInicial' => 0,
            // Primeiros Socorros: esta criatura já recebeu o tratamento (volta no descanso longo)
            'socorrido' => false,
            // Superioridade Absoluta: bônus ao nível para zerar o alvo, +5 por criatura derrotada (máx. +15) até o fim do encontro
            'bonusExecucao' => 0,
            // Atributo primário do estilo de combate (Defesa Aprimorada, Defesa Ofensiva...) e as Habilidades Básicas escolhidas
            'atributoPrimario' => 'for',
            // Estilo do catálogo e caminho escolhido (o assistente "Subir de nível" lê daqui)
            'estiloId' => '',
            // Maestria aprendida (uma só) e os Traços de Maestria já escolhidos, com o nível em que vieram
            'haki' => Haki::padrao(),
            'treinamento' => Treinamentos::padrao(),
            'profissoes' => Profissoes::padrao(),
            'individualidades' => Individualidades::padrao(),
            'forja' => Ferreiro::padrao(),
            // Usos gastos da Saijo Ô Wazamono (rolar o dano duas vezes): até 3 por descanso longo; o servidor consome ao rolar.
            'meito' => ['usados' => 0],
            'maestria' => '',
            'tracosDeMaestria' => [],
            'estiloCaminho' => '',
            'habilidadesBasicas' => [],
            'recompensa' => 0,
            'belly' => 0,
            'atributos' => $porChave(self::ATRIBUTOS, 10),
            'salvaguardas' => [],
            'pericias' => $porChave(array_keys(self::PERICIAS), 0),
            'deslocamento' => '9 m',
            'pv' => ['atual' => 0, 'max' => 0, 'temp' => 0, 'escudo' => 0],
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
            'akuma' => Akuma::padrao(),
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
        // NPC aliado dos jogadores (só o mestre muda): os jogadores não o atingem
        $r['aliado'] = ['boolean:strict'];
        // O que a criação entregou do inventário inicial (só o servidor mexe: refazer a criação não duplica os itens)
        $r['dinheiroInicial'] = ['integer:strict', 'between:0,1000000000000'];
        $r['itensIniciais'] = ['array', 'max:60'];
        $r['itensIniciais.*.item_id'] = ['required', 'integer:strict', 'min:1'];
        $r['itensIniciais.*.qtd'] = ['required', 'integer:strict', 'between:1,1000'];
        $r['socorrido'] = ['boolean:strict'];
        $r['bonusExecucao'] = ['integer:strict', 'between:0,15'];
        $r['atributoPrimario'] = ['string', Rule::in(self::ATRIBUTOS)];
        $r['estiloId'] = ['nullable', 'string', 'max:40'];
        // Haki: `liberado`, `rei`, `prematuroNivel`, `extras` e `restritos` só o mestre grava (FichaController); o resto é do dono
        $r['haki'] = ['array'];
        $r['haki.ativo'] = ['boolean:strict'];
        foreach (['liberado', 'rei'] as $c) {
            $r["haki.{$c}"] = ['boolean:strict'];
        }
        $r['haki.prematuroNivel'] = $inteiro(0, 20);
        $r['haki.extras'] = $inteiro(-999, 999);
        $r['haki.restritos'] = ['array'];
        foreach (Haki::TIPOS as $t) {
            $r["haki.restritos.{$t}"] = $inteiro(0, 999);
        }
        $r['haki.principal'] = ['nullable', 'string', Rule::in(['', 'armamento', 'observacao'])];
        $r['haki.afinidade'] = ['nullable', 'string', Rule::in(['', ...Haki::TIPOS])];
        $r['haki.talentos'] = ['array', 'max:60'];
        $r['haki.talentos.*.id'] = ['required', 'string', 'max:40'];
        $r['haki.talentos.*.formas'] = ['required', 'integer:strict', 'between:1,3'];
        // Treinamentos: `extras` e `aprendidos` só o mestre grava; o dono faz pedidos (FichaController)
        $r['treinamento'] = ['array'];
        $r['treinamento.extras'] = $inteiro(-999, 999);
        $r['treinamento.codigo'] = ['nullable', 'string', 'max:40'];
        $r['treinamento.aprendidos'] = ['array', 'max:60'];
        $r['treinamento.aprendidos.*.id'] = ['required', 'string', 'max:50'];
        $r['treinamento.aprendidos.*.nivel'] = ['required', 'integer:strict', 'between:1,20'];
        $r['treinamento.aprendidos.*.opcao'] = ['nullable', 'string', 'max:30'];
        $r['treinamento.pedidos'] = ['array', 'max:20'];
        $r['treinamento.pedidos.*.id'] = ['required', 'string', 'max:50'];
        $r['treinamento.pedidos.*.opcao'] = ['nullable', 'string', 'max:30'];
        $r['treinamento.pedidos.*.dias'] = ['required', 'integer:strict', 'between:0,60'];
        // Profissões: o dono escolhe a do 1º nível e usa os avanços (5/10/15/20); o resto é do mestre (OnePiece::conferirFicha)
        $r['meito'] = ['array'];
        $r['meito.usados'] = ['integer:strict', 'between:0,3'];
        // Pontos de Forja do Ferreiro: idade, lâminas comuns e PF dados são do mestre; os PF gastos e as lâminas, da forja (servidor).
        $r['forja'] = ['array'];
        foreach (['idade', 'laminas', 'extras', 'gastos'] as $campo) {
            $r["forja.{$campo}"] = ['integer:strict', 'between:-999,100000'];
        }
        // Individualidades (regra opcional): Singularidades e Defeitos; o servidor confere espaços, pares e o que é do mestre.
        $r['individualidades'] = ['array'];
        $r['individualidades.variaveis'] = ['boolean:strict'];
        $r['individualidades.extras'] = [...$inteiro(0, 20)];
        $r['individualidades.travada'] = ['boolean:strict'];
        foreach (['singularidades', 'defeitos'] as $grupo) {
            $r["individualidades.{$grupo}"] = ['array', 'max:30'];
            $r["individualidades.{$grupo}.*.id"] = ['required', 'string', 'max:40'];
            $r["individualidades.{$grupo}.*.escolha"] = ['nullable', 'string', 'max:80'];
        }
        $r['profissoes'] = ['array'];
        $r['profissoes.semProfissao'] = ['boolean:strict'];
        $r['profissoes.livroLido'] = ['boolean:strict'];
        $r['profissoes.lista'] = ['array', 'max:5'];
        $r['profissoes.lista.*.id'] = ['required', 'string', 'max:40'];
        $r['profissoes.lista.*.graduacao'] = ['required', 'integer:strict', 'between:0,3'];
        $r['profissoes.lista.*.nivel'] = ['required', 'integer:strict', 'between:1,20'];
        $r['profissoes.lista.*.secundaria'] = ['boolean:strict'];
        $r['profissoes.usados'] = ['array', 'max:4'];
        $r['profissoes.usados.*'] = ['integer:strict', Rule::in(Profissoes::NIVEIS)];
        $r['maestria'] = ['nullable', 'string', 'max:40'];
        $r['tracosDeMaestria'] = ['array', 'max:3'];
        $r['tracosDeMaestria.*.id'] = ['required', 'string', 'max:40'];
        $r['tracosDeMaestria.*.nivel'] = ['required', 'integer:strict', 'between:1,20'];
        $r['estiloCaminho'] = ['nullable', 'string', 'max:40'];
        // Habilidades Básicas escolhidas: id, nível em que veio e, no Quebrador de Regras, a opção escolhida (lista trocada por inteiro)
        $r['habilidadesBasicas'] = ['array', 'max:30'];
        $r['habilidadesBasicas.*.id'] = ['required', 'string', 'max:40'];
        $r['habilidadesBasicas.*.nivel'] = ['required', 'integer:strict', 'between:1,20'];
        $r['habilidadesBasicas.*.opcao'] = ['nullable', 'string', 'max:40'];
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
        foreach (['atual', 'max', 'temp', 'escudo'] as $c) {
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
        $r['caracteristicas.*.usos.formula'] = ['nullable', 'string', 'max:60'];
        // Máximo igual ao nível do personagem (Heat, Electro...).
        $r['caracteristicas.*.usos.porNivel'] = ['nullable', 'boolean'];
        $r['caracteristicas.*.descricao'] = ['nullable', 'string', 'max:4000'];
        // Quem criou: o assistente de criação marca `especie`/`variacao` para refazer o passo sem duplicar.
        $r['caracteristicas.*.builder'] = ['nullable', 'string', Rule::in(['especie', 'variacao', 'estilo', 'maestria', 'haki', 'treinamento', 'antecedente', 'profissao', 'akuma', 'individualidade'])];
        // Etiquetas de combate mostradas na ficha (ex.: "Alcança alvos Enormes", "Ignora terreno difícil").
        // Categoria de ação que ligar/usar a característica gasta (nenhuma = não gasta ação).
        // Faixa de nível em que a característica vale (as Habilidades Básicas mudam com o nível) e de qual HB ela vem
        $r['caracteristicas.*.nivelMin'] = ['nullable', 'integer:strict', 'between:1,20'];
        $r['caracteristicas.*.nivelMax'] = ['nullable', 'integer:strict', 'between:1,20'];
        $r['caracteristicas.*.hb'] = ['nullable', 'string', 'max:40'];
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
        $r['caracteristicas.*.acoes.*.tipo'] = ['required', 'string', Rule::in(['condicao', 'hospedar', 'dadoExtra', 'recuperar', 'rolar', 'deslocar', 'gastar', 'socorrer'])];
        // Campos dos tipos novos: o que recupera (PP ou PV), a rolagem, o fator do deslocamento, se gasta 1 uso e qual efeito dá a vantagem
        $r['caracteristicas.*.acoes.*.recurso'] = ['nullable', 'string', Rule::in(['pp', 'pv'])];
        $r['caracteristicas.*.acoes.*.rolagem'] = ['nullable', 'string', 'max:60'];
        $r['caracteristicas.*.acoes.*.fator'] = ['nullable', 'integer:strict', 'between:1,4'];
        $r['caracteristicas.*.acoes.*.usa'] = ['nullable', 'boolean'];
        $r['caracteristicas.*.acoes.*.passo'] = ['nullable', 'string', Rule::in(['corpo', 'distancia', 'desarmado', 'tecnica'])];
        $r['caracteristicas.*.acoes.*.soCondicoes'] = ['nullable', 'boolean'];
        $r['caracteristicas.*.acoes.*.vantagemAlvo'] = ['nullable', 'string', 'max:30'];
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
        $r['tecnicas.lista.*.armaCortante'] = ['boolean:strict'];
        $r['akuma.lista.*.armaCortante'] = ['boolean:strict'];
        // Quem criou a técnica: o assistente de criação marca `especie` para refazer o passo sem duplicar.
        $r['tecnicas.lista.*.builder'] = ['nullable', 'string', Rule::in(['especie', 'estilo', 'maestria', 'treinamento', 'criador', 'akuma'])];

        // Como a Técnica acerta: ataque, Salvaguarda da área ou automática (e a Salvaguarda do efeito, se houver).
        foreach (['tecnicas.lista.*', 'akuma.lista.*'] as $base) {
            $r["{$base}.teste"] = ['nullable', 'array'];
            $r["{$base}.teste.tipo"] = ['required_with:'.$base.'.teste', 'string', Rule::in(['ataque', 'salvaguarda', 'automatico'])];
            $r["{$base}.teste.atributo"] = ['nullable', 'string', Rule::in(self::ATRIBUTOS)];
            $r["{$base}.teste.desvantagem"] = ['nullable', 'boolean:strict'];
            $r["{$base}.teste.aoPassar"] = ['nullable', 'string', Rule::in(['metade', 'nada'])];
            $r["{$base}.teste.secundaria"] = ['nullable', 'array'];
            $r["{$base}.teste.secundaria.atributo"] = ['required_with:'.$base.'.teste.secundaria', 'string', Rule::in(self::ATRIBUTOS)];
            $r["{$base}.teste.secundaria.desvantagem"] = ['nullable', 'boolean:strict'];
            $r["{$base}.teste.secundaria.efeito"] = ['required_with:'.$base.'.teste.secundaria', 'string', 'max:200'];
            foreach (["{$base}.teste.aplica", "{$base}.teste.secundaria.aplica"] as $aplica) {
                $r[$aplica] = ['nullable', 'array'];
                $r["{$aplica}.condicao"] = ['required_with:'.$aplica, 'string', 'max:40'];
                $r["{$aplica}.turnos"] = ['nullable', 'integer:strict', 'between:1,99'];
                $r["{$aplica}.aoDano"] = ['nullable', 'boolean:strict'];
            }
        }

        // Técnica que dura vários turnos (Quick Draw): rodadas, concentração e os efeitos que o jogador escolhe no acerto.
        foreach (['tecnicas.lista.*', 'akuma.lista.*'] as $base) {
            $r["{$base}.duracao"] = ['nullable', 'array'];
            $r["{$base}.duracao.rodadas"] = ['required_with:'.$base.'.duracao', 'integer:strict', 'between:1,99'];
            $r["{$base}.duracao.concentracao"] = ['nullable', 'boolean:strict'];
            $r["{$base}.duracao.opcoes"] = ['nullable', 'array', 'max:6'];
            $r["{$base}.duracao.opcoes.*.id"] = ['required', 'string', 'max:30'];
            $r["{$base}.duracao.opcoes.*.rotulo"] = ['required', 'string', 'max:120'];
            $r["{$base}.duracao.opcoes.*.efeito"] = ['required', 'array'];
            $r["{$base}.duracao.opcoes.*.efeito.tipo"] = ['required', 'string', Rule::in(['movimento_zero', 'dano', 'sem_acao'])];
            $r["{$base}.duracao.opcoes.*.efeito.expressao"] = ['nullable', 'string', 'max:100'];
            $r["{$base}.duracao.opcoes.*.efeito.tipoDano"] = ['nullable', 'string', 'max:30'];
        }

        // Reação (usada fora do turno, ex.: ao ser atacado): gatilho, a quem serve, bônus na defesa e cura.
        foreach (['tecnicas.lista.*', 'akuma.lista.*', 'caracteristicas.*'] as $base) {
            $r["{$base}.reacao.gatilho"] = ['nullable', 'string', Rule::in(['ataque_declarado'])];
            $r["{$base}.reacao.alcance"] = ['nullable', 'string', Rule::in(['si', 'aliado', 'ambos'])];
            $r["{$base}.reacao.defesa"] = ['nullable', function (string $atributo, mixed $v, \Closure $fail) {
                if (! (is_int($v) && $v >= -20 && $v <= 20) && ! (is_string($v) && Formula::sintaxeValida($v))) {
                    $fail('A defesa da reação é um número de -20 a 20 ou uma fórmula válida.');
                }
            }];
            $r["{$base}.reacao.categoria"] = ['nullable', 'string', Rule::in(self::CATEGORIAS_DE_ACAO)];
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
        $r['akuma.lista.*.builder'] = ['nullable', 'string', Rule::in(['especie', 'criador', 'akuma'])];
        $r['akuma.usuario'] = ['string', Rule::in(['simples', 'avancado'])];
        $r['akuma.categoria'] = ['string', Rule::in(['', 's', 'a', 'b', 'c'])];
        $r['akuma.propriedades'] = ['array', 'max:6'];
        $r['akuma.propriedades.*'] = ['string', Rule::in(['corporal', 'criacao', 'espaco-temporal', 'extracorporal', 'manipulacao', 'transformacao'])];
        $r['akuma.zoan'] = ['string', Rule::in(['', 'comum', 'ancestral', 'mitica'])];
        $r['akuma.predador'] = ['boolean:strict'];
        $r['akuma.despertar'] = ['string', Rule::in(['', 'aprimorador', 'transmutador', 'holista'])];
        $r['akuma.aspecto'] = ['string', Rule::in(['padrao', 'uso-alternativo', 'mp'])];
        $r['akuma.mpEspeciais'] = ['array', 'max:9'];
        $r['akuma.mpEspeciais.*'] = ['string', 'max:40'];
        foreach (['comuns', 'especificos', 'ancestrais'] as $grupo) {
            $r["akuma.tracos.{$grupo}"] = ['array', 'max:12'];
            $r["akuma.tracos.{$grupo}.*"] = ['string', 'max:40'];
        }
        $r['akuma.points'] = ['array', 'max:8'];
        $r['akuma.points.*.ponto'] = ['required', ...$inteiro(1, 5)];
        $r['akuma.points.*.modelo'] = ['required', 'string', 'max:30'];
        $r['akuma.points.*.genialidade'] = ['nullable', ...$inteiro(1, 7)];

        // Escolhas do Criador de Técnicas: o servidor refaz o custo e os limites a partir delas (`Criador::conferir`).
        foreach (['tecnicas.lista.*.criador', 'akuma.lista.*.criador'] as $c) {
            $r[$c] = ['nullable', 'array'];
            $r["{$c}.tipo"] = ['required_with:'.$c, 'string', Rule::in(['combate', 'auxiliar', 'mp'])];
            $r["{$c}.grau"] = ['required_with:'.$c, ...$inteiro(0, 7)];
            $r["{$c}.forma"] = ['required_with:'.$c, 'string', Rule::in(['base', 'aperfeicoada', 'alternativa'])];
            $r["{$c}.grauOriginal"] = ['nullable', ...$inteiro(1, 7)];
            $r["{$c}.origem.tipo"] = ['required_with:'.$c, 'string', Rule::in(['nivel', 'genialidade', 'point', 'aspecto'])];
            $r["{$c}.origem.ponto"] = ['nullable', ...$inteiro(1, 5)];
            $r["{$c}.origem.genialidade"] = ['nullable', ...$inteiro(1, 7)];
            $r["{$c}.origem.indice"] = ['nullable', ...$inteiro(1, 7)];
            $r["{$c}.alvo"] = ['required_with:'.$c, 'string', Rule::in(['unico', 'area'])];
            $r["{$c}.modoDoDano"] = ['required_with:'.$c, 'string', Rule::in(['ataque', 'salvaguarda_metade', 'salvaguarda_nada'])];
            $r["{$c}.dados"] = ['required_with:'.$c, ...$inteiro(0, 14)];
            $r["{$c}.intensificado"] = ['boolean:strict'];
            $r["{$c}.formaDeAlcance"] = ['required_with:'.$c, 'string', Rule::in(['pessoal', 'toque', 'linha', 'esfera', 'cone'])];
            $r["{$c}.alcance"] = ['required_with:'.$c, 'numeric', 'min:0', 'max:100'];
            $r["{$c}.acao"] = ['required_with:'.$c, 'string', Rule::in(['poderosa', 'bonus', 'reacao'])];
            $r["{$c}.ataque"] = ['boolean:strict'];
            $r["{$c}.salvaguarda"] = ['boolean:strict'];
            $r["{$c}.tipoDano"] = ['nullable', 'string', 'max:30'];
            $r["{$c}.ativacao"] = ['nullable', 'string', Rule::in(['passiva', 'inacao', 'bonus', 'reacao', 'poderosa'])];
            $r["{$c}.efeitos"] = ['array', 'max:30'];
            $r["{$c}.efeitos.*.id"] = ['required', 'string', 'max:40'];
            $r["{$c}.efeitos.*.params"] = ['nullable', 'array'];
            $r["{$c}.efeitos.*.params.*"] = ['nullable', function (string $atributo, mixed $v, \Closure $fail) {
                if (! is_int($v) && ! is_float($v) && ! is_bool($v) && ! (is_string($v) && mb_strlen($v) <= 20)) {
                    $fail('Parâmetro de efeito inválido.');
                }
            }];
            $r["{$c}.efeitos.*.prolongada"] = ['boolean:strict'];
            $r["{$c}.efeitos.*.minutos"] = ['nullable', ...$inteiro(1, 10)];
            $r["{$c}.efeitos.*.condicoes"] = ['nullable', 'array', 'max:3'];
            $r["{$c}.efeitos.*.condicoes.*"] = ['string', 'max:30'];
            $r["{$c}.efeitos.*.condicaoProlongada"] = ['nullable', 'string', 'max:30'];
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
            // Munição criada à mão: serve a qualquer arma por munição e dá o dado e o tipo do dano
            'dados.municao' => ['array'],
            'dados.municao.dano' => ['required_with:dados.municao', 'string', 'regex:/^(?:[1-9]|[1-4]\d|50)(?:d(?:[2-9]|[1-9]\d{1,2}))?$/'],
            'dados.municao.tipoDano' => ['nullable', 'string', 'max:30'],
            'dados.municao.nota' => ['nullable', 'string', 'max:300'],
            // Arma por munição (pistola, arco...) não tem dado: ele vem da munição escolhida ao atacar
            'dados.arma.municao' => ['boolean:strict'],
            'dados.arma.dano' => ['exclude_if:dados.arma.municao,true', 'required_with:dados.arma.atributo', 'string', 'regex:/^(?:[1-9]|[1-4]\d|50)d(?:[2-9]|[1-9]\d{1,2})$/', function (string $atributo, mixed $v, \Closure $fail) {
                // A forja da arma (Meito só em cortantes, Kokuto/Yoto só em Meito, Balanço exige Densidade...) é conferida junto do dano.
                $forja = request()->input('dados.arma.forja');
                if (is_array($forja)) {
                    foreach (Forja::problemas($forja, str_contains(\App\Nucleo\Combate\Dano::normalizar((string) request()->input('dados.arma.tipoDano')), 'cortante')) as $p) {
                        $fail($p);
                    }
                }
            }],
            'dados.arma.atributo' => ['required_with:dados.arma.dano,dados.arma.municao', 'string', Rule::in([...self::ATRIBUTOS, 'acuidade'])],
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
            // Alcance (m) é OBRIGATÓRIO em toda arma: à distância, normal e máximo; corpo a corpo, o alcance da arma nos dois
            'dados.arma.alcanceNormal' => ['required_with:dados.arma.dano,dados.arma.municao', 'numeric', 'between:0.5,1000'],
            'dados.arma.alcanceMaximo' => ['required_with:dados.arma.dano,dados.arma.municao', 'numeric', 'between:0.5,1000', 'gte:dados.arma.alcanceNormal'],
            'dados.arma.tamanho' => ['nullable', 'string', Rule::in(['padrao', 'gigante'])],
            'dados.arma.margemCritica' => ['integer:strict', 'between:10,20'], // d20 puro igual ou maior é crítico (padrão 20)
            // Forja da arma (Meito, Kokuto, Yoto, Expertise e melhorias de Pontos de Forja); o conteúdo é conferido por `Forja::problemas`.
            'dados.arma.forja.meito' => ['nullable', 'string', Rule::in(Forja::ids('meito'))],
            'dados.arma.forja.kokuto' => ['boolean:strict'],
            'dados.arma.forja.yoto' => ['nullable', 'string', Rule::in(Forja::ids('yoto'))],
            'dados.arma.forja.expertise' => ['array', 'max:2'],
            'dados.arma.forja.expertise.*' => ['string', Rule::in(Forja::ids('expertises'))],
            'dados.arma.forja.densidade' => ['nullable', 'string', Rule::in(Forja::catalogo()['tiposFisicos'])],
            'dados.arma.forja.dureza' => ['boolean:strict'],
            'dados.arma.forja.balanco' => ['boolean:strict'],
            'dados.arma.forja.fio' => ['integer:strict', 'between:0,'.Forja::catalogo()['maxFio']],
            // De onde o item veio no catálogo (`itens/` do sistema): a loja e a conferência de preço usam este id.
            'dados.catalogo.id' => ['nullable', 'string', 'max:60'],
        ];
    }
}
