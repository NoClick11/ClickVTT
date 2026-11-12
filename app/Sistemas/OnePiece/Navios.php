<?php

namespace App\Sistemas\OnePiece;

/**
 * Regras do navio (cap. 13 e 14) no servidor: CR, BR, velocidade, condição, cômodos, lotação, despesas, efetivo e o custo de
 * cada obra. É o ESPELHO de `resources/js/app/sistemas/onepiece/navios/regras.ts`; as tabelas vêm de `dados/navios.json`
 * (gerado do TS por `tests/paridade/gerar-navios.mjs`) e os dois lados são conferidos pelos casos de
 * `tests/paridade/navios-casos.json`.
 *
 * O navio é um personagem com o bloco `ficha.navio`; PV em `ficha.pv`, tesouro em `ficha.belly`, carga em `ficha.inventario`.
 */
class Navios
{
    public const GRUPOS_DE_LISTA = ['mastros', 'motores', 'canhoes', 'comodos'];

    public const GRUPOS_UNICOS = ['madeira', 'fortificacao', 'kairoseki', 'ancora', 'leme'];

    private const NOMES_DOS_TAMANHOS = ['pequeno' => 'Pequeno', 'medio' => 'Médio', 'grande' => 'Grande', 'enorme' => 'Enorme', 'colossal' => 'Colossal'];

    private const CONSEQUENCIAS = [
        'navegacao' => ['O navio não pode navegar.', 'Testes de navegação com desvantagem e sem manobras.'],
        'limpeza' => ['A cada 4 dias, Salvaguarda de Constituição CD 18 ou "Doente"; mover-se no navio custa 1,5 m a mais por 1,5 m.', 'Mover-se no navio custa 1,5 m a mais por 1,5 m.'],
        'vigilancia' => ['Infiltrações podem levar todo o tesouro; ataques-surpresa frequentes.', 'Ataque-surpresa na falha de Vontade (Percepção) CD 18, a cada duas noites.'],
        'artilharia' => ['Canhão sem artilheiro não ataca.', 'Canhão sem rapaz da pólvora não ataca em 2 turnos seguidos.'],
        'alimentacao' => ['Quem não foi alimentado sofre a falta de comida (Cap. 11).', ''],
    ];

    /** @var array<string, mixed>|null */
    private static ?array $dados = null;

    /** @return array<string, mixed> */
    public static function dados(): array
    {
        return self::$dados ??= json_decode(file_get_contents(__DIR__.'/dados/navios.json'), true);
    }

    /** @return array<string, mixed>|null */
    private static function por(string $lista, ?string $id): ?array
    {
        if ($id === null) {
            return null;
        }
        foreach (self::dados()[$lista] as $x) {
            if ($x['id'] === $id) {
                return $x;
            }
        }

        return null;
    }

    /** @return array<string, mixed> */
    public static function tamanho(?string $id): array
    {
        return self::por('tamanhos', $id) ?? self::dados()['tamanhos'][0];
    }

    private static function listaDoGrupo(string $grupo): ?string
    {
        return ['ancora' => 'ancoras', 'leme' => 'lemes', 'mastros' => 'mastros', 'motores' => 'motores', 'canhoes' => 'canhoes'][$grupo] ?? null;
    }

    /** O tipo que VALE na parte (em obra, o anterior). */
    public static function tipoEfetivo(?array $parte): ?string
    {
        if (! $parte) {
            return null;
        }

        return ($parte['pronto_dia'] ?? null) === null ? ($parte['tipo'] ?? null) : ($parte['antes'] ?? null);
    }

    /** @return list<array<string, mixed>> */
    private static function prontas(?array $lista): array
    {
        return array_values(array_filter($lista ?? [], fn ($p) => ($p['pronto_dia'] ?? null) === null));
    }

    private static function tem(array $lista, string $tipo): bool
    {
        foreach ($lista as $p) {
            if (($p['tipo'] ?? null) === $tipo) {
                return true;
            }
        }

        return false;
    }

    /** @return array<string, mixed> */
    public static function padrao(string $tamanho = 'pequeno', string $madeira = 'cedro'): array
    {
        $t = self::tamanho($tamanho);

        return [
            'tamanho' => $t['id'],
            'madeira' => ['tipo' => $madeira, 'pronto_dia' => null],
            'fortificacao' => ['tipo' => null, 'pronto_dia' => null],
            'kairoseki' => ['tipo' => null, 'pronto_dia' => null],
            'ancora' => ['tipo' => $t['ordem'] >= 3 ? 'robusta' : 'normal', 'pronto_dia' => null],
            'leme' => ['tipo' => $t['ordem'] >= 2 ? 'circular' : 'tora', 'pronto_dia' => null],
            'mastros' => [],
            'motores' => [],
            'canhoes' => [],
            'comodos' => [],
            'tripulacao' => [],
            'klabautermann' => false,
            'feito_por_carpinteiro' => false,
            'lotacao' => null,
            'baterias' => 0,
            'conserto' => null,
            'manutencao' => ['proxima_dia' => 1, 'em_dia' => true],
            'oficios' => ['carpinteiro' => false, 'timoneiro' => false, 'timoneiroNaNavegacao' => false],
            'registro' => [],
        ];
    }

    /** O navio de um modelo do livro, tudo pronto. @return array<string, mixed>|null */
    public static function doModelo(string $modeloId): ?array
    {
        $m = self::por('modelos', $modeloId);
        if (! $m) {
            return null;
        }
        $pecas = fn (array $tipos) => array_map(fn ($tipo) => ['uid' => self::uid(), 'tipo' => $tipo, 'pronto_dia' => null], $tipos);

        return [
            ...self::padrao($m['tamanho'], $m['madeira']),
            'fortificacao' => ['tipo' => $m['fortificacao'], 'pronto_dia' => null],
            'ancora' => ['tipo' => $m['ancora'], 'pronto_dia' => null],
            'leme' => ['tipo' => $m['leme'], 'pronto_dia' => null],
            'mastros' => $pecas($m['mastros']),
            'motores' => $pecas($m['motores']),
            'canhoes' => $pecas($m['canhoes']),
            'comodos' => $pecas($m['comodos']),
            'lotacao' => $m['lotacao'],
        ];
    }

    public static function uid(): string
    {
        return bin2hex(random_bytes(5));
    }

    /** @return array<string, mixed> */
    public static function condicao(int $pvAtual, int $pvMax): array
    {
        $pct = $pvMax > 0 ? intdiv(max(0, $pvAtual) * 100, $pvMax) : 100;
        $todas = self::dados()['condicoes'];
        foreach ($todas as $c) {
            if ($pct <= $c['ate']) {
                return $c;
            }
        }

        return $todas[count($todas) - 1];
    }

    private static function comodoAtivo(array $n, string $tipo): bool
    {
        return ($n['manutencao']['em_dia'] ?? true) !== false && self::tem(self::prontas($n['comodos'] ?? []), $tipo);
    }

    private static function espacosUsados(array $n): int
    {
        $s = 0;
        foreach ($n['comodos'] ?? [] as $c) {
            $s += self::por('comodos', $c['tipo'] ?? null)['espacos'] ?? 1;
        }

        return $s;
    }

    /** @return array<string, mixed> */
    public static function calcular(array $n, int $pvAtual): array
    {
        $d = self::dados();
        $t = self::tamanho($n['tamanho'] ?? null);
        $madeira = self::por('madeiras', self::tipoEfetivo($n['madeira'] ?? null)) ?? $d['madeiras'][0];
        $fort = self::por('fortificacoes', self::tipoEfetivo($n['fortificacao'] ?? null));
        $kairoseki = self::tipoEfetivo($n['kairoseki'] ?? null) !== null;
        $eficacia = ! empty($n['feito_por_carpinteiro']) ? $d['profissoes']['carpinteiro'] : null;
        $cr = $madeira['cr'] + ($fort['cr'] ?? 0) + ($kairoseki ? $d['kairoseki']['cr'] : 0) + ($eficacia['cr'] ?? 0);

        $mastros = 0;
        foreach (self::prontas($n['mastros'] ?? []) as $p) {
            $mastros += self::por('mastros', $p['tipo'])['nos'] ?? 0;
        }
        $motores = self::prontas($n['motores'] ?? []);
        $salas = count(array_filter(self::prontas($n['comodos'] ?? []), fn ($c) => $c['tipo'] === 'sala-maquinas'));
        $motor = 0;
        foreach ($motores as $m) {
            if (in_array($m['tipo'], $d['motoresSobDemanda'], true)) {
                continue;
            }
            $nos = $m['tipo'] === 'combustao' && $t['id'] === 'colossal' && $salas >= 2 ? 16 : (self::por('motores', $m['tipo'])['nos'] ?? 0);
            $motor = max($motor, $nos);
        }
        $base = max(0, $mastros + $motor + ($eficacia['nos'] ?? 0) - $t['peso']);
        $condicao = self::condicao($pvAtual, $t['pv']);
        $reducao = ! empty($n['oficios']['timoneiroNaNavegacao']) ? 0 : $condicao['reducao'];
        $velocidade = $reducao > 0 ? max(min($base, $d['velocidadeMinimaPorDano']), $base - $reducao) : $base;

        $despesa = 0;
        foreach (self::prontas($n['comodos'] ?? []) as $c) {
            $despesa += self::por('comodos', $c['tipo'])['despesa'] ?? 0;
        }
        $resistencias = [];
        if (($fort['id'] ?? null) === 'aco-temperado') {
            $resistencias[] = 'Resistência Titânica: resistência a dano Contundente, Cortante e Perfurante.';
        }
        if ($madeira['id'] === 'adam') {
            $resistencias[] = 'Resistência Anciã: imune a características que aumentam o dano em construções.';
        }
        if ($kairoseki) {
            $resistencias[] = 'Casco de kairoseki: ignora encontros com Rei dos Mares e pode ser reparado com ao menos 1 PV.';
        }

        return [
            'cr' => $cr,
            'br' => $madeira['br'],
            'pvMax' => $t['pv'],
            'velocidadeBase' => $base,
            'reducaoPorDano' => $base - $velocidade,
            'velocidade' => $velocidade,
            'metrosPorRodada' => ($velocidade / 2) * 1.5,
            'turbina' => self::tem($motores, 'turbina') ? (self::por('motores', 'turbina')['nos'] ?? 0) : 0,
            'condicao' => $condicao['id'],
            'comodosUsados' => self::espacosUsados($n),
            'comodosMax' => $t['comodos'],
            'lotacao' => ($n['lotacao'] ?? $t['tripulantes']) + (self::comodoAtivo($n, 'cozinha') ? 5 : 0),
            'canhoes' => count(self::prontas($n['canhoes'] ?? [])),
            'canhoesMax' => $t['canhoes'],
            'mastrosMax' => $t['mastros'],
            'despesa' => $despesa,
            'bateriasMax' => self::comodoAtivo($n, 'gerador') ? $d['bateriasDoGerador'] : 0,
            'autoReparo' => ! empty($n['klabautermann']) ? $d['autoReparo'] * (1 + $t['ordem']) : 0,
            'valor' => self::valor($n),
            'resistencias' => $resistencias,
        ];
    }

    public static function valor(array $n): int
    {
        $d = self::dados();
        $t = self::tamanho($n['tamanho'] ?? null);
        $v = $t['pecasMadeira'] * (self::por('madeiras', self::tipoEfetivo($n['madeira'] ?? null))['precoPorPeca'] ?? 0);
        $v += $t['pecasFortificacao'] * (self::por('fortificacoes', self::tipoEfetivo($n['fortificacao'] ?? null))['precoPorPeca'] ?? 0);
        if (self::tipoEfetivo($n['kairoseki'] ?? null) !== null) {
            $v += $t['kairoseki']['pecas'] * $d['kairoseki']['precoPorPeca'];
        }
        $peca = function (string $lista, ?string $tipo): int {
            $p = self::por($lista, $tipo);

            return $p ? ($p['preco'] ?? $p['custo']) : 0;
        };
        $v += $peca('ancoras', self::tipoEfetivo($n['ancora'] ?? null)) + $peca('lemes', self::tipoEfetivo($n['leme'] ?? null));
        foreach (['mastros', 'motores', 'canhoes'] as $grupo) {
            foreach (self::prontas($n[$grupo] ?? []) as $p) {
                $v += $peca($grupo, $p['tipo']);
            }
        }
        foreach (self::prontas($n['comodos'] ?? []) as $c) {
            $v += self::por('comodos', $c['tipo'])['custo'] ?? 0;
        }

        return $v;
    }

    /** Quanto custa e quanto demora a obra; null = essa combinação não existe. @return array{custo: int, dias: int}|null */
    public static function custoDaObra(array $n, string $grupo, string $tipo, string $modo): ?array
    {
        $d = self::dados();
        $t = self::tamanho($n['tamanho'] ?? null);
        $carpinteiro = ! empty($n['oficios']['carpinteiro']);
        $desconto = $carpinteiro ? $d['profissoes']['carpinteiro']['desconto'] : 0;
        $comDesconto = fn (int $v): int => intdiv($v * (100 - $desconto), 100);
        $prazo = fn (int $dias): int => $carpinteiro && ! empty($n['oficios']['timoneiro']) ? (int) ceil($dias / 2) : $dias;
        if ($grupo === 'madeira') {
            $m = self::por('madeiras', $tipo);

            return $m ? ['custo' => $t['pecasMadeira'] * $m['precoPorPeca'], 'dias' => $prazo($t['diasConstrucao'])] : null;
        }
        if ($grupo === 'fortificacao') {
            $f = self::por('fortificacoes', $tipo);

            return $f ? ['custo' => $t['pecasFortificacao'] * $f['precoPorPeca'] + $comDesconto($f['adicional']), 'dias' => $prazo($t['diasFortificacao'])] : null;
        }
        if ($grupo === 'kairoseki') {
            return $tipo === 'kairoseki'
                ? ['custo' => $t['kairoseki']['pecas'] * $d['kairoseki']['precoPorPeca'] + $comDesconto($t['kairoseki']['adicional']), 'dias' => $prazo($t['kairoseki']['dias'])]
                : null;
        }
        if ($grupo === 'comodos') {
            $c = self::por('comodos', $tipo);

            return $c ? ['custo' => $comDesconto($c['custo']), 'dias' => $prazo($c['dias'])] : null;
        }
        $lista = self::listaDoGrupo($grupo);
        $p = $lista ? self::por($lista, $tipo) : null;
        if (! $p) {
            return null;
        }
        if ($modo === 'comprar') {
            return $p['preco'] === null ? null : ['custo' => $p['preco'], 'dias' => 0];
        }

        return ['custo' => $comDesconto($p['custo']), 'dias' => $prazo($p['dias'])];
    }

    /** A obra cabe neste navio? Devolve o motivo quando não (o mestre pode ignorar os limites). */
    public static function problemaDaObra(array $n, string $grupo, string $tipo): ?string
    {
        $d = self::dados();
        $t = self::tamanho($n['tamanho'] ?? null);
        $nomeT = self::NOMES_DOS_TAMANHOS[$t['id']];
        if (in_array($grupo, self::GRUPOS_UNICOS, true)) {
            $parte = $n[$grupo] ?? null;
            if (($parte['pronto_dia'] ?? null) !== null) {
                return 'Já há uma obra em andamento nesta parte.';
            }
            if (($parte['tipo'] ?? null) === $tipo) {
                return 'O navio já tem isto.';
            }
        }
        if ($grupo === 'madeira') {
            return self::por('madeiras', $tipo) ? null : 'Madeira desconhecida.';
        }
        if ($grupo === 'fortificacao') {
            return self::por('fortificacoes', $tipo) ? null : 'Fortificação desconhecida.';
        }
        if ($grupo === 'kairoseki') {
            return $tipo === 'kairoseki' ? null : 'Revestimento desconhecido.';
        }
        if ($grupo === 'comodos') {
            $c = self::por('comodos', $tipo);
            if (! $c) {
                return 'Cômodo desconhecido.';
            }
            $nome = self::nomeDoComodo($tipo);
            if ($c['unico'] && self::tem($n['comodos'] ?? [], $tipo)) {
                return "O navio só comporta um(a) {$nome}.";
            }
            $usados = self::espacosUsados($n);
            if ($usados + $c['espacos'] > $t['comodos']) {
                return "Faltam espaços: o navio {$nomeT} comporta {$t['comodos']} cômodos e {$usados} já estão ocupados.";
            }
            if ($tipo === 'quarto-vigilancia' && ! self::tem(self::prontas($n['mastros'] ?? []), 'multiplo')) {
                return 'O Quarto de Vigilância só pode ser construído em um mastro múltiplo.';
            }

            return null;
        }
        $lista = self::listaDoGrupo($grupo);
        $p = $lista ? self::por($lista, $tipo) : null;
        if (! $p) {
            return 'Peça desconhecida.';
        }
        $nome = self::nomeDaPeca($grupo, $tipo);
        if ($p['ordemMinima'] !== null && $t['ordem'] < $p['ordemMinima']) {
            return "{$nome}: exige navio ".self::NOMES_DOS_TAMANHOS[$d['tamanhos'][$p['ordemMinima']]['id']].' ou maior.';
        }
        if ($p['ordemMaxima'] !== null && $t['ordem'] > $p['ordemMaxima']) {
            return "{$nome}: não serve para um navio {$nomeT}.";
        }
        if ($grupo === 'mastros' && count($n['mastros'] ?? []) >= $t['mastros']) {
            return "Um navio {$nomeT} comporta {$t['mastros']} mastro(s).";
        }
        if ($grupo === 'canhoes' && count($n['canhoes'] ?? []) >= $t['canhoes']) {
            return "Um navio {$nomeT} comporta {$t['canhoes']} canhões.";
        }
        if ($grupo === 'motores') {
            if (self::tem($n['motores'] ?? [], $tipo)) {
                return 'O navio já tem este motor (mais de um não aumenta a velocidade).';
            }
            if (in_array($tipo, $d['motoresComSala'], true) && ! self::tem($n['comodos'] ?? [], 'sala-maquinas')) {
                return "{$nome}: exige o cômodo Sala das Máquinas.";
            }
        }

        return null;
    }

    /** Nomes para as mensagens e o registro (os textos longos ficam só no TS). */
    public static function nomeDaPeca(string $grupo, string $tipo): string
    {
        $nomes = [
            'madeira' => ['cedro' => 'Madeira de Cedro', 'carvalho' => 'Madeira de Carvalho', 'cerejeira' => 'Madeira de Cerejeira', 'adam' => 'Madeira Adam'],
            'fortificacao' => ['aco' => 'Fortificação de Aço', 'aco-temperado' => 'Fortificação de Aço Temperado'],
            'kairoseki' => ['kairoseki' => 'Revestimento de Kairoseki'],
            'ancora' => ['normal' => 'Âncora Normal', 'robusta' => 'Âncora Robusta'],
            'leme' => ['tora' => 'Leme Tora', 'circular' => 'Leme Circular'],
            'mastros' => ['simples' => 'Mastro Simples', 'composto' => 'Mastro Composto', 'multiplo' => 'Mastro Múltiplo'],
            'motores' => ['manual' => 'Motor Manual', 'vapor' => 'Motor a Vapor', 'combustao' => 'Motor de Combustão', 'turbina' => 'Turbina Submersa', 'jato' => 'Propulsão a Jato'],
            'canhoes' => ['comum' => 'Canhão Comum', 'aprimorado' => 'Canhão Aprimorado', 'superior' => 'Canhão Superior', 'longo' => 'Canhão de Longo Alcance', 'arpao' => 'Lançador de Arpão', 'energia' => 'Canhão de Energia'],
        ];

        return $grupo === 'comodos' ? self::nomeDoComodo($tipo) : ($nomes[$grupo][$tipo] ?? $tipo);
    }

    public static function nomeDoComodo(string $tipo): string
    {
        return [
            'aposento-capitao' => 'Aposento do Capitão', 'biblioteca' => 'Biblioteca', 'cela' => 'Cela', 'cozinha' => 'Cozinha', 'despensa' => 'Despensa',
            'dormitorio' => 'Dormitório', 'enfermaria' => 'Enfermaria', 'gerador' => 'Gerador de Energia', 'laboratorio' => 'Laboratório',
            'quarto-vigilancia' => 'Quarto de Vigilância', 'refeitorio' => 'Refeitório', 'sala-maquinas' => 'Sala das Máquinas',
            'sala-ferramentas' => 'Sala de Ferramentas', 'sala-treinamento' => 'Sala de Treinamento', 'sala-tesouro' => 'Sala do Tesouro',
        ][$tipo] ?? $tipo;
    }

    private static function contar(array $n, string ...$funcoes): int
    {
        $s = 0;
        foreach ($n['tripulacao'] ?? [] as $t) {
            if (array_intersect($t['funcoes'] ?? [], $funcoes)) {
                $s += max(0, (int) ($t['qtd'] ?? 0));
            }
        }

        return $s;
    }

    /** @return array{linhas: list<array<string, mixed>>, total: int, lotacao: int, skeletonCrew: bool, naoNavega: bool} */
    public static function efetivo(array $n): array
    {
        $d = self::dados();
        $t = self::tamanho($n['tamanho'] ?? null);
        $linha = function (string $id, string $nome, int $atual, int $minimo, int $necessario, ?string $forcada = null, ?string $detalhe = null): array {
            $situacao = $forcada ?? ($atual < $minimo ? 'sem-minimo' : ($atual < $necessario ? 'minimo' : 'ok'));
            $c = self::CONSEQUENCIAS[$id];
            $consequencia = $situacao === 'sem-minimo' ? $c[0] : ($situacao === 'minimo' ? $c[1] : '');

            return compact('id', 'nome', 'atual', 'minimo', 'necessario', 'situacao', 'consequencia') + ($detalhe ? ['detalhe' => $detalhe] : []);
        };
        $total = 0;
        foreach ($n['tripulacao'] ?? [] as $x) {
            $total += max(0, (int) ($x['qtd'] ?? 0));
        }
        $corte = ! empty($n['oficios']['timoneiroNaNavegacao']) ? $d['profissoes']['timoneiro']['efetivoMinimo'] : 0;
        $navMin = max(1, $t['efetivo']['navegacao'][0] - $corte);
        $vigNec = self::comodoAtivo($n, 'quarto-vigilancia') ? 2 : $t['efetivo']['vigilancia'][1];
        $canhoes = count(self::prontas($n['canhoes'] ?? []));
        $artilheiros = self::contar($n, 'artilheiro');
        $rapazes = self::contar($n, 'rapaz-da-polvora');
        $artilharia = $artilheiros < $canhoes ? 'sem-minimo' : ($rapazes < $canhoes ? 'minimo' : 'ok');
        $temCozinha = self::comodoAtivo($n, 'cozinha');
        $alimentados = $temCozinha && self::contar($n, 'cozinheiro') > 0
            ? 50 + 25 * self::contar($n, 'cozinheiro-ajudante') + (self::comodoAtivo($n, 'despensa') ? 20 : 0) + (self::comodoAtivo($n, 'refeitorio') ? 20 : 0)
            : 0;
        $linhas = [
            $linha('navegacao', 'Navegação', self::contar($n, 'navegacao'), $navMin, max($navMin, $t['efetivo']['navegacao'][1])),
            $linha('limpeza', 'Limpeza', self::contar($n, 'criado-de-bordo'), $t['efetivo']['limpeza'][0], $t['efetivo']['limpeza'][1]),
            $linha('vigilancia', 'Vigilância', self::contar($n, 'sentinela', 'monitor'), min($t['efetivo']['vigilancia'][0], $vigNec), $vigNec),
            $linha('artilharia', 'Artilharia', $artilheiros, $canhoes, $canhoes, $artilharia, "{$rapazes} rapaz(es) da pólvora para {$canhoes} canhão(ões)"),
            $linha('alimentacao', 'Alimentação', min($alimentados, $total), $total, $total),
        ];
        $validas = array_values(array_filter($linhas, fn ($l) => ($l['id'] !== 'artilharia' || $canhoes > 0) && ($l['id'] !== 'alimentacao' || $total > 0)));

        return [
            'linhas' => $validas,
            'total' => $total,
            'lotacao' => ($n['lotacao'] ?? $t['tripulantes']) + ($temCozinha ? 5 : 0),
            'skeletonCrew' => (bool) array_filter($validas, fn ($l) => $l['situacao'] !== 'ok'),
            'naoNavega' => (bool) array_filter($validas, fn ($l) => $l['id'] === 'navegacao' && $l['situacao'] === 'sem-minimo'),
        ];
    }

    /** A lista de tripulantes é válida? (até 3 funções, uma só de comando, funções conhecidas) */
    public static function problemaDaTripulacao(array $lista): ?string
    {
        $d = self::dados();
        $grupos = array_column($d['funcoes'], 'grupo', 'id');
        $capitaes = 0;
        foreach ($lista as $t) {
            $nome = (string) ($t['nome'] ?? '');
            $qtd = $t['qtd'] ?? null;
            $funcoes = array_values((array) ($t['funcoes'] ?? []));
            if (trim($nome) === '') {
                return 'Todo tripulante precisa de um nome.';
            }
            if (! is_int($qtd) || $qtd < 1 || $qtd > 5000) {
                return "{$nome}: quantidade inválida.";
            }
            if (($t['personagem_id'] ?? null) !== null && $qtd !== 1) {
                return "{$nome}: um personagem conta como 1 tripulante.";
            }
            if (count($funcoes) > $d['maxFuncoes']) {
                return "{$nome}: no máximo {$d['maxFuncoes']} funções.";
            }
            if (count(array_unique($funcoes)) !== count($funcoes)) {
                return "{$nome}: função repetida.";
            }
            $comando = 0;
            foreach ($funcoes as $f) {
                if (! is_string($f) || ! isset($grupos[$f])) {
                    return "{$nome}: função desconhecida.";
                }
                $comando += $grupos[$f] === 'comando' ? 1 : 0;
            }
            if ($comando > 1) {
                return "{$nome}: só uma função de comando.";
            }
            $capitaes += in_array('capitao', $funcoes, true) ? $qtd : 0;
        }

        return $capitaes > 1 ? 'O navio tem um só capitão.' : null;
    }

    /**
     * O conserto do navio pela condição atual. `modo`: `carpinteiro` (da tripulação) ou `estaleiro` (contratados).
     *
     * @return array{motivo: ?string, pv: int, custo: int, dias: int, dado: ?string}
     */
    public static function conserto(array $n, int $pvAtual, string $modo): array
    {
        $d = self::dados();
        $t = self::tamanho($n['tamanho'] ?? null);
        $c = self::condicao($pvAtual, $t['pv']);
        $pv = max(0, $t['pv'] - $pvAtual);
        $nada = fn (string $motivo) => ['motivo' => $motivo, 'pv' => $pv, 'custo' => 0, 'dias' => 0, 'dado' => null];
        if ($pv <= 0) {
            return $nada('O navio está íntegro.');
        }
        if (! empty($n['conserto'])) {
            return $nada('Já há um conserto em andamento.');
        }
        $faixa = $c['id'] === 'irreparavel'
            ? (self::tipoEfetivo($n['kairoseki'] ?? null) !== null && $pvAtual >= 1 ? $d['condicoes'][1] : null)
            : $c;
        if (! $faixa) {
            return $nada('Navio irreparável: os PV não podem mais ser recuperados.');
        }
        if ($modo === 'carpinteiro') {
            if (empty($n['oficios']['carpinteiro'])) {
                return $nada('Não há um Carpinteiro na tripulação.');
            }
            $madeira = self::por('madeiras', self::tipoEfetivo($n['madeira'] ?? null)) ?? $d['madeiras'][0];

            return ['motivo' => null, 'pv' => $pv, 'custo' => $faixa['carpinteiro']['fixo'] + $pv * $madeira['consertoPorPv'], 'dias' => $faixa['carpinteiro']['maximo'], 'dado' => $faixa['carpinteiro']['dias']];
        }

        return ['motivo' => null, 'pv' => $pv, 'custo' => intdiv(self::valor($n) * $faixa['estaleiro']['teto'], 100), 'dias' => $faixa['estaleiro']['dias'], 'dado' => null];
    }

    /** Dano no navio: o Bônus de Resistência da madeira reduz todo dano recebido. */
    public static function dano(array $n, int $dano): int
    {
        return max(0, $dano - (self::por('madeiras', self::tipoEfetivo($n['madeira'] ?? null))['br'] ?? 0));
    }
}
