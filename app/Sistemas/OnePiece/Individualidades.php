<?php

namespace App\Sistemas\OnePiece;

use Illuminate\Validation\ValidationException;

/**
 * Individualidades (cap. 5.5, regra opcional) no servidor: espaços, um Defeito de mesmo nível por Singularidade (ou Defeitos
 * Variáveis), escolhas válidas e o que é do mestre. Espelho de `individualidades/regras.ts`; o catálogo (ids, níveis e escolhas)
 * vem de `dados/individualidades.json`, gerado do TS e conferido por teste.
 *
 * Do mestre: liberar Defeitos Variáveis, dar espaços extras, travar as escolhas depois da criação e a Singularidade
 * "Ambição do Rei" (exige a aprovação do Narrador).
 */
class Individualidades
{
    /** @var array<string, mixed>|null */
    private static ?array $catalogo = null;

    /** @return array<string, mixed> */
    public static function catalogo(): array
    {
        return self::$catalogo ??= json_decode(file_get_contents(__DIR__.'/dados/individualidades.json'), true);
    }

    /** @return array<string, mixed> */
    public static function padrao(): array
    {
        return ['variaveis' => false, 'extras' => 0, 'travada' => false, 'singularidades' => [], 'defeitos' => []];
    }

    /** @return array<string, mixed>|null */
    public static function item(string $tipo, string $id): ?array
    {
        foreach (self::catalogo()['itens'] as $i) {
            if ($i['tipo'] === $tipo && $i['id'] === $id) {
                return $i;
            }
        }

        return null;
    }

    /** Haki da Observação Inato: 5 PA ao adquirir controle do Haki da Observação (o despertar do Haki). */
    public static function paDeHaki(array $ficha): int
    {
        $tem = collect($ficha['individualidades']['singularidades'] ?? [])->contains(fn ($x) => ($x['id'] ?? null) === 'haki-observacao-inato');

        return $tem && Haki::desperto($ficha) ? 5 : 0;
    }

    public static function espacosDe(string $nivel): int
    {
        foreach (self::catalogo()['niveis'] as $n) {
            if ($n['id'] === $nivel) {
                return $n['espacos'];
            }
        }

        return 0;
    }

    /** @param array<string, mixed> $ficha @return array<string, mixed> */
    private static function norm(array $ficha): array
    {
        $i = array_replace(self::padrao(), $ficha['individualidades'] ?? []);
        $i['singularidades'] = array_values((array) $i['singularidades']);
        $i['defeitos'] = array_values((array) $i['defeitos']);

        return $i;
    }

    /** @param list<array<string, mixed>> $lista */
    private static function soma(array $lista, string $tipo): int
    {
        return array_sum(array_map(fn ($x) => ($it = self::item($tipo, (string) ($x['id'] ?? ''))) ? self::espacosDe($it['nivel']) : 0, $lista));
    }

    /**
     * @param  array<string, mixed>  $ficha
     * @return list<string>
     */
    public static function problemas(array $ficha): array
    {
        $i = self::norm($ficha);
        $p = [];
        foreach ([['singularidade', $i['singularidades']], ['defeito', $i['defeitos']]] as [$tipo, $lista]) {
            $ids = array_map(fn ($x) => $x['id'] ?? '', $lista);
            if (count(array_unique($ids)) !== count($ids)) {
                $p[] = ($tipo === 'singularidade' ? 'Uma Singularidade' : 'Um Defeito').' só pode ser escolhido uma vez.';
            }
            foreach ($lista as $x) {
                $it = self::item($tipo, (string) ($x['id'] ?? ''));
                if ($it === null) {
                    $p[] = 'Individualidade desconhecida.';

                    continue;
                }
                $v = trim((string) ($x['escolha'] ?? ''));
                if ($it['escolha'] === null) {
                    if ($v !== '') {
                        $p[] = "{$it['id']}: não pede escolha.";
                    }

                    continue;
                }
                if ($v === '') {
                    $p[] = "{$it['id']}: informe a escolha.";
                } elseif (mb_strlen($v) > 80) {
                    $p[] = "{$it['id']}: resposta longa demais.";
                } elseif ($it['escolha']['opcoes'] !== null && ! in_array($v, $it['escolha']['opcoes'], true)) {
                    $p[] = "{$it['id']}: opção inválida.";
                }
                if ($it['id'] === 'estudioso' && $v !== '' && ((int) ($ficha['pericias'][$v] ?? 0)) < 1) {
                    $p[] = 'Estudioso: a perícia escolhida precisa já ser proficiente.';
                }
            }
        }
        $disponiveis = $i['extras'] + self::catalogo()['espacosIniciais'];
        $usados = self::soma($i['singularidades'], 'singularidade');
        if ($usados > $disponiveis) {
            $p[] = "As Singularidades ocupam {$usados} espaços e você tem {$disponiveis}.";
        }
        if ($i['variaveis']) {
            $defeitos = self::soma($i['defeitos'], 'defeito');
            if ($defeitos !== $usados) {
                $p[] = "Defeitos Variáveis: os Defeitos somam {$defeitos} espaços e as Singularidades {$usados}; devem ser iguais.";
            }
        } else {
            foreach (self::catalogo()['niveis'] as $n) {
                $s = 0;
                foreach ($i['singularidades'] as $x) {
                    $s += (self::item('singularidade', (string) ($x['id'] ?? ''))['nivel'] ?? '') === $n['id'] ? 1 : 0;
                }
                $d = 0;
                foreach ($i['defeitos'] as $x) {
                    $d += (self::item('defeito', (string) ($x['id'] ?? ''))['nivel'] ?? '') === $n['id'] ? 1 : 0;
                }
                if ($s > $d) {
                    $p[] = 'Falta '.($s - $d)." Defeito {$n['nome']} (um Defeito de mesmo nível para cada Singularidade).";
                }
                if ($d > $s) {
                    $p[] = ($d - $s)." Defeito(s) {$n['nome']} sem Singularidade do mesmo nível.";
                }
            }
        }

        return $p;
    }

    /**
     * O que o jogador pode gravar (chamado só para o jogador).
     *
     * @param  array<string, mixed>  $antes
     * @param  array<string, mixed>  $depois
     */
    public static function conferir(array $antes, array $depois): void
    {
        $a = self::norm($antes);
        $d = self::norm($depois);
        foreach (['variaveis', 'extras', 'travada'] as $campo) {
            if ($a[$campo] !== $d[$campo]) {
                abort(403, 'Só o mestre define: '.$campo.' das Individualidades.');
            }
        }
        $inato = collect($d['singularidades'])->contains(fn ($x) => ($x['id'] ?? null) === 'haki-observacao-inato');
        if ($inato && ($antes['haki']['principal'] ?? '') !== ($depois['haki']['principal'] ?? '') && ($depois['haki']['principal'] ?? '') !== 'observacao') {
            abort(403, 'Com o Haki da Observação Inato, o Haki da Observação é o seu Haki principal.');
        }
        $mudou = $a['singularidades'] != $d['singularidades'] || $a['defeitos'] != $d['defeitos'];
        if (! $mudou) {
            return;
        }
        if ($a['travada']) {
            abort(403, 'O mestre travou as Individualidades deste personagem.');
        }
        $antigasIds = array_map(fn ($x) => $x['id'] ?? '', $a['singularidades']);
        foreach ($d['singularidades'] as $x) {
            if ((self::item('singularidade', (string) ($x['id'] ?? ''))['aprovacaoDoMestre'] ?? false) && ! in_array($x['id'], $antigasIds, true)) {
                abort(403, 'Esta Singularidade exige a aprovação do Narrador (só o mestre a concede).');
            }
        }
        $novos = array_values(array_diff(self::problemas($depois), self::problemas($antes)));
        if ($novos) {
            throw ValidationException::withMessages(['individualidades' => $novos[0]]);
        }
    }
}
