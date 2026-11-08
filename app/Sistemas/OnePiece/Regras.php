<?php

namespace App\Sistemas\OnePiece;

use App\Nucleo\Combate\Dano;
use App\Nucleo\Efeitos\Efeitos;
use App\Nucleo\Rolagem\Rolador;

/**
 * Regras derivadas da ficha de One Piece (a base é a do D&D 5e). ESPELHA `resources/js/app/sistemas/onepiece/regras.ts` (o cliente mostra
 * ao vivo, o servidor decide as rolagens): qualquer mudança aqui tem de ser feita nos dois e é
 * conferida pelos casos de `tests/paridade/onepiece.json`, que rodam nas duas implementações.
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

    /** O que o jogador ajusta numa arma só na própria ficha (`inventario.*.itens.*.arma`). Espelha `AjusteDeArma` (TS). */
    public const AJUSTES_DA_ARMA = ['dano', 'tipoDano', 'atributo', 'atributoDano', 'bonusAtaque', 'bonusDano', 'margemCritica', 'danoExtra'];

    /**
     * Os itens da mesa com os ajustes de arma DESTA ficha aplicados (o item original nunca muda). `dano` não vale em arma por munição.
     * Espelha `itensComAjustes` (TS).
     *
     * @param  array<string, mixed>  $f
     * @param  array<int, array>  $itens
     * @return array<int, array>
     */
    public static function comAjustes(array $f, array $itens): array
    {
        foreach ($f['inventario'] ?? [] as $secao) {
            foreach (is_array($secao) ? ($secao['itens'] ?? []) : [] as $ref) {
                $aj = is_array($ref) ? ($ref['arma'] ?? null) : null;
                $id = (int) ($ref['item_id'] ?? 0);
                $arma = $itens[$id]['dados']['arma'] ?? null;
                if (! is_array($aj) || ! is_array($arma)) {
                    continue;
                }
                foreach (self::AJUSTES_DA_ARMA as $campo) {
                    if (($aj[$campo] ?? null) === null || ($campo === 'dano' && ! empty($arma['municao']))) {
                        continue;
                    }
                    $arma[$campo] = $aj[$campo];
                }
                $itens[$id]['dados']['arma'] = $arma;
            }
        }

        return $itens;
    }

    /**
     * A ficha tem a característica (pelo nome, que pode vir com prefixo: "Whip and Gun: Pistola") valendo agora: no nível certo e, se for ativa, ligada.
     *
     * @param  array<string, mixed>  $f
     */
    public static function temCaracteristica(array $f, string $nome): bool
    {
        $nivel = (int) ($f['nivel'] ?? 1);
        foreach ($f['caracteristicas'] ?? [] as $c) {
            if (str_contains((string) ($c['nome'] ?? ''), $nome) && self::ativaNoNivel($c, $nivel) && (($c['tipo'] ?? 'passiva') !== 'ativa' || ($c['ativa'] ?? false) === true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Golpe Moral (Aventureiro): ataques com chicote ignoram resistência a dano Cortante e causam metade do dano em invulnerabilidades (de qualquer tipo).
     *
     * @param  array<string, mixed>  $f
     * @return list<string> o que passa por cima no cálculo do dano (`Dano::calcular`)
     */
    public static function golpeMoral(array $f, ?string $tipoDano): array
    {
        if (! self::temCaracteristica($f, 'Whip and Gun: Chicote')) {
            return [];
        }

        return str_contains(Dano::normalizar((string) $tipoDano), 'cortante') ? ['resistencia', 'imunidade_metade'] : ['imunidade_metade'];
    }

    /**
     * O dano de Fogo do Black Leg: Ifrit Jambe (ligado) ignora a resistência a Fogo; Hell Memories ignora a invulnerabilidade e faz o alvo sem resistência
     * nem invulnerabilidade sofrer como se fosse vulnerável. Só vale para o tipo Fogo.
     *
     * @param  array<string, mixed>  $f
     * @return list<string>
     */
    public static function fogoDoBlackLeg(array $f, ?string $tipoDano): array
    {
        if (! str_contains(Dano::normalizar((string) $tipoDano), 'fogo')) {
            return [];
        }
        $ignora = [];
        if (self::temCaracteristica($f, 'Ifrit Jambe')) {
            $ignora[] = 'resistencia';
        }
        if (self::temCaracteristica($f, 'Hell Memories')) {
            array_push($ignora, 'imunidade', 'vulneravel_se_nao_resiste');
        }

        return $ignora;
    }

    /** `golpeMoral` para uma Técnica com chicote como requisito (a Técnica tem de estar na ficha). */
    public static function golpeMoralDaTecnica(array $f, string $nomeTecnica, ?string $tipoDano): array
    {
        foreach ($f['tecnicas']['lista'] ?? [] as $t) {
            if (($t['nome'] ?? null) === $nomeTecnica && stripos((string) ($t['descricao'] ?? ''), 'Requisito: chicote') !== false) {
                return self::golpeMoral($f, $tipoDano);
            }
        }

        return [];
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

    /** A característica vale neste nível? Sem `nivelMin`/`nivelMax` vale sempre. */
    /** Características do Haki só valem com o interruptor "Haki ativo" ligado. */
    public static function hakiDesligado(array $c, array $ficha): bool
    {
        return ($c['builder'] ?? null) === 'haki' && empty($ficha['haki']['ativo']);
    }

    public static function ativaNoNivel(array $c, int $nivel): bool
    {
        return $nivel >= (int) ($c['nivelMin'] ?? 1) && $nivel <= (int) ($c['nivelMax'] ?? 99);
    }

    /** Os tamanhos de dado, em ordem, para o "aumento em um passo" (1d4 → 1d6 → 1d8 → 1d10 → 1d12). */
    public const DEGRAUS = [4, 6, 8, 10, 12];

    /**
     * Sobe os dados da expressão `$passos` degraus (`1d8` + 1 → `1d10`; no 1d12 para). Só os dados `NdM` mudam; números e
     * variáveis ficam. Espelha `degrau` em `regras.ts`.
     */
    public static function degrau(string $expressao, int $passos): string
    {
        if ($passos <= 0) {
            return $expressao;
        }

        return (string) preg_replace_callback('/(\d+)d(\d+)/i', function (array $m) use ($passos) {
            $i = array_search((int) $m[2], self::DEGRAUS, true);

            return $i === false ? $m[0] : $m[1].'d'.self::DEGRAUS[min(count(self::DEGRAUS) - 1, $i + $passos)];
        }, $expressao);
    }

    /**
     * Efeitos ativos da ficha: itens (na ordem do inventário), características (ativas ou passivas, na ordem salva),
     * condições, depois os ajustes manuais (soma).
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

        // Características com buffs: a passiva sempre vale; a ativa, só ligada (ex.: Fúria, Aura de Proteção).
        // Uma característica de nível (`nivelMin`/`nivelMax`, ex.: as faixas das Habilidades Básicas) só vale dentro da faixa.
        foreach ($f['caracteristicas'] ?? [] as $c) {
            if (! self::ativaNoNivel($c, (int) ($f['nivel'] ?? 1)) || self::hakiDesligado($c, $f)) {
                continue;
            }
            $vale = ($c['tipo'] ?? 'passiva') === 'passiva' || ($c['ativa'] ?? false) === true;
            if ($vale && ! empty($c['efeitos'])) {
                array_push($efeitos, ...Efeitos::deFonte((string) ($c['nome'] ?? 'Característica'), $c['efeitos']));
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
        foreach (FichaOnePiece::ATRIBUTOS as $a) {
            $manuais["salv.{$a}"] = $aj['salvaguardas'][$a] ?? 0;
        }
        foreach (array_keys(FichaOnePiece::PERICIAS) as $p) {
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
     * pp.max, xp.proximo, dv.max, treinamento.pontos e, por arma ativa, arma.<item_id>.ataque / .dano / .margem.
     * Tolerante a chaves ausentes (ficha salva antes de um campo existir): usa 0.
     *
     * @param  array<int, array>  $itens  itens da mesa por id (`Item::paraFront()`)
     * @return array<string, int|float>
     */
    public static function calcular(array $f, array $itens = []): array
    {
        $itens = self::comAjustes($f, $itens);
        $efeitos = self::efeitosAtivos($f, $itens);
        $nivel = (int) $f['nivel'];
        $prof = 2 + intdiv($nivel - 1, 4) + ($f['ajustes']['proficiencia'] ?? 0);
        $r = ['nivel' => $nivel, 'prof' => $prof];

        // Fase 1: atributos efetivos
        $mod = [];
        foreach (FichaOnePiece::ATRIBUTOS as $a) {
            $r["atributos.{$a}"] = Efeitos::aplicar("atributos.{$a}", $f['atributos'][$a], $efeitos, ['nivel' => $nivel])['valor'];
            $mod[$a] = self::modificador($r["atributos.{$a}"]);
            $r["mod.{$a}"] = $mod[$a];
        }

        // Fase 2: valores-base
        $base = [];
        foreach (FichaOnePiece::ATRIBUTOS as $a) {
            $base["salv.{$a}"] = $mod[$a] + (in_array($a, $f['salvaguardas'], true) ? $prof : 0);
        }
        // Teste de atributo: o modificador; os efeitos somam bônus e o botão do atributo rola `@teste.<atr>`.
        foreach (FichaOnePiece::ATRIBUTOS as $a) {
            $base["teste.{$a}"] = $mod[$a];
        }
        // Haki Treinado (21+ PA distribuídos) dá proficiência na perícia Haki
        $estagioHaki = Haki::estagio($f);
        foreach (FichaOnePiece::PERICIAS as $p => $atributo) {
            $nivelProf = $p === 'haki' && $estagioHaki >= 2 ? max(1, $f['pericias'][$p] ?? 0) : ($f['pericias'][$p] ?? 0);
            $base["pericia.{$p}"] = $mod[$atributo] + $nivelProf * $prof;
        }
        $conjuracao = $mod[$f['tecnicas']['atributo']];
        $base['iniciativa'] = $mod['des'];
        $base['ca'] = 10 + $mod['des'];
        $base['cd'] = 8 + $prof + $conjuracao;
        $base['ataque'] = $prof + $conjuracao;
        $base['ataque.arma'] = 0;
        $base['dano.arma'] = 0;
        $base['carga.max'] = 15 * $r['atributos.for'];
        $base['pv.max'] = $f['pv']['max'] ?? 0;
        $base['pp.max'] = $nivel * ($f['pp']['porNivel'] ?? 4);
        // Pontos de Escudo (Endurecimento Defensivo): o máximo vem dos efeitos; sem o talento é 0
        $base['escudo.max'] = 0;
        // Alcance corpo a corpo e deslocamentos em decímetros (15 = 1,5 m): efeitos e fórmulas só trabalham com inteiros.
        $base['alcance.corpo'] = 15;
        foreach (['normal', 'nado', 'escalada', 'voo'] as $tipo) {
            $base["movimento.{$tipo}"] = (int) round(($f['movimento'][$tipo] ?? 0) * 10);
        }
        $base['dano.distancia.pct'] = 100;
        // Passos de dado (Mira Treinada, Força Magnífica, Perito em Técnicas...), margem de crítico por tipo de arma e ataque desarmado
        foreach (['corpo', 'distancia', 'desarmado', 'tecnica'] as $p) {
            $base["passo.{$p}"] = 0;
        }
        $base['margem.corpo'] = 20;
        $base['margem.distancia'] = 20;
        // Ataques da Ação "Atacar": 1 + Ataque Extra e afins; os extras à distância só valem para armas à distância
        $base['ataques.acao'] = 1;
        $base['ataques.distancia'] = 0;
        $base['ataque.desarmado'] = $prof + $mod['for'];
        $base['dano.desarmado'] = $mod['for'];

        // Fase 3: efeitos sobre os valores-base (as fórmulas veem a fase 2)
        $variaveis = $r + $base;
        foreach ($base as $chave => $valor) {
            $r[$chave] = Efeitos::aplicar($chave, $valor, $efeitos, $variaveis)['valor'];
        }
        foreach (array_keys(FichaOnePiece::PERICIAS) as $p) {
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
                if ($item === null || ! is_array($arma) || ! self::ativo($ref, $item) || ! self::armaCabe($arma, $f['tamanho'] ?? 'Médio')) {
                    continue;
                }
                // Ataque e dano podem usar atributos diferentes; sem `atributoDano`, o dano usa o mesmo do ataque.
                $mAtaque = self::modificadorDaArma($arma['atributo'], $mod);
                $mDano = self::modificadorDaArma($arma['atributoDano'] ?? $arma['atributo'], $mod);
                // Bônus simples de acerto e de dano, separados; armas antigas (só `bonusMagico`) usam o mesmo nos dois.
                // Meito: +1/+2/+3 no acerto corpo a corpo (prevalece o maior entre a forja e o bônus que a arma já tinha)
                $bonusAtaque = max($arma['bonusAtaque'] ?? $arma['bonusMagico'] ?? 0, ($arma['distancia'] ?? false) ? 0 : Forja::bonusDeAtaque($arma['forja'] ?? null));
                $bonusDano = $arma['bonusDano'] ?? $arma['bonusMagico'] ?? 0;
                $id = (int) $ref['item_id'];
                $r["arma.{$id}.ataque"] = $mAtaque + (($arma['proficiente'] ?? false) ? $prof : 0) + $bonusAtaque + $r['ataque.arma'];
                $r["arma.{$id}.dano"] = $mDano + $bonusDano + $r['dano.arma'];
                // d20 puro igual ou maior que isto é crítico: a margem da arma ou a do tipo (Crítico Marcial: 19), a menor
                $r["arma.{$id}.margem"] = min($arma['margemCritica'] ?? 20, ($arma['distancia'] ?? false) ? 20 : Forja::margem($arma['forja'] ?? null), $r[($arma['distancia'] ?? false) ? 'margem.distancia' : 'margem.corpo']);
            }
        }

        $peso = 0;
        foreach ($f['inventario'] as $secao) {
            foreach ($secao['itens'] as $ref) {
                $peso += $ref['qtd'] * ($itens[$ref['item_id']]['peso'] ?? 0); // item removido da mesa não pesa
            }
        }

        return $r + [
            'carga.atual' => round($peso, 2),
            'xp.proximo' => self::XP_PROXIMO[min(max($nivel, 1), 20)],
            'dv.max' => $nivel,
            'treinamento.pontos' => max(0, $mod['sab']), // Traços Culturais: pontos de treinamento = mod. SAB positivo
        ];
    }

    /** Há uma arma Saijo Ô Wazamono equipada (a que rola o dano das Técnicas com arma cortante duas vezes)? */
    public static function saijoEquipada(array $f, array $itens): bool
    {
        foreach ($f['inventario'] ?? [] as $secao) {
            foreach ($secao['itens'] ?? [] as $ref) {
                $item = $itens[$ref['item_id']] ?? null;
                $arma = $item['dados']['arma'] ?? null;
                if ($item !== null && is_array($arma) && self::ativo($ref, $item) && self::armaCabe($arma, $f['tamanho'] ?? 'Médio') && ($arma['forja']['meito'] ?? null) === 'saijo-o-wazamono') {
                    return true;
                }
            }
        }

        return false;
    }

    /** Dados adicionais da Meito equipada nas Técnicas com arma cortante como requisito (o maior entre as armas equipadas). */
    public static function dadosExtrasDeMeito(array $f, array $itens): int
    {
        $n = 0;
        foreach ($f['inventario'] ?? [] as $secao) {
            foreach ($secao['itens'] ?? [] as $ref) {
                $item = $itens[$ref['item_id']] ?? null;
                $arma = $item['dados']['arma'] ?? null;
                if ($item === null || ! is_array($arma) || ! self::ativo($ref, $item) || ! self::armaCabe($arma, $f['tamanho'] ?? 'Médio')) {
                    continue;
                }
                $n = max($n, Forja::dadosDeTecnica($arma['forja'] ?? null));
            }
        }

        return $n;
    }

    /** O gigante (tamanho Enorme) só usa armas de gigante, e nenhum outro tamanho usa a arma de um gigante. */
    public static function armaCabe(array $arma, string $tamanho): bool
    {
        return ($arma['tamanho'] ?? 'padrao') === 'gigante' ? $tamanho === 'Enorme' : $tamanho !== 'Enorme';
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
     * Num ataque com arma o card do chat também oferece o DANO: um botão "Dano" (`1d8+3d6+4`: o dado da arma, os dados
     * extras — da própria arma e dos buffs, como o Ataque Furtivo — e o bônus fixo) e, se o ataque foi crítico, "Dano
     * crítico" (`2d8+6d6+4`: TODOS os dados dobram; o bônus fixo entra uma vez) em destaque, com o normal ao lado.
     * Falha crítica (1 natural) erra sempre: não oferece dano.
     *
     * @param  list<array>  $termos
     * @param  array<int, array>  $itens
     * @param  array<string, mixed>  $ficha  a ficha do personagem (para os dados extras dos buffs)
     * @return array<string, mixed>
     */
    public static function metadadosDaRolagem(array $termos, array $variaveis, array $itens = [], array $ficha = [], ?array $municao = null, int $rodada = 1): array
    {
        $itens = self::comAjustes($ficha, $itens);
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

        $dados = self::dadosDeDano($ficha, $itens, $arma, $variaveis, $municao);
        // Tiro Sem Paciência (ligado): +1 dado de munição por rodada do encontro, até 2 × nível (máx. 30)
        if ($municao && $dados !== [] && self::temCaracteristica($ficha, 'Tiro Sem Paciência')) {
            $extra = max(0, min($rodada, 2 * (int) ($ficha['nivel'] ?? 1), 30));
            if ($extra > 0 && preg_match('/^\d+d\d+$/', (string) $municao['dano'])) {
                $meta['tiroSemPaciencia'] = $extra;
                array_push($dados, ...array_fill(0, $extra, $municao['dano']));
            }
        }
        // Tiro Oportunista (pistola): no crítico os dados rolam 3 vezes, não 2
        $multiplicador = (($itens[$arma]['dados']['catalogo']['id'] ?? null) === 'pistola' && self::temCaracteristica($ficha, 'Whip and Gun: Pistola')) ? 3 : 2;
        // A munição gasta e o revestimento aparecem no card mesmo no 1 natural (a munição foi gasta); o botão do efeito só vale no acerto
        if ($municao) {
            $meta['municao'] = ['id' => $municao['id'], 'nome' => $municao['nome'], 'nota' => $municao['nota'],
                // o que a munição faz ao acertar: o card oferece o botão (Enfraquecido, explosão)
                ...(in_array($municao['id'], ['bola-explosiva', 'municao-de-kairoseki'], true) ? ['efeito' => $municao['id'] === 'bola-explosiva' ? 'explosao' : 'kairoseki'] : [])];
        }
        // Arma revestida de Kairoseki (Ferreiro): cada acerto oferece o Enfraquecido (a munição escolhida, se houver, continua valendo no dano)
        if (($itens[$arma]['dados']['arma']['melhoria'] ?? null) === 'kairoseki' && ! isset($meta['municao']['efeito'])) {
            $meta['municao'] = [...($meta['municao'] ?? ['id' => 'revestimento-kairoseki', 'nome' => 'Revestimento de Kairoseki', 'nota' => '']), 'efeito' => 'kairoseki',
                'nota' => trim(($meta['municao']['nota'] ?? '').' Arma revestida de Kairoseki: ao acertar um usuário de Akuma no Mi, ele fica Enfraquecido até o fim do próximo turno.')];
        }
        if ($dados !== [] && isset($variaveis["arma.{$arma}.dano"]) && ($meta['destaque'] ?? null) !== 'falha') {
            $nome = (string) ($itens[$arma]['nome'] ?? 'Arma');
            $bonus = $variaveis["arma.{$arma}.dano"];
            // O tipo do dano da arma segue com o botão: a rolagem de dano carrega o tipo para o dano aplicado respeitar resistências.
            $tipoDano = ($municao['tipo'] ?? $itens[$arma]['dados']['arma']['tipoDano'] ?? null) ?: null;
            // Arma à distância do anão (Armas Reduzidas): o dano TOTAL sai pela metade (fator aplicado no dano aplicado ao alvo).
            $fator = ($itens[$arma]['dados']['arma']['distancia'] ?? false) ? max(0, (int) ($variaveis['dano.distancia.pct'] ?? 100)) / 100 : 1;
            $acao = function (string $id, string $rotulo, array $termos, string $rotuloRolagem) use ($arma, $bonus, $tipoDano, $fator) {
                $dados = implode('+', $termos);

                return [
                    'id' => $id, 'rotulo' => $rotulo, 'resumo' => $dados.($bonus > 0 ? "+{$bonus}" : ($bonus < 0 ? (string) $bonus : '')),
                    'expressao' => "{$dados}+@arma.{$arma}.dano", 'rotuloRolagem' => $rotuloRolagem, 'dano' => ['tipo' => $tipoDano, ...($fator !== 1 ? ['fator' => $fator] : [])],
                ];
            };
            // O crítico dobra todos os dados: se dobrados passariam do limite do rolador, os extras que sobram ficam de fora.
            $dados = self::cabemDobrados($dados);
            $normal = $acao('dano', 'Dano', $dados, $nome);
            $meta['acoes'] = ($meta['destaque'] ?? null) === 'critico'
                ? [
                    [...$acao('dano-critico', 'Dano crítico', array_map(fn ($d) => self::multiplicarDados($d, $multiplicador), $dados), $nome), 'destaque' => 'critico'],
                    [...$normal, 'rotulo' => 'Dano normal'],
                ]
                : [$normal];

            // Expertise: no acerto crítico natural, com proficiência na arma. O texto do efeito vai no card; o dano extra (dados) e
            // o dano máximo viram botões. Os efeitos sobre condições e movimento ficam para o jogador e o Narrador aplicarem.
            $armaDados = $itens[$arma]['dados']['arma'] ?? [];
            if (($meta['destaque'] ?? null) === 'critico' && ! empty($armaDados['proficiente'])) {
                foreach ($armaDados['forja']['expertise'] ?? [] as $idExp) {
                    $e = Forja::expertise($idExp);
                    if (! $e) {
                        continue;
                    }
                    $meta['expertise'][] = ['id' => $e['id'], 'texto' => $e['texto']];
                    if (! empty($e['dados'])) {
                        $meta['acoes'][] = [
                            'id' => "expertise-{$e['id']}", 'rotulo' => "Expertise: +{$e['dados']}", 'resumo' => $e['dados'], 'expressao' => $e['dados'],
                            'rotuloRolagem' => "{$nome} (Expertise)", 'dano' => ['tipo' => $e['tipoDano'] ?? $tipoDano],
                        ];
                    }
                    if (! empty($e['maximizar'])) {
                        $maximo = array_sum(array_map(fn ($d) => preg_match('/^(\d+)d(\d+)$/', $d, $m) ? (int) $m[1] * (int) $m[2] : 0, $dados));
                        $meta['acoes'][] = [
                            'id' => 'expertise-maximizar', 'rotulo' => 'Expertise: dano máximo', 'resumo' => (string) ($maximo + $bonus), 'expressao' => "{$maximo}+@arma.{$arma}.dano",
                            'rotuloRolagem' => "{$nome} (dados maximizados)", 'dano' => ['tipo' => $tipoDano],
                        ];
                    }
                }
            }
        }

        return $meta;
    }

    /**
     * Todos os dados do dano de uma arma, em ordem: o da arma, os extras DA ARMA (`danoExtra`, ex.: +2d6 de fogo) e os
     * extras dos buffs ativos (efeitos de modo `dados` em `dano.arma`: Ataque Furtivo, itens, características).
     * Vazio se o item não é arma.
     *
     * @param  array<string, mixed>  $f
     * @param  array<int, array>  $itens
     * @return list<string>
     */
    public static function dadosDeDano(array $f, array $itens, int $itemId, array $variaveis = [], ?array $municao = null): array
    {
        $arma = $itens[$itemId]['dados']['arma'] ?? null;
        // arma por munição: o dado base é o da munição escolhida (sem ela não há dano)
        if (is_array($arma) && ! empty($arma['municao'])) {
            if (! $municao) {
                return [];
            }
            $arma['dano'] = $municao['dano'];
            $arma['forja'] = null;
        }
        if (! is_array($arma) || ! is_string($arma['dano'] ?? null)) {
            return [];
        }

        // O dado da arma sobe os degraus do tipo dela (corpo a corpo ou à distância); os extras não
        $passos = (int) ($variaveis[($arma['distancia'] ?? false) ? 'passo.distancia' : 'passo.corpo'] ?? 0);
        $dados = [self::degrau(Forja::danoComForja($arma['dano'], $arma['forja'] ?? null), $passos)];
        foreach ($arma['danoExtra'] ?? [] as $extra) {
            if (Efeitos::dadosValidos($extra['dados'] ?? null)) {
                $dados[] = $extra['dados'];
            }
        }
        foreach (self::efeitosAtivos($f, $itens) as $e) {
            if ($e['modo'] === 'dados' && Efeitos::casa($e['alvo'], 'dano.arma') && Efeitos::dadosValidos($e['valor'] ?? null)) {
                $dados[] = $e['valor'];
            }
        }

        return $dados;
    }

    /**
     * Mantém os dados (o da arma sempre, depois os extras na ordem) enquanto a soma DOBRADA couber no limite do rolador.
     *
     * @param  list<string>  $dados
     * @return list<string>
     */
    private static function cabemDobrados(array $dados): array
    {
        $saida = [];
        $total = 0;
        foreach ($dados as $i => $d) {
            $quantidade = (int) $d;
            if ($i > 0 && ($total + $quantidade) * 2 > Rolador::MAX_DADOS_TOTAL) {
                continue;
            }
            $saida[] = $d;
            $total += $quantidade;
        }

        return $saida;
    }

    /** Dados do item dobrados para o crítico (`1d8` → `2d8`); formato inesperado volta como está. */
    /** Dobra a quantidade de dados de uma expressão (`3d10+2` → `6d10+2`; `d8` → `2d8`): o acerto crítico. O bônus fixo não dobra. */
    public static function dobrarDadosDaExpressao(string $expressao): string
    {
        return preg_replace_callback('/(\d*)d(\d+)/i', fn ($m) => (($m[1] === '' ? 1 : (int) $m[1]) * 2).'d'.$m[2], $expressao) ?? $expressao;
    }

    private static function dobrarDados(string $dano): string
    {
        return self::multiplicarDados($dano, 2);
    }

    /** `n` vezes a quantidade de dados (`1d8` × 3 = `3d8`); formato inesperado volta como está. */
    private static function multiplicarDados(string $dano, int $n): string
    {
        return preg_match('/^(\d+)d(\d+)$/', $dano, $m) ? ((int) $m[1] * $n).'d'.$m[2] : $dano;
    }
}
