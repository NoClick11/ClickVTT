<?php

namespace App\Sistemas\OnePiece;

use Illuminate\Validation\ValidationException;

/**
 * Profissões (cap. 4) no servidor: confere o que o jogador pode gravar. O catálogo (perícias e ferramenta de cada profissão)
 * vem de `dados/profissoes.json`, conferido contra o TS (`profissoes/dados.ts`) por teste.
 *
 * O jogador escolhe a profissão do 1º nível (ou "não ter profissão") UMA vez e, nos níveis 5, 10, 15 e 20, usa um avanço
 * para uma profissão nova (se o mestre liberou o Livro de Profissão) ou para subir uma graduação (Avanço Planejado). Subir
 * graduação por Grande Feito, liberar o livro e remover profissões são do mestre.
 */
class Profissoes
{
    public const NIVEIS = [5, 10, 15, 20];

    /** @var array{profissoes: list<array<string, mixed>>}|null */
    private static ?array $catalogo = null;

    /** @return array{profissoes: list<array<string, mixed>>} */
    public static function catalogo(): array
    {
        return self::$catalogo ??= json_decode(file_get_contents(__DIR__.'/dados/profissoes.json'), true);
    }

    /** @return array<string, mixed>|null */
    public static function profissao(string $id): ?array
    {
        foreach (self::catalogo()['profissoes'] as $p) {
            if ($p['id'] === $id) {
                return $p;
            }
        }

        return null;
    }

    public static function padrao(): array
    {
        return ['semProfissao' => false, 'livroLido' => false, 'lista' => [], 'usados' => []];
    }

    /** A ficha tem a Singularidade "Pau-para-Toda-Obra" (duas profissões iniciais). */
    public static function pau(array $ficha): bool
    {
        return collect($ficha['individualidades']['singularidades'] ?? [])->contains(fn ($x) => ($x['id'] ?? null) === 'pau-para-toda-obra');
    }

    private static function norm(array $ficha): array
    {
        return array_replace(self::padrao(), $ficha['profissoes'] ?? []);
    }

    /** O primeiro avanço (5/10/15/20) já alcançado e ainda não usado. */
    public static function avancoDisponivel(array $ficha): ?int
    {
        $usados = self::norm($ficha)['usados'];
        foreach (self::NIVEIS as $n) {
            if ($n <= (int) ($ficha['nivel'] ?? 1) && ! in_array($n, $usados, true)) {
                return $n;
            }
        }

        return null;
    }

    /**
     * Confere a mudança feita por um JOGADOR (o mestre faz tudo). `$depois` é a ficha já com as mudanças.
     */
    public static function conferir(array $antes, array $depois): void
    {
        $a = self::norm($antes);
        $d = self::norm($depois);
        $erro = fn (string $m) => throw ValidationException::withMessages(['campos.profissoes' => $m]);
        if ($a === $d) {
            return;
        }
        if ($a['livroLido'] !== $d['livroLido'] && ! ($a['livroLido'] && ! $d['livroLido'] && count($d['lista']) > count($a['lista']))) {
            abort(403, 'Só o mestre libera o Livro de Profissão.');
        }
        // Criação: sem profissão ainda, o jogador define a do 1º nível (ou "não ter profissão") uma única vez.
        if ($a['lista'] === [] && ! $a['semProfissao']) {
            if ($d['semProfissao']) {
                if ($d['lista'] !== [] || $d['usados'] !== []) {
                    $erro('Quem não tem profissão não aprende nenhuma.');
                }

                return;
            }
            $limite = self::pau($depois) ? 2 : 1;
            $ids = array_column($d['lista'], 'id');
            $secundarias = count(array_filter($d['lista'], fn ($x) => ! empty($x['secundaria'])));
            $ok = count($d['lista']) >= 1 && count($d['lista']) <= $limite && $d['usados'] === [] && count(array_unique($ids)) === count($ids) && $secundarias === count($d['lista']) - 1 && empty($d['lista'][0]['secundaria']);
            foreach ($d['lista'] as $x) {
                $ok = $ok && ($x['graduacao'] ?? 1) === 0 && ($x['nivel'] ?? 0) === 1 && self::profissao((string) $x['id']) !== null;
            }
            if (! $ok) {
                $erro('Escolha uma profissão do catálogo (graduação inicial, nível 1); a segunda só com Pau-para-Toda-Obra.');
            }

            return;
        }
        if ($a['semProfissao'] !== $d['semProfissao']) {
            abort(403, 'Só o mestre muda isso.');
        }
        // depois da criação: nada some, nenhuma graduação cai
        foreach ($a['lista'] as $i => $x) {
            $y = $d['lista'][$i] ?? null;
            if (! $y || $y['id'] !== $x['id'] || $y['nivel'] !== $x['nivel'] || $y['graduacao'] < $x['graduacao']) {
                abort(403, 'Só o mestre remove profissões ou reduz graduações.');
            }
        }
        $novas = array_slice($d['lista'], count($a['lista']));
        $subidas = 0;
        foreach ($a['lista'] as $i => $x) {
            $subidas += $d['lista'][$i]['graduacao'] - $x['graduacao'];
        }
        $usadosNovos = array_values(array_diff($d['usados'], $a['usados']));
        if (array_diff($a['usados'], $d['usados'])) {
            abort(403, 'Só o mestre devolve um avanço.');
        }
        // Pau-para-Toda-Obra: a segunda profissão inicial (nível 1, sem avanço) pode ser escolhida depois da criação, uma vez.
        if (count($novas) === 1 && ! empty($novas[0]['secundaria']) && $subidas === 0 && ! $usadosNovos) {
            $n = $novas[0];
            $jaTem = count(array_filter($a['lista'], fn ($x) => ! empty($x['secundaria']))) > 0;
            if (! self::pau($depois) || $jaTem || $a['semProfissao'] || count($a['lista']) !== 1 || ! self::profissao((string) $n['id']) || $n['id'] === $a['lista'][0]['id'] || $n['graduacao'] !== 0 || $n['nivel'] !== 1) {
                $erro('A segunda profissão inicial exige a Singularidade Pau-para-Toda-Obra (uma só, nível 1).');
            }

            return;
        }
        $consumo = count($novas) + $subidas;
        if ($consumo === 0) {
            if ($usadosNovos) {
                $erro('Avanço sem efeito.');
            }

            return;
        }
        if ($consumo !== 1 || count($usadosNovos) !== 1) {
            abort(403, 'Cada avanço (5º, 10º, 15º, 20º) vale uma profissão nova ou uma graduação.');
        }
        $slot = self::avancoDisponivel($antes);
        if ($slot === null || $usadosNovos[0] !== $slot) {
            $erro('Nenhum avanço livre agora: só no 5º, 10º, 15º e 20º nível.');
        }
        if ($novas) {
            $n = $novas[0];
            if (! $a['livroLido']) {
                $erro('Falta ler um Livro de Profissão (o mestre confirma).');
            }
            if ($a['semProfissao']) {
                $erro('Quem não tem profissão não aprende nenhuma.');
            }
            if (! self::profissao((string) $n['id']) || in_array($n['id'], array_column($a['lista'], 'id'), true) || $n['graduacao'] !== 0 || $n['nivel'] !== (int) ($depois['nivel'] ?? 1)) {
                $erro('Profissão nova inválida.');
            }
        } elseif ($subidas !== 1) {
            $erro('O Avanço Planejado sobe uma graduação por vez.');
        }
    }
}
