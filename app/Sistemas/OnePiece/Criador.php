<?php

namespace App\Sistemas\OnePiece;

use Illuminate\Validation\ValidationException;

/**
 * Criador de Técnicas (cap. 6 e cap. 10) no servidor: refaz o custo em PP e os limites de grau/nível das técnicas criadas
 * pelo jogador. Espelho de `criador/regras.ts` (o catálogo vem de `dados/criador.json`, gerado do TS e conferido por teste).
 * As técnicas criadas carregam as escolhas em `criador`; o servidor recalcula tudo a partir delas.
 */
class Criador
{
    /** @var array<string, mixed>|null */
    private static ?array $catalogo = null;

    /** @return array<string, mixed> */
    public static function catalogo(): array
    {
        return self::$catalogo ??= json_decode(file_get_contents(__DIR__.'/dados/criador.json'), true);
    }

    /** @return array<string, mixed>|null */
    public static function efeito(string $id): ?array
    {
        foreach (self::catalogo()['efeitos'] as $e) {
            if ($e['id'] === $id) {
                return $e;
            }
        }

        return null;
    }

    /** @return array<string, mixed>|null */
    public static function grau(int $grau): ?array
    {
        foreach (self::catalogo()['graus'] as $g) {
            if ($g['grau'] === $grau) {
                return $g;
            }
        }

        return null;
    }

    private static function num(mixed $v, int|float $padrao = 0): int|float
    {
        return (is_int($v) || is_float($v)) ? $v : $padrao;
    }

    /** @param array<string, mixed> $ef */
    private static function custoDeCondicoes(array $ef): int
    {
        $soma = 0;
        foreach ((array) ($ef['condicoes'] ?? []) as $id) {
            foreach (self::catalogo()['condicoes'] as $c) {
                if ($c['id'] === $id) {
                    $soma += $c['custo'];
                }
            }
        }

        return $soma;
    }

    /** @param array<string, mixed> $ef */
    private static function prolongadaDe(array $ef, int $primeiro): int
    {
        $minutos = max(1, (int) ($ef['minutos'] ?? 1));

        return $primeiro + ($minutos - 1) * max(1, intdiv($primeiro, 2));
    }

    /** @param array<string, mixed> $e @param array<string, mixed> $ef */
    private static function grauParaCusto(array $e, array $ef): int
    {
        $ref = (int) self::num($ef['params']['grauRef'] ?? null);
        if ($e['tipo'] === 'combate') {
            return $ref > 0 ? $ref : (int) $e['grau'];
        }
        if ($e['tipo'] === 'mp') {
            return (int) self::catalogo()['pontosVirtuais']['grauPadrao'];
        }

        return $ref;
    }

    /**
     * Custo (ou, nas reduções, valor negativo) de um efeito já escolhido.
     *
     * @param  array<string, mixed>  $e
     * @param  array<string, mixed>  $ef
     */
    public static function custoDoEfeito(array $e, array $ef): int
    {
        $def = self::efeito((string) ($ef['id'] ?? ''));
        if ($def === null) {
            return 0;
        }
        $aux = $e['tipo'] === 'auxiliar';
        if ($def['id'] === 'condicao') {
            $base = self::custoDeCondicoes($ef);
            $extra = 0;
            if (! empty($ef['condicaoProlongada'])) {
                foreach (self::catalogo()['condicoes'] as $c) {
                    if ($c['id'] === $ef['condicaoProlongada']) {
                        $extra = intdiv($c['custo'] + 1, 2) + 1;
                    }
                }
            }

            return $base + ($extra > 0 ? self::prolongadaDe($ef, $extra) : 0);
        }
        $usaAux = $aux && array_key_exists('baseAuxiliar', $def);
        $custo = $usaAux ? $def['baseAuxiliar'] : $def['base'];
        $g = self::grauParaCusto($e, $ef);
        if (! $usaAux) {
            $custo += match ($def['grau']) {
                'grau' => $g,
                'meio_cima' => intdiv($g + 1, 2),
                'meio_cima_sem1' => $g <= 1 ? 0 : intdiv($g + 1, 2),
                'meio_baixo' => intdiv($g, 2),
                default => 0,
            };
        }
        if ($def['id'] === 'concentracao') {
            return -(2 + max(0, (int) self::num($ef['params']['minutos'] ?? null, 1) - 1));
        }
        if ($def['id'] === 'dependente') {
            return -min(3, max(1, intdiv((int) self::num($ef['params']['pp'] ?? null), 2)));
        }
        if ($def['id'] === 'colateral') {
            return -(min(4, (int) self::num($ef['params']['geral'] ?? null)) + min(4, intdiv((int) self::num($ef['params']['dano'] ?? null), 5)));
        }
        foreach ($def['params'] ?? [] as $p) {
            $v = $ef['params'][$p['id']] ?? null;
            if ($p['tipo'] === 'num' && isset($p['custoPorUnidade'])) {
                $n = max(0, (int) self::num($v, $p['min'] ?? 0));
                $custo += intdiv($n, $p['divisor'] ?? 1) * $p['custoPorUnidade'];
            } elseif ($p['tipo'] === 'opcao') {
                foreach ($p['opcoes'] ?? [] as $o) {
                    if ((string) $o['id'] === (string) ($v ?? '')) {
                        $custo += $o['custo'];
                    }
                }
            } elseif ($p['tipo'] === 'marca' && $v === true) {
                $custo += $p['custo'] ?? 0;
            }
        }
        if (! empty($ef['prolongada']) && $def['prolongada'] !== null && $def['id'] !== 'condicao-area') {
            $custo += self::prolongadaDe($ef, (int) $def['prolongada']);
        }

        return (int) $custo;
    }

    public static function custoDoTipoDeDano(string $tipo, int $grau): int
    {
        $t = mb_strtolower(trim(strtr($tipo, ['á' => 'a', 'à' => 'a', 'ã' => 'a', 'â' => 'a', 'é' => 'e', 'ê' => 'e', 'í' => 'i', 'ó' => 'o', 'ô' => 'o', 'õ' => 'o', 'ú' => 'u', 'ç' => 'c', 'Á' => 'a', 'É' => 'e', 'Í' => 'i', 'Ó' => 'o', 'Ú' => 'u', 'Ç' => 'c'])));
        $regra = self::catalogo()['custoTipoDeDano'][$t] ?? 'zero';

        return match ($regra) {
            'um' => 1,
            'meio_ate2' => min(2, max(1, intdiv($grau, 2))),
            'verdadeiro' => max(3, intdiv($grau, 2)),
            default => 0,
        };
    }

    /**
     * @param  array<string, mixed>  $e
     * @param  array{regraDoTipoDeDano?: bool}  $opcoes
     * @return array{dano: int, tipoDeDano: int, efeitos: list<array<string, mixed>>, modificacao: int, reducao: int, bruto: int, total: int}
     */
    public static function custoDaTecnica(array $e, array $opcoes = []): array
    {
        $efeitos = [];
        $reducao = 0;
        $soma = 0;
        foreach ((array) ($e['efeitos'] ?? []) as $ef) {
            $def = self::efeito((string) ($ef['id'] ?? ''));
            if ($def === null) {
                continue;
            }
            $c = self::custoDoEfeito($e, $ef);
            if ($def['id'] === 'condicao-area' && ! empty($ef['prolongada'])) {
                $cond = null;
                foreach ($e['efeitos'] as $x) {
                    if (($x['id'] ?? '') === 'condicao') {
                        $cond = $x;
                    }
                }
                $c += self::prolongadaDe($ef, ($cond ? self::custoDeCondicoes($cond) : $c) + 1);
            }
            $efeitos[] = ['id' => $ef['id'], 'nome' => $def['nome'], 'custo' => $c];
            if ($def['grupo'] === 'reducao') {
                $reducao += -$c;
            } else {
                $soma += $c;
            }
        }
        if ($e['tipo'] === 'mp') {
            $total = max(0, $soma);

            return ['dano' => 0, 'tipoDeDano' => 0, 'efeitos' => $efeitos, 'modificacao' => 0, 'reducao' => $reducao, 'bruto' => $total, 'total' => $total];
        }
        $dano = $e['tipo'] === 'combate' ? max(0, (int) floor((float) ($e['dados'] ?? 0))) : 0;
        $tipoDeDano = ! empty($opcoes['regraDoTipoDeDano']) && $e['tipo'] === 'combate' ? self::custoDoTipoDeDano((string) ($e['tipoDano'] ?? ''), (int) $e['grau']) : 0;
        $forma = $e['forma'] ?? 'base';
        $modificacao = $e['tipo'] !== 'combate' ? 0 : (in_array($forma, ['aperfeicoada', 'alternativa'], true) ? intdiv((int) $e['grau'], 2) : 0);
        $bruto = $dano + $tipoDeDano + $soma + $modificacao;

        return ['dano' => $dano, 'tipoDeDano' => $tipoDeDano, 'efeitos' => $efeitos, 'modificacao' => $modificacao, 'reducao' => $reducao, 'bruto' => $bruto, 'total' => max(1, $bruto - $reducao)];
    }

    /**
     * @param  array<string, mixed>  $e
     * @return array{pp: int, dados: int, esfera: float, cone: float, linha: float, reducao: int}
     */
    public static function limites(array $e, bool $desperta = false): array
    {
        $a = self::catalogo()['auxiliar'];
        if ($e['tipo'] !== 'combate') {
            $d = $e['tipo'] === 'auxiliar' && $desperta;

            return [
                'pp' => $d ? $a['ppDesperta'] : $a['pp'], 'dados' => 0,
                'esfera' => $d ? $a['esferaDesperta'] : $a['esfera'], 'cone' => $d ? $a['coneDesperta'] : $a['cone'],
                'linha' => $d ? $a['linhaDesperta'] : $a['linha'], 'reducao' => $a['reducaoMax'],
            ];
        }
        $g = self::grau((int) $e['grau']);

        return ['pp' => $g['pp'] ?? 0, 'dados' => $g['dados'] ?? 0, 'esfera' => $g['esfera'] ?? 0, 'cone' => $g['cone'] ?? 0, 'linha' => $g['linha'] ?? 0, 'reducao' => 2 * (int) $e['grau']];
    }

    /**
     * Espaços de Técnicas por nível e tipo de usuário (6.11).
     *
     * @param  array{nivel: int, usuario: string, despertado: bool}  $u
     * @return array{combate: array<int, int>, graus: list<int>, auxiliares: int, auxiliaresDespertas: int, manifestacoes: int}
     */
    public static function espacos(array $u): array
    {
        $zoan = (string) ($u['zoan'] ?? '');
        $desp = ! empty($u['despertado']) ? '-desperto' : '';
        $chave = in_array($zoan, ['comum', 'ancestral'], true)
            ? 'zoan-comum'
            : ($zoan === 'mitica' ? 'mitica'.$desp : (($u['usuario'] ?? '') === 'avancado' ? 'avancado' : 'simples').$desp);
        $plano = self::catalogo()['planos'][$chave];
        $combate = [];
        foreach ($plano['graus'] as $g => $nivel) {
            if ($u['nivel'] >= $nivel) {
                $combate[(int) $g] = 1;
            }
        }
        $auxs = array_values(array_filter($plano['auxiliares'], fn ($n) => $u['nivel'] >= $n));

        return [
            'combate' => $combate,
            'graus' => array_keys($combate),
            'auxiliares' => count(array_filter($auxs, fn ($n) => $n < 16)),
            'auxiliaresDespertas' => count(array_filter($auxs, fn ($n) => $n >= 16)),
            'manifestacoes' => $plano['manifestacoes'],
        ];
    }

    /**
     * Pontos virtuais de uma MP (6.9).
     *
     * @param  array<string, mixed>  $e
     * @return array{disponivel: int, limite: int}
     */
    public static function pontosVirtuais(array $e, int $reducao): array
    {
        $pv = self::catalogo()['pontosVirtuais'];
        $ajuste = 0;
        foreach ($pv['ativacao'] as $a) {
            if ($a['id'] === ($e['ativacao'] ?? null)) {
                $ajuste = $a['ajuste'];
            }
        }

        return ['disponivel' => $pv['base'] + $ajuste + $reducao, 'limite' => $pv['limiteDosEfeitos']];
    }

    /**
     * Tudo que impede a Técnica (grau acima do nível, PP/dano/alcance acima do grau, redução demais, exigências dos efeitos).
     *
     * @param  array<string, mixed>  $e
     * @param  array{nivel: int, usuario: string, despertado: bool, genialidades?: int, opcoes?: array<string, mixed>, akuma?: string, destino: string}  $ctx
     * @return list<string>
     */
    public static function problemas(array $e, array $ctx): array
    {
        $p = [];
        $custo = self::custoDaTecnica($e, $ctx['opcoes'] ?? []);
        $ids = array_map(fn ($x) => $x['id'] ?? '', (array) ($e['efeitos'] ?? []));
        if (count(array_unique($ids)) !== count($ids)) {
            $p[] = 'Um efeito só pode ser escolhido uma vez.';
        }
        $zoan = $ctx['destino'] === 'akuma' && ($ctx['akuma'] ?? '') === 'zoan';
        if ($zoan && ($ctx['zoan'] ?? '') === '') {
            $p[] = 'Escolha se a Zoan é Comum, Ancestral ou Mítica.';
        }
        $origemTipo = $e['origem']['tipo'] ?? '';
        if ($zoan && ($ctx['zoan'] ?? '') !== 'mitica' && $origemTipo !== 'point') {
            $p[] = 'Usuários de Zoan Comum e Ancestral recebem Técnicas apenas pelos Points.';
        }
        if ($origemTipo === 'point') {
            array_push($p, ...self::problemasDoPoint($e, $ctx, $zoan));
        }
        if ($origemTipo === 'aspecto') {
            if ($ctx['destino'] !== 'akuma' || ($ctx['akuma'] ?? '') !== 'logia' || $e['tipo'] !== 'auxiliar') {
                $p[] = 'O Corpo Elemental dá uma Técnica Auxiliar só aos usuários de Logia.';
            } elseif (count((array) ($e['efeitos'] ?? [])) === 0 || array_filter((array) $e['efeitos'], fn ($x) => ($x['id'] ?? '') !== 'power-up')) {
                $p[] = 'A Técnica do Corpo Elemental é composta exclusivamente pelo efeito "Power Up".';
            }
        }
        if ($ctx['destino'] === 'akuma' && ($ctx['akuma'] ?? '') === '') {
            $p[] = 'Escolha o tipo da Akuma no Mi.';
        }
        foreach ($ids as $id) {
            if (self::efeito((string) $id) === null) {
                $p[] = 'Efeito desconhecido.';
            }
        }
        if ($e['tipo'] === 'combate') {
            array_push($p, ...self::problemasDoGrau($e, $ctx));
        } elseif ($e['tipo'] === 'auxiliar') {
            array_push($p, ...self::problemasDaAuxiliar($e, $ctx));
        } elseif ($e['tipo'] === 'mp') {
            if ($ctx['destino'] !== 'akuma') {
                $p[] = 'Manifestações de Poder são da Akuma no Mi.';
            }
            if (! in_array($origemTipo, ['nivel', 'point'], true)) {
                $p[] = 'Manifestações de Poder não vêm do treinamento Genialidade Inusitada.';
            }
        } else {
            $p[] = 'Tipo de Técnica desconhecido.';

            return $p;
        }
        foreach ((array) ($e['efeitos'] ?? []) as $ef) {
            $def = self::efeito((string) ($ef['id'] ?? ''));
            if ($def !== null) {
                array_push($p, ...self::exigencias($e, $ef, $def));
            }
        }
        if ($e['tipo'] === 'mp') {
            $pv = self::pontosVirtuais($e, $custo['reducao']);
            $ativacoes = array_column(self::catalogo()['pontosVirtuais']['ativacao'], 'id');
            $traco = $origemTipo === 'point';
            if (! $traco && ! in_array($e['ativacao'] ?? null, $ativacoes, true)) {
                $p[] = 'Escolha o requisito de ativação da Manifestação de Poder.';
            }
            if ($traco) {
                $maxPoint = self::linhaDoPoint((int) ($e['origem']['ponto'] ?? 0))['tracos'] ?? 0;
                if ($custo['total'] > $maxPoint) {
                    $p[] = "O Traço Realçado do {$e['origem']['ponto']}º Point custa no máximo {$maxPoint} Pontos Virtuais.";
                }
                if ($maxPoint === 0) {
                    $p[] = 'O 1º Point não tem Traço Realçado.';
                }
            }
            if (count((array) ($e['efeitos'] ?? [])) === 0) {
                $p[] = 'Escolha ao menos um efeito.';
            }
            if ($custo['total'] > $pv['limite']) {
                $p[] = "A soma dos efeitos ({$custo['total']}) passa de {$pv['limite']} Pontos Virtuais.";
            }
            if (! $traco && $custo['total'] > $pv['disponivel']) {
                $p[] = "A soma dos efeitos ({$custo['total']}) passa dos {$pv['disponivel']} Pontos Virtuais disponíveis.";
            }

            return $p;
        }
        $lim = self::limites($e, $e['tipo'] === 'auxiliar' && ! empty($ctx['despertado']) && $ctx['nivel'] >= 16);
        $dados = (int) ($e['dados'] ?? 0);
        if ($dados < 0 || $dados > $lim['dados']) {
            $p[] = $e['tipo'] === 'auxiliar' ? 'Técnicas Auxiliares não causam dano diretamente.' : "No máximo {$lim['dados']} dados de dano (o dobro do grau).";
        }
        $semDano = array_intersect($ids, self::catalogo()['efeitosSemDano']);
        if ($semDano && $dados > 0) {
            $p[] = 'Esta Técnica não pode causar dano direto.';
        }
        if ($custo['reducao'] > $lim['reducao']) {
            $p[] = "A redução de custo passa do máximo de {$lim['reducao']} PP.";
        }
        if ($custo['total'] > $lim['pp']) {
            $p[] = "O custo ({$custo['total']} PP) passa do máximo de {$lim['pp']} PP.";
        }
        array_push($p, ...self::problemasDoAlcance($e, $lim));
        if (empty($e['ataque']) && empty($e['salvaguarda']) && $e['tipo'] === 'combate' && $dados > 0) {
            $p[] = 'Dano exige jogada de ataque (Técnicas) ou Salvaguarda.';
        }
        if (($e['acao'] ?? '') !== 'poderosa' && $e['tipo'] === 'combate') {
            $ok = false;
            foreach ($ids as $id) {
                $def = self::efeito((string) $id);
                $ok = $ok || ($def && in_array($e['acao'] ?? '', $def['acao'] ?? [], true));
            }
            if (! $ok) {
                $p[] = 'Técnicas de Combate exigem Ação Poderosa (ou o efeito Técnica Rápida).';
            }
        }
        if ($e['tipo'] === 'auxiliar' && ($e['acao'] ?? '') === 'poderosa' && ! in_array('demorada', $ids, true)) {
            $p[] = 'Técnicas Auxiliares exigem Ação Bônus ou Reação (ou o efeito Técnica Demorada).';
        }

        return $p;
    }

    /** @return array{ponto: int, nivel: int, tracos: int, tecnica: int}|null */
    public static function linhaDoPoint(int $ponto): ?array
    {
        foreach (self::catalogo()['criacaoDePoints'] as $l) {
            if ($l['ponto'] === $ponto) {
                return $l;
            }
        }

        return null;
    }

    /** @return list<string> */
    private static function problemasDoPoint(array $e, array $ctx, bool $zoan): array
    {
        $ponto = (int) ($e['origem']['ponto'] ?? 0);
        if (! $zoan || self::linhaDoPoint($ponto) === null) {
            return ['Points são da Akuma no Mi Zoan.'];
        }
        $p = [];
        $custom = array_filter((array) ($ctx['points'] ?? []), fn ($x) => ($x['ponto'] ?? 0) === $ponto && ($x['modelo'] ?? '') === 'custom');
        if (! $custom) {
            $p[] = "Crie o {$ponto}º Point (modelo próprio) na seção Points antes.";
        }
        if ($e['tipo'] === 'combate' && (int) $e['grau'] !== $ponto) {
            $p[] = "A Técnica do {$ponto}º Point é de {$ponto}º grau.";
        }
        if ($e['tipo'] === 'combate' && ($e['forma'] ?? 'base') !== 'base') {
            $p[] = 'Formas Aperfeiçoada/Alternativa não valem dentro de um Point.';
        }

        return $p;
    }

    /** @return list<string> */
    private static function problemasDoGrau(array $e, array $ctx): array
    {
        $p = [];
        $g = self::grau((int) ($e['grau'] ?? 0));
        if ($g === null) {
            return ['Escolha um grau de 1 a 7.'];
        }
        $forma = $e['forma'] ?? 'base';
        if ($forma === 'aperfeicoada') {
            $o = (int) ($e['grauOriginal'] ?? 0);
            $m = self::catalogo()['modificacoes'];
            if (self::grau($o) === null || $e['grau'] < $o + 1 || $e['grau'] > $o + $m['aperfeicoadaGrausAcima'] || $e['grau'] > $m['aperfeicoadaGrauMax']) {
                $p[] = 'A Forma Aperfeiçoada tem de 1 a 2 graus acima da original (máximo 5º grau).';
            }
        }
        if (($e['origem']['tipo'] ?? '') === 'genialidade') {
            $indice = $e['origem']['indice'] ?? null;
            if (! is_int($indice) || $indice < 1 || $indice > ($ctx['genialidades'] ?? 0)) {
                $p[] = 'Esta Genialidade Inusitada não foi aprendida.';
            } elseif ($e['grau'] !== $indice) {
                $p[] = "A Genialidade Inusitada nº {$indice} cria uma Técnica de {$indice}º grau.";
            }
            if ($ctx['destino'] === 'akuma' && $ctx['usuario'] !== 'avancado') {
                $p[] = 'Usuário simples não aprende novas Técnicas de Akuma no Mi com a Genialidade Inusitada.';
            }
        } elseif (($e['origem']['tipo'] ?? '') !== 'point') {
            if ($ctx['destino'] !== 'akuma') {
                $p[] = 'Técnicas de estilo só são criadas com a Genialidade Inusitada.';
            }
            if ($forma === 'base' && ! in_array((int) $e['grau'], self::espacos($ctx)['graus'], true)) {
                $exige = $g['exige'] === 'avancado' ? ' e usuário avançado' : ($g['exige'] === 'desperto' ? ' e estágio desperto' : '');
                $p[] = "Ainda não dá para criar uma Técnica de {$e['grau']}º grau: nível {$g['nivel']}{$exige}.";
            }
        }
        if ($g['exige'] === 'desperto' && empty($ctx['despertado']) && $ctx['destino'] === 'akuma') {
            $p[] = 'Técnicas de 6º e 7º grau exigem o estágio Desperto.';
        }
        if ($ctx['nivel'] < $g['nivel'] && $forma !== 'aperfeicoada') {
            $p[] = "Técnica de {$e['grau']}º grau exige o nível {$g['nivel']}.";
        }

        return $p;
    }

    /** @return list<string> */
    private static function problemasDaAuxiliar(array $e, array $ctx): array
    {
        if (in_array($e['origem']['tipo'] ?? '', ['point', 'aspecto'], true)) {
            return [];
        }
        if (($e['origem']['tipo'] ?? '') === 'genialidade') {
            return ['A Genialidade Inusitada cria apenas Técnicas de Combate.'];
        }
        $p = [];
        if ($ctx['destino'] !== 'akuma') {
            $p[] = 'Técnicas de estilo só são criadas com a Genialidade Inusitada.';
        }
        $esp = self::espacos($ctx);
        if ($esp['auxiliares'] + $esp['auxiliaresDespertas'] < 1) {
            $p[] = 'Você ainda não recebeu uma Técnica Auxiliar (níveis 1, 6 e 12; desperta: 16 e 20).';
        }

        return $p;
    }

    /** @return list<string> */
    private static function problemasDoAlcance(array $e, array $lim): array
    {
        $p = [];
        $extra = function (string $id, string $param) use ($e): int|float {
            foreach ((array) ($e['efeitos'] ?? []) as $x) {
                if (($x['id'] ?? '') === $id) {
                    return self::num($x['params'][$param] ?? null);
                }
            }

            return 0;
        };
        $forma = $e['formaDeAlcance'] ?? '';
        $alcance = self::num($e['alcance'] ?? 0);
        $maxEsfera = $lim['esfera'] + ($forma === 'esfera' ? $extra('area', 'metros') : 0);
        $maxCone = $lim['cone'] + ($forma === 'cone' ? $extra('area', 'metros') : 0);
        $maxLinha = $lim['linha'] + ($forma === 'linha' ? $extra('area', 'metros') + $extra('alcance', 'metros') : 0);
        if ($forma === 'esfera' && $alcance > $maxEsfera) {
            $p[] = "Esfera/Cilindro/Emanação: no máximo {$maxEsfera} m de raio.";
        }
        if ($forma === 'cone' && $alcance > $maxCone) {
            $p[] = "Cone: no máximo {$maxCone} m.";
        }
        if ($forma === 'linha' && $alcance > $maxLinha) {
            $p[] = "Linha: no máximo {$maxLinha} m.";
        }

        return $p;
    }

    /** @return list<string> */
    private static function exigencias(array $e, array $ef, array $def): array
    {
        $p = [];
        $aux = $e['tipo'] === 'auxiliar';
        $nome = $def['nome'];
        $ids = array_map(fn ($x) => $x['id'] ?? '', (array) ($e['efeitos'] ?? []));
        if (($def['apenas'] ?? '') === 'combate' && $e['tipo'] !== 'combate') {
            $p[] = "{$nome}: só em Técnicas de Combate.";
        }
        if (($def['apenas'] ?? '') === 'auxiliar' && ! $aux) {
            $p[] = "{$nome}: só em Técnicas Auxiliares.";
        }
        if ($e['tipo'] === 'mp' && ! $def['mp']) {
            $p[] = "{$nome}: não pode ser usado em Manifestações de Poder.";
        }
        if (isset($def['grauMax']) && ($e['tipo'] !== 'combate' || $e['grau'] > $def['grauMax'])) {
            $p[] = "{$nome}: só em Técnicas de {$def['grauMax']}º grau ou menor.";
        }
        if (isset($def['grauMin']) && $e['tipo'] === 'combate' && $e['grau'] < $def['grauMin']) {
            $p[] = "{$nome}: não pode ser Técnica de 1º grau.";
        }
        if (isset($def['acao']) && $e['tipo'] !== 'mp' && ! in_array($e['acao'] ?? '', $def['acao'], true)) {
            $p[] = "{$nome}: exige a ação indicada pelo efeito.";
        }
        foreach ($def['requer'] ?? [] as $r) {
            $falta = ($r === 'ataque' && empty($e['ataque']))
                || ($r === 'area' && ($e['alvo'] ?? '') !== 'area')
                || ($r === 'linha' && ($e['formaDeAlcance'] ?? '') !== 'linha')
                || ($r === 'salvaguarda' && empty($e['salvaguarda']))
                || ($r === 'dano' && $e['tipo'] === 'combate' && ($e['dados'] ?? 0) <= 0);
            if ($falta && $e['tipo'] !== 'mp') {
                $p[] = "{$nome}: {$def['exigencia']}";
                break;
            }
        }
        foreach ($def['naoCom'] ?? [] as $outro) {
            if (in_array($outro, $ids, true)) {
                $p[] = "{$nome}: não combina com \"".(self::efeito($outro)['nome'] ?? $outro).'".';
            }
        }
        if ($def['id'] === 'condicao') {
            $n = count((array) ($ef['condicoes'] ?? []));
            if ($n < 1 || $n > self::catalogo()['maxCondicoes']) {
                $p[] = "{$nome}: escolha de 1 a ".self::catalogo()['maxCondicoes'].' condições.';
            }
            $conhecidas = array_column(self::catalogo()['condicoes'], 'id');
            foreach ((array) ($ef['condicoes'] ?? []) as $c) {
                if (! in_array($c, $conhecidas, true)) {
                    $p[] = "{$nome}: condição desconhecida.";
                }
            }
            if (! empty($ef['condicaoProlongada']) && ! in_array($ef['condicaoProlongada'], (array) ($ef['condicoes'] ?? []), true)) {
                $p[] = "{$nome}: a condição prolongada precisa estar entre as escolhidas.";
            }
        }
        foreach ($def['params'] ?? [] as $pr) {
            $v = $ef['params'][$pr['id']] ?? null;
            if ($pr['tipo'] === 'num' && isset($pr['min'], $pr['max']) && $v !== null) {
                if (! is_numeric($v) || is_string($v) || $v < 0 || $v > $pr['max']) {
                    $p[] = "{$nome}: {$pr['rotulo']} fora do limite.";
                }
            }
            if ($pr['tipo'] === 'num' && isset($pr['min']) && $pr['min'] > 0 && $v === null && $def['id'] !== 'condicao-area') {
                $p[] = "{$nome}: informe {$pr['rotulo']}.";
            }
            if ($pr['tipo'] === 'opcao' && ! in_array((string) ($v ?? ''), array_map(fn ($o) => (string) $o['id'], $pr['opcoes'] ?? []), true)) {
                $p[] = "{$nome}: escolha {$pr['rotulo']}.";
            }
        }
        if ($def['id'] === 'condicao-area' && $aux && self::num($ef['params']['grauRef'] ?? null) < 1) {
            $p[] = "{$nome}: em Técnica Auxiliar informe o grau de referência da área.";
        }
        if ($def['id'] === 'power-up' && $e['tipo'] === 'mp' && ($ef['params']['dados'] ?? false) === true) {
            $p[] = "{$nome}: os dados de dano extra não existem em MP (não pode aumentar dano).";
        }
        if ($def['id'] === 'cr' && $e['tipo'] === 'mp' && ($e['ativacao'] ?? '') !== 'poderosa') {
            $p[] = "{$nome}: em MP só com o requisito Ação Poderosa.";
        }
        if (! empty($ef['prolongada']) && $def['prolongada'] === null) {
            $p[] = "{$nome}: não tem Duração Prolongada.";
        }
        if ($def['id'] === 'lacaio' && self::custoDoEfeito($e, $ef) > 15) {
            $p[] = "{$nome}: o lacaio custa no máximo 15 PP.";
        }
        if ($def['id'] === 'colateral') {
            $t = min(4, (int) self::num($ef['params']['geral'] ?? null)) + min(4, intdiv((int) self::num($ef['params']['dano'] ?? null), 5));
            if ($t > 8) {
                $p[] = "{$nome}: a redução máxima é 8 PP.";
            }
        }

        return $p;
    }

    /**
     * Confere as técnicas criadas pelo jogador (custo, grau e espaços) ao gravar a ficha. O mestre passa direto.
     * Técnicas à mão (sem `criador`) seguem livres, mas não se pode tirar o `criador` de uma técnica criada.
     *
     * @param  array<string, mixed>  $antes
     * @param  array<string, mixed>  $depois
     */
    public static function conferir(array $antes, array $depois): void
    {
        $akuma = array_replace_recursive(Akuma::padrao(), $depois['akuma'] ?? []);
        $nivel = (int) ($depois['nivel'] ?? 1);
        $genialidades = 0;
        foreach ((array) ($depois['treinamento']['aprendidos'] ?? []) as $t) {
            if (($t['id'] ?? '') === 'genialidade-inusitada') {
                $genialidades++;
            }
        }
        foreach ([['tecnicas', 'estilo'], ['akuma', 'akuma']] as [$chave, $destino]) {
            $campo = "{$chave}.lista";
            $lista = (array) ($depois[$chave]['lista'] ?? []);
            $velha = (array) ($antes[$chave]['lista'] ?? []);
            $ctx = [
                'nivel' => $nivel, 'usuario' => (string) $akuma['usuario'], 'despertado' => ! empty($akuma['despertada']), 'genialidades' => $genialidades,
                'akuma' => $destino === 'akuma' ? (string) $akuma['tipo'] : '', 'zoan' => (string) $akuma['zoan'], 'points' => $akuma['points'], 'destino' => $destino,
            ];
            $antigas = [];
            foreach ($velha as $t) {
                if (isset($t['criador'])) {
                    $antigas[$t['nome'] ?? ''] = $t;
                }
            }
            $slots = ['combate' => [], 'auxiliar' => 0, 'mp' => 0, 'aspecto' => 0, 'genialidade' => [], 'aperfeicoada' => [], 'point' => []];
            foreach ($lista as $t) {
                $nome = (string) ($t['nome'] ?? '');
                if (! isset($t['criador'])) {
                    if (isset($antigas[$nome])) {
                        throw ValidationException::withMessages([$campo => "A técnica \"{$nome}\" foi criada no Criador de Técnicas e não pode perder suas regras."]);
                    }

                    continue;
                }
                $e = $t['criador'];
                $inalterada = isset($antigas[$nome]) && $antigas[$nome]['criador'] == $e && ($antigas[$nome]['custo'] ?? null) === ($t['custo'] ?? null);
                if (! $inalterada) {
                    $problemas = self::problemas($e, $ctx);
                    if ($problemas) {
                        throw ValidationException::withMessages([$campo => "Técnica \"{$nome}\": {$problemas[0]}"]);
                    }
                    $esperado = $e['tipo'] === 'mp' ? 0 : self::custoDaTecnica($e)['total'];
                    if ((int) ($t['custo'] ?? -1) !== $esperado) {
                        throw ValidationException::withMessages([$campo => "Técnica \"{$nome}\": o custo é {$esperado} PP."]);
                    }
                }
                self::contar($slots, $e);
            }
            self::conferirEspacos($slots, $ctx, $akuma, $campo);
        }
    }

    /** @param array<string, mixed> $slots @param array<string, mixed> $e */
    private static function contar(array &$slots, array $e): void
    {
        $origem = $e['origem']['tipo'] ?? '';
        if ($origem === 'genialidade') {
            $slots['genialidade'][] = (int) ($e['origem']['indice'] ?? 0);

            return;
        }
        if ($origem === 'aspecto') {
            $slots['aspecto']++;

            return;
        }
        if ($origem === 'point') {
            $ponto = (int) ($e['origem']['ponto'] ?? 0);
            $slots['point'][$ponto] ??= ['pp' => 0, 'pv' => 0, 'tecnicas' => 0];
            if ($e['tipo'] === 'mp') {
                $slots['point'][$ponto]['pv'] += self::custoDaTecnica($e)['total'];
            } else {
                $slots['point'][$ponto]['pp'] += self::custoDaTecnica($e)['total'];
                $slots['point'][$ponto]['tecnicas']++;
            }

            return;
        }
        if ($e['tipo'] === 'combate') {
            $forma = $e['forma'] ?? 'base';
            if ($forma === 'base') {
                $slots['combate'][(int) $e['grau']] = ($slots['combate'][(int) $e['grau']] ?? 0) + 1;
            } elseif ($forma === 'aperfeicoada') {
                $slots['aperfeicoada'][(int) $e['grau']] = ($slots['aperfeicoada'][(int) $e['grau']] ?? 0) + 1;
            }
        } elseif ($e['tipo'] === 'auxiliar') {
            $slots['auxiliar']++;
        } elseif ($e['tipo'] === 'mp') {
            $slots['mp']++;
        }
    }

    /** @param array<string, mixed> $slots @param array<string, mixed> $ctx @param array<string, mixed> $akuma */
    private static function conferirEspacos(array $slots, array $ctx, array $akuma, string $campo): void
    {
        $falha = fn (string $m) => throw ValidationException::withMessages([$campo => $m]);
        if ($ctx['destino'] === 'akuma') {
            $esp = self::espacos($ctx);
            $zoan = (string) $akuma['zoan'];
            foreach ($slots['combate'] as $g => $n) {
                if ($n > ($esp['combate'][$g] ?? 0)) {
                    $falha("Você já tem a Técnica de {$g}º grau deste nível.");
                }
                // Zoan Mítica: a Técnica de cada grau ou o Point daquela posição (nunca os dois).
                if ($zoan === 'mitica') {
                    $pointsDoGrau = count(array_filter($akuma['points'], fn ($x) => ($x['ponto'] ?? 0) === $g && ! isset($x['genialidade'])));
                    $extras = Akuma::pointsExtrasDaMitica((int) $ctx['nivel'], ! empty($ctx['despertado']));
                    if ($n + $pointsDoGrau > 1 + $extras) {
                        $falha("Zoan Mítica: a Técnica de {$g}º grau e o {$g}º Point são alternativos.");
                    }
                }
            }
            if ($slots['auxiliar'] > $esp['auxiliares'] + $esp['auxiliaresDespertas']) {
                $falha('Você já usou todas as suas Técnicas Auxiliares.');
            }
            if ($slots['mp'] > Akuma::manifestacoesCriaveis($akuma)) {
                $falha('Você já usou todas as suas Manifestações de Poder (as MPs Especiais também contam).');
            }
            if ($slots['aspecto'] > 1) {
                $falha('O Corpo Elemental dá uma única Técnica Auxiliar.');
            }
            foreach ($slots['point'] as $ponto => $uso) {
                $linha = self::linhaDoPoint((int) $ponto);
                if ($uso['pv'] > ($linha['tracos'] ?? 0)) {
                    $falha("Traços Realçados do {$ponto}º Point: no máximo {$linha['tracos']} Pontos Virtuais.");
                }
                if ($uso['pp'] + $uso['pv'] > ($linha['tecnica'] ?? 0)) {
                    $falha("{$ponto}º Point: a Técnica e o Traço Realçado dividem o máximo de {$linha['tecnica']} PP.");
                }
                if ($uso['tecnicas'] > 1) {
                    $falha("{$ponto}º Point: só uma Técnica por Point.");
                }
            }
        } elseif ($slots['combate'] || $slots['auxiliar'] || $slots['mp'] || $slots['aspecto'] || $slots['point']) {
            $falha('Técnicas de estilo só são criadas com a Genialidade Inusitada.');
        }
        foreach ($slots['aperfeicoada'] as $g => $n) {
            if ($n > 1) {
                $falha("Só há uma Forma Aperfeiçoada para cada grau (grau {$g}).");
            }
        }
    }

    /** As Genialidades Inusitadas usadas (técnicas e Points; cada uma, uma vez só). */
    public static function conferirGenialidades(array $depois): void
    {
        $usadas = [];
        foreach (['tecnicas', 'akuma'] as $chave) {
            foreach ((array) ($depois[$chave]['lista'] ?? []) as $t) {
                $o = $t['criador']['origem'] ?? [];
                if (($o['tipo'] ?? '') === 'genialidade') {
                    $usadas[] = (int) ($o['indice'] ?? 0);
                }
            }
        }
        foreach ((array) ($depois['akuma']['points'] ?? []) as $x) {
            if (isset($x['genialidade'])) {
                $usadas[] = (int) $x['genialidade'];
            }
        }
        if (count($usadas) !== count(array_unique($usadas))) {
            throw ValidationException::withMessages(['akuma.lista' => 'Cada Genialidade Inusitada cria uma única Técnica ou Point.']);
        }
    }
}
