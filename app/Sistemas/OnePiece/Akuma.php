<?php

namespace App\Sistemas\OnePiece;

use Illuminate\Validation\ValidationException;

/**
 * Akuma no Mi (cap. 6) no servidor: perfil do fruto, MPs Especiais, Traços e Points da Zoan. Espelho de `akuma/regras.ts`
 * (os ids e limites vêm de `dados/akuma.json`, gerado do TS e conferido por teste).
 *
 * O jogador monta o próprio perfil, mas categoria, propriedades, tipo de despertar e a espécie de Zoan são definidos pelo
 * fruto (Narrador): ele só preenche quando ainda estão vazios. O despertar da fruta é do mestre.
 */
class Akuma
{
    /** @var array<string, mixed>|null */
    private static ?array $catalogo = null;

    /** @return array<string, mixed> */
    public static function catalogo(): array
    {
        return self::$catalogo ??= json_decode(file_get_contents(__DIR__.'/dados/akuma.json'), true);
    }

    /** @return array<string, mixed> */
    public static function padrao(): array
    {
        return [
            'tipo' => '', 'despertada' => false, 'usuario' => 'simples', 'lista' => [], 'categoria' => '', 'propriedades' => [], 'zoan' => '',
            'predador' => false, 'despertar' => '', 'aspecto' => 'padrao', 'mpEspeciais' => [], 'tracos' => ['comuns' => [], 'especificos' => [], 'ancestrais' => []],
            'points' => [],
        ];
    }

    public static function manifestacoesDoFruto(string $tipo, string $zoan, string $usuario, bool $desperto): int
    {
        if ($tipo === 'zoan') {
            return $zoan === 'mitica' ? ($desperto ? 2 : 1) : 0;
        }
        if ($tipo === 'logia' || $tipo === 'paramecia') {
            return $usuario === 'avancado' ? ($desperto ? 3 : 2) : 1;
        }

        return 0;
    }

    /**
     * MPs criadas que cabem: as do tipo de usuário, menos as Especiais, mais a do Aspecto Inato alternativo.
     *
     * @param  array<string, mixed>  $a
     */
    public static function manifestacoesCriaveis(array $a): int
    {
        $total = self::manifestacoesDoFruto((string) $a['tipo'], (string) $a['zoan'], (string) $a['usuario'], ! empty($a['despertada']));

        return max(0, $total - count($a['mpEspeciais'])) + ($a['aspecto'] === 'mp' ? 1 : 0);
    }

    public static function pointsExtrasDaMitica(int $nivel, bool $desperto): int
    {
        return $desperto ? ($nivel >= 20 ? 2 : ($nivel >= 16 ? 1 : 0)) : 0;
    }

    private static function nivelDoPoint(int $ponto): int
    {
        return Criador::linhaDoPoint($ponto)['nivel'] ?? 99;
    }

    /** @return array{comuns: int, especificos: int, ancestrais: int, extra: int, troca: int} */
    public static function limitesDeTracos(string $zoan, bool $predador, bool $desperto): array
    {
        if ($zoan === 'mitica') {
            return ['comuns' => 2, 'especificos' => 2, 'ancestrais' => 1, 'extra' => $desperto ? 1 : 0, 'troca' => 0];
        }

        return ['comuns' => 3, 'especificos' => $predador ? 3 : 5, 'ancestrais' => $zoan === 'ancestral' ? 1 : 0, 'extra' => 0, 'troca' => $zoan === 'ancestral' ? 3 : 0];
    }

    /** @param array<string, mixed> $a */
    public static function mpEspecialLiberada(string $id, array $a): bool
    {
        foreach (self::catalogo()['mpEspeciais'] as $m) {
            if ($m['id'] === $id) {
                return match ($m['restricao']) {
                    'logia' => $a['tipo'] === 'logia',
                    'categoria' => in_array($a['categoria'], ['a', 's'], true),
                    'logia-ou-desperto' => $a['tipo'] === 'logia' || ! empty($a['despertada']),
                    default => true,
                };
            }
        }

        return false;
    }

    /**
     * Tudo que está fora das regras do perfil, dos Traços, dos Points e das MPs Especiais.
     *
     * @param  array<string, mixed>  $ficha
     * @return list<string>
     */
    public static function problemas(array $ficha): array
    {
        $a = array_replace_recursive(self::padrao(), $ficha['akuma'] ?? []);
        $a['mpEspeciais'] = array_values((array) ($ficha['akuma']['mpEspeciais'] ?? []));
        $a['points'] = array_values((array) ($ficha['akuma']['points'] ?? []));
        $a['propriedades'] = array_values((array) ($ficha['akuma']['propriedades'] ?? []));
        $nivel = (int) ($ficha['nivel'] ?? 1);
        $cat = self::catalogo();
        $p = [];
        if ($a['tipo'] === '') {
            return ($a['mpEspeciais'] || $a['points'] || ($a['tracos']['comuns'] ?? [])) ? ['Escolha o tipo da Akuma no Mi.'] : [];
        }
        $props = array_column($cat['propriedades'], 'id');
        foreach ($a['propriedades'] as $id) {
            if (! in_array($id, $props, true)) {
                $p[] = 'Propriedade desconhecida.';
            }
        }
        if ($a['zoan'] !== '' && $a['tipo'] !== 'zoan') {
            $p[] = 'Só Zoan tem Zoan Comum, Ancestral ou Mítica.';
        }
        if ($a['tipo'] === 'zoan' && $a['zoan'] === '' && ($a['tracos']['comuns'] || $a['points'])) {
            $p[] = 'Escolha se a Zoan é Comum, Ancestral ou Mítica.';
        }
        if ($a['aspecto'] === 'uso-alternativo' && ! ($a['tipo'] === 'zoan' && $a['zoan'] === 'mitica')) {
            $p[] = 'O "Uso Alternativo" no lugar do Vigor Animalesco é só das Zoan Míticas.';
        }
        if ($a['despertar'] !== '' && $a['tipo'] === 'zoan') {
            $p[] = 'Zoan não tem tipo de despertar (Aprimorador/Transmutador/Holista).';
        }
        if ($a['despertar'] !== '' && ! in_array($a['despertar'], $cat['despertares'], true)) {
            $p[] = 'Tipo de despertar desconhecido.';
        }
        if ($a['categoria'] !== '' && ! in_array($a['categoria'], array_column($cat['categorias'], 'id'), true)) {
            $p[] = 'Categoria desconhecida.';
        }
        if (count(array_unique($a['mpEspeciais'])) !== count($a['mpEspeciais'])) {
            $p[] = 'Uma MP Especial só pode ser escolhida uma vez.';
        }
        foreach ($a['mpEspeciais'] as $id) {
            if (! self::mpEspecialLiberada((string) $id, $a)) {
                $p[] = "MP Especial \"{$id}\": não liberada para este fruto.";
            }
        }
        $total = self::manifestacoesDoFruto($a['tipo'], $a['zoan'], $a['usuario'], ! empty($a['despertada']));
        if (count($a['mpEspeciais']) > $total) {
            $p[] = 'Mais MPs Especiais do que Manifestações de Poder disponíveis.';
        }
        if ($a['tipo'] === 'zoan' && $a['zoan'] !== '') {
            $gen = count(array_filter((array) ($ficha['treinamento']['aprendidos'] ?? []), fn ($t) => ($t['id'] ?? '') === 'genialidade-inusitada'));
            array_push($p, ...self::problemasDaZoan($a, $nivel, $gen));
        }

        return $p;
    }

    /** @param array<string, mixed> $a @return list<string> */
    private static function problemasDaZoan(array $a, int $nivel, int $genialidades): array
    {
        $cat = self::catalogo();
        $p = [];
        $lim = self::limitesDeTracos($a['zoan'], ! empty($a['predador']), ! empty($a['despertada']));
        $comuns = array_values((array) $a['tracos']['comuns']);
        $esps = array_values((array) $a['tracos']['especificos']);
        $ancs = array_values((array) $a['tracos']['ancestrais']);
        foreach (array_count_values(array_merge($comuns, $esps)) as $id => $n) {
            if ($n > ($cat['repetiveis'][$id] ?? 1)) {
                $p[] = "Traço \"{$id}\": escolhido vezes demais.";
            }
        }
        if (array_diff($comuns, $cat['comuns'])) {
            $p[] = 'Traço Comum desconhecido.';
        }
        if (array_diff($esps, $cat['especificos'])) {
            $p[] = 'Traço Específico desconhecido.';
        }
        if (array_diff($ancs, $cat['ancestrais'])) {
            $p[] = 'Traço Ancestral desconhecido.';
        }
        if (count($comuns) > $lim['comuns']) {
            $p[] = "No máximo {$lim['comuns']} Traços Comuns.";
        }
        if (count(array_unique($ancs)) !== count($ancs)) {
            $p[] = 'Um Traço Ancestral só pode ser escolhido uma vez.';
        }
        $esp = count($esps);
        $anc = count($ancs);
        if ($a['zoan'] === 'comum' && $anc) {
            $p[] = 'Zoan Comum não recebe Traços Ancestrais.';
        }
        if ($a['zoan'] === 'ancestral') {
            $trocas = max(0, $anc - $lim['ancestrais']);
            if ($trocas > $lim['troca']) {
                $p[] = "Só dá para trocar até {$lim['troca']} Traços Específicos por Ancestrais.";
            }
            if ($esp > $lim['especificos'] - $trocas) {
                $p[] = 'Traços Específicos demais (com as trocas por Ancestrais).';
            }
        } elseif ($a['zoan'] === 'mitica') {
            if ($anc > $lim['ancestrais'] + $lim['extra']) {
                $p[] = 'Traços Ancestrais demais.';
            }
            if ($esp > $lim['especificos'] + $lim['extra']) {
                $p[] = 'Traços Específicos demais.';
            }
            if ($esp + $anc > $lim['especificos'] + $lim['ancestrais'] + $lim['extra']) {
                $p[] = 'Traços Específicos/Ancestrais demais juntos.';
            }
        } elseif ($esp > $lim['especificos']) {
            $p[] = "No máximo {$lim['especificos']} Traços Específicos.";
        }
        // --- Points
        $modelos = [];
        $ids = array_column($cat['modelos'], 'id');
        $extras = $a['zoan'] === 'mitica' ? self::pointsExtrasDaMitica($nivel, ! empty($a['despertada'])) : 0;
        $porTier = [];
        $delGen = [];
        foreach ($a['points'] as $x) {
            $ponto = $x['ponto'] ?? null;
            if (! is_int($ponto) || $ponto < 1 || $ponto > 5) {
                $p[] = 'Point fora de 1 a 5.';

                continue;
            }
            if (($x['modelo'] ?? '') !== 'custom') {
                $modelos[] = $x['modelo'] ?? '';
            }
            if (isset($x['genialidade'])) {
                $delGen[] = $x['genialidade'];
                if (! is_int($x['genialidade']) || $x['genialidade'] < 1 || $x['genialidade'] > min(5, $genialidades) || $ponto !== $x['genialidade'] || ($x['modelo'] ?? '') !== 'custom') {
                    $p[] = 'Point da Genialidade Inusitada inválido (a nº N cria um Point próprio de posição N).';
                }

                continue;
            }
            if ($nivel < self::nivelDoPoint($ponto) && ! ($extras > 0 && $nivel >= 16)) {
                $p[] = "O {$ponto}º Point só vem no nível ".self::nivelDoPoint($ponto).'.';
            }
            $porTier[$ponto] = ($porTier[$ponto] ?? 0) + 1;
        }
        if (count(array_unique($modelos)) !== count($modelos)) {
            $p[] = 'Cada Modelo Especial de Point só pode ser escolhido uma vez.';
        }
        if (array_diff($modelos, $ids)) {
            $p[] = 'Modelo de Point desconhecido.';
        }
        $surplus = array_sum(array_map(fn ($n) => max(0, $n - 1), $porTier));
        if ($a['zoan'] === 'mitica' && $surplus > $extras) {
            $p[] = 'Pontos de posição repetida só valem como "Point qualquer" do 16º e 20º nível (Mítica desperta).';
        }
        if ($a['zoan'] !== 'mitica' && $surplus > 0) {
            $p[] = 'Cada posição de Point (1º ao 5º) só pode ser usada uma vez.';
        }
        if (count(array_unique($delGen)) !== count($delGen)) {
            $p[] = 'Cada Genialidade Inusitada cria um único Point.';
        }
        if ($delGen && $a['zoan'] === 'mitica') {
            $p[] = 'Em Zoan Mítica a Genialidade Inusitada cria Técnicas, não Points.';
        }

        return $p;
    }

    /**
     * O que o jogador pode gravar no perfil. O mestre passa direto (chamado só para o jogador).
     *
     * @param  array<string, mixed>  $antes
     * @param  array<string, mixed>  $depois
     */
    public static function conferir(array $antes, array $depois): void
    {
        $a = array_replace_recursive(self::padrao(), $antes['akuma'] ?? []);
        $d = array_replace_recursive(self::padrao(), $depois['akuma'] ?? []);
        // Definidos pelo fruto (Narrador): o jogador só preenche quando ainda estão vazios.
        foreach (['categoria', 'despertar', 'zoan'] as $campo) {
            if ($a[$campo] !== '' && $a[$campo] !== $d[$campo]) {
                abort(403, "O mestre define: {$campo} da Akuma no Mi.");
            }
        }
        if (($antes['akuma']['propriedades'] ?? []) !== [] && ($antes['akuma']['propriedades'] ?? []) != ($depois['akuma']['propriedades'] ?? [])) {
            abort(403, 'O mestre define as propriedades da Akuma no Mi.');
        }
        $problemas = self::problemas($depois);
        $antigos = self::problemas($antes);
        // Só barra o que a mudança trouxe de novo (fichas antigas podem já estar fora das regras).
        $novos = array_values(array_diff($problemas, $antigos));
        if ($novos) {
            throw ValidationException::withMessages(['akuma' => $novos[0]]);
        }
    }
}
