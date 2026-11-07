<?php

namespace App\Sistemas\OnePiece;

use App\Nucleo\Combate\SistemaDeCombate;
use App\Nucleo\Efeitos\Formula;
use App\Nucleo\Sistemas\Sistema;
use App\Nucleo\Sistemas\SistemaComLoja;

/** Módulo de One Piece: parte das regras do D&D 5e, com atributos, perícias, técnicas e pontos de poder próprios. */
class OnePiece implements Sistema, SistemaComLoja, SistemaDeCombate
{
    public function catalogoDeLoja(): array
    {
        $c = Itens::catalogo();

        return ['categorias' => $c['categorias'], 'raridades' => array_column($c['raridades'], 'id'), 'itens' => $c['itens']];
    }

    public function moedaDaLoja(): array
    {
        return ['campo' => 'belly', 'simbolo' => '฿'];
    }

    public function itemDaLoja(array $entrada): array
    {
        return Itens::paraAMesa($entrada);
    }

    public function entregarNoInventario(array $ficha, int $itemId, int $qtd): array
    {
        foreach ($ficha['inventario'] ?? [] as $s => $secao) {
            foreach ($secao['itens'] ?? [] as $i => $ref) {
                if ((int) ($ref['item_id'] ?? 0) === $itemId) {
                    $ficha['inventario'][$s]['itens'][$i]['qtd'] = min(100000, (int) $ref['qtd'] + $qtd);

                    return $ficha;
                }
            }
        }
        $nova = ['item_id' => $itemId, 'qtd' => $qtd, 'equipado' => false, 'sintonizado' => false];
        $inventario = $ficha['inventario'] ?? [];
        $destino = null;
        foreach ($inventario as $s => $secao) {
            if (($secao['secao'] ?? '') === 'Equipamento') {
                $destino = $s;
                break;
            }
        }
        $destino ??= $inventario ? array_key_first($inventario) : null;
        if ($destino === null) {
            $inventario[] = ['secao' => 'Equipamento', 'itens' => [$nova]];
        } else {
            $inventario[$destino]['itens'][] = $nova;
        }
        $ficha['inventario'] = $inventario;

        return $ficha;
    }

    public static function slug(): string
    {
        return 'one-piece';
    }

    public function fichaPadrao(): array
    {
        return FichaOnePiece::padrao();
    }

    public function regrasFicha(): array
    {
        return FichaOnePiece::regras();
    }

    public function variaveisDeRolagem(array $ficha, array $itens = []): array
    {
        return Regras::calcular($ficha, $itens);
    }

    public function metadadosDaRolagem(array $termos, array $variaveis, array $itens = [], array $ficha = []): array
    {
        return Regras::metadadosDaRolagem($termos, $variaveis, $itens, $ficha);
    }

    public function itensReferenciados(array $ficha): array
    {
        $ids = [];
        foreach ($ficha['inventario'] ?? [] as $secao) {
            foreach ($secao['itens'] ?? [] as $ref) {
                if (isset($ref['item_id'])) {
                    $ids[(int) $ref['item_id']] = true;
                }
            }
        }

        return array_keys($ids);
    }

    public function semItem(array $ficha, int $itemId): array
    {
        foreach ($ficha['inventario'] ?? [] as $s => $secao) {
            $ficha['inventario'][$s]['itens'] = array_values(array_filter($secao['itens'] ?? [], fn ($ref) => (int) ($ref['item_id'] ?? 0) !== $itemId));
        }

        return $ficha;
    }

    /** Ação padrão (ataques), poderosa (só técnicas), bônus, livre e reação (1 por rodada, pode ser usada fora do turno). */
    public function categoriasDeAcao(): array
    {
        return [
            ['id' => 'padrao', 'nome' => 'Ação', 'porTurno' => 1, 'porRodada' => null, 'soNoTurno' => true],
            ['id' => 'poderosa', 'nome' => 'Ação poderosa', 'porTurno' => 1, 'porRodada' => null, 'soNoTurno' => true, 'soTecnicas' => true],
            ['id' => 'bonus', 'nome' => 'Ação bônus', 'porTurno' => 1, 'porRodada' => null, 'soNoTurno' => true],
            ['id' => 'livre', 'nome' => 'Ação livre', 'porTurno' => null, 'porRodada' => null, 'soNoTurno' => true],
            ['id' => 'reacao', 'nome' => 'Reação', 'porTurno' => null, 'porRodada' => 1, 'soNoTurno' => false],
        ];
    }

    public function iniciativa(array $ficha): string
    {
        return '1d20+@iniciativa';
    }

    public function deslocamentoDoTurno(array $ficha, array $variaveis): float
    {
        return ((float) ($variaveis['movimento.normal'] ?? ($ficha['movimento']['normal'] ?? 9) * 10)) / 10;
    }

    /**
     * Reações vêm da ficha: técnicas (e da Akuma) e características com `reacao: {gatilho, alcance, defesa?, cura?}`. Técnica
     * custa PP (sem PP não é oferecida); característica com usos gasta um.
     */
    public function ofertasDeReacao(string $gatilho, array $contexto, array $ficha, array $variaveis): array
    {
        $ofertas = [];
        $nivel = (int) ($ficha['nivel'] ?? 1);
        $monta = function (string $id, array $dados, array $custo) use ($gatilho, &$ofertas, $variaveis) {
            $r = $dados['reacao'] ?? null;
            if (! is_array($r) || ($r['gatilho'] ?? null) !== $gatilho) {
                return;
            }
            $ofertas[] = [
                // `categoria`: a reação gasta a categoria `reacao` (a do turno); algumas (Aparar Aprimorado) gastam outra, como `livre`
                'id' => $id, 'rotulo' => $dados['nome'] ?? 'Reação', 'descricao' => $dados['descricao'] ?? '', 'categoria' => $r['categoria'] ?? 'reacao',
                'alcance' => $r['alcance'] ?? 'si', 'cura' => $r['cura'] ?? null, 'custo' => $custo,
                // `defesa` é um número ou uma fórmula da ficha de quem reage (ex.: `@prof-floor(@prof/2)`)
                'efeitos' => isset($r['defesa']) ? [['alvo' => 'defesa', 'modo' => 'soma', 'valor' => is_numeric($r['defesa']) ? (int) $r['defesa'] : (int) Formula::avaliar((string) $r['defesa'], $variaveis)]] : [],
            ];
        };
        foreach (['t' => $ficha['tecnicas']['lista'] ?? [], 'a' => $ficha['akuma']['lista'] ?? []] as $tipo => $lista) {
            foreach ($lista as $i => $t) {
                if ((int) ($t['custo'] ?? 0) <= (int) ($ficha['pp']['atual'] ?? 0)) {
                    $monta("{$tipo}:{$i}", $t, ['pp' => (int) ($t['custo'] ?? 0)]);
                }
            }
        }
        foreach ($ficha['caracteristicas'] ?? [] as $i => $c) {
            if (! Regras::ativaNoNivel($c, $nivel) || Regras::hakiDesligado($c, $ficha)) {
                continue;
            }
            if (! isset($c['usos']) || (int) $c['usos']['atual'] > 0) {
                $monta("c:{$i}", $c, isset($c['usos']) ? ['uso' => 1] : []);
            }
        }

        return $ofertas;
    }

    public function pagarReacao(array $ficha, array $oferta): array
    {
        [$tipo, $i] = explode(':', (string) $oferta['id']);
        if ($tipo === 'c') {
            $lista = $ficha['caracteristicas'] ?? [];
            if (isset($lista[(int) $i]['usos'])) {
                $lista[(int) $i]['usos']['atual'] = max(0, (int) $lista[(int) $i]['usos']['atual'] - 1);
            }

            return ['caracteristicas' => $lista];
        }

        return ($oferta['custo']['pp'] ?? 0) > 0 ? ['pp.atual' => max(0, (int) ($ficha['pp']['atual'] ?? 0) - (int) $oferta['custo']['pp'])] : [];
    }

    /**
     * Os Pontos de Escudo resistem a este tipo de dano? Cortante, Perfurante e Contundente sempre (Endurecimento Defensivo);
     * com "Corpo Armadurado" na Forma Dominada ativo, a todos exceto Verdadeiro.
     */
    public function escudoResiste(array $ficha, ?string $tipo): bool
    {
        $tipo = \App\Nucleo\Combate\Dano::normalizar($tipo);
        if ($tipo === 'verdadeiro') {
            return false;
        }
        if (in_array($tipo, ['cortante', 'perfurante', 'contundente'], true)) {
            return true;
        }
        $formas = array_column($ficha['haki']['talentos'] ?? [], 'formas', 'id')['corpo-armadurado'] ?? 0;
        $ativo = collect($ficha['caracteristicas'] ?? [])->contains(fn ($c) => str_starts_with((string) ($c['nome'] ?? ''), 'Corpo Armadurado') && ($c['ativa'] ?? false) === true);

        return $formas >= 2 && $ativo;
    }

    /**
     * Treinamentos: o jogador só faz e cancela PEDIDOS (o mestre conclui). `extras` e `aprendidos` não mudam por ele; um pedido
     * novo precisa caber nos PT livres e nos requisitos; os dias de um pedido existente são do mestre.
     */
    private function conferirTreinamentos(array $antes, array $depois): void
    {
        $a = array_replace(Treinamentos::padrao(), $antes['treinamento'] ?? []);
        $d = array_replace(Treinamentos::padrao(), $depois['treinamento'] ?? []);
        if ($a['extras'] !== $d['extras'] || $a['aprendidos'] !== $d['aprendidos']) {
            abort(403, 'Só o mestre muda os PT e conclui treinamentos.');
        }
        $chave = fn (array $p) => $p['id'].'|'.($p['opcao'] ?? '');
        $antigos = [];
        foreach ($a['pedidos'] as $p) {
            $antigos[$chave($p)] = (int) $p['dias'];
        }
        $corrente = $antes;
        foreach ($d['pedidos'] as $p) {
            if (array_key_exists($chave($p), $antigos)) {
                if ($antigos[$chave($p)] !== (int) $p['dias']) {
                    abort(403, 'Só o mestre marca os dias de treino.');
                }
                continue;
            }
            if ((int) $p['dias'] !== 0) {
                abort(403, 'Um pedido novo começa com 0 dia.');
            }
            $problemas = Treinamentos::problemasDoPedido($corrente, $p['id'], $p['opcao'] ?? null);
            if ($problemas) {
                throw \Illuminate\Validation\ValidationException::withMessages(['campos.treinamento.pedidos' => $problemas[0]]);
            }
            $corrente['treinamento'] = [...$a, 'pedidos' => [...($corrente['treinamento']['pedidos'] ?? []), $p]];
        }
    }

    /** Fim do combate: os Pontos de Escudo renovam (10 minutos fora de combate). Devolve os campos a salvar, se houver. */
    public function aoEncerrarCombate(array $ficha): array
    {
        $max = (int) (Regras::calcular($ficha, [])['escudo.max'] ?? 0);

        return $max > 0 && (int) ($ficha['pv']['escudo'] ?? 0) < $max ? ['pv.escudo' => $max] : [];
    }

    /**
     * Campos que só o mestre grava e compras a conferir (chamado pelo `FichaController` antes de salvar). Haki: liberar o
     * Haki e o Haki do Rei, o despertar prematuro e os PA dados (gerais e restritos) são do mestre; o jogador só compra
     * talentos (sem devolver) e escolhe Haki Principal e afinidade, e a compra tem de caber no saldo e nos requisitos.
     */
    public function conferirFicha(array $antes, array $depois, bool $mestre): void
    {
        if ($mestre) {
            return;
        }
        $this->conferirTreinamentos($antes, $depois);
        Profissoes::conferir($antes, $depois);
        if (empty($antes['akuma']['despertada']) && ! empty($depois['akuma']['despertada'])) {
            abort(403, 'Só o mestre desperta a Akuma no Mi.');
        }
        Akuma::conferir($antes, $depois);
        Individualidades::conferir($antes, $depois);
        Criador::conferirGenialidades($depois);
        Criador::conferir($antes, $depois);
        $a = array_replace_recursive(Haki::padrao(), $antes['haki'] ?? []);
        $d = array_replace_recursive(Haki::padrao(), $depois['haki'] ?? []);
        foreach (['liberado', 'rei', 'prematuroNivel', 'extras', 'restritos'] as $campo) {
            if ($a[$campo] !== $d[$campo]) {
                abort(403, 'Só o mestre muda isso no Haki.');
            }
        }
        if ($a['talentos'] === $d['talentos']) {
            return;
        }
        $formasAntes = array_column($a['talentos'], 'formas', 'id');
        $formasDepois = array_column($d['talentos'], 'formas', 'id');
        foreach ($formasAntes as $id => $formas) {
            if (($formasDepois[$id] ?? 0) < $formas) {
                abort(403, 'Só o mestre devolve talentos do Haki.');
            }
        }
        $problemas = Haki::problemas($depois);
        if ($problemas) {
            throw \Illuminate\Validation\ValidationException::withMessages(['campos.haki.talentos' => $problemas[0]]);
        }
    }

    /**
     * Superioridade Absoluta: depois do cálculo do dano, se os PV que sobram no alvo forem iguais ou menores que o nível do
     * atacante (mais o bônus acumulado), o alvo cai a 0 e o atacante ganha +5 de bônus (máximo +15) até o fim do encontro.
     * Devolve os campos a salvar no atacante, ou null se a característica não age.
     *
     * @return array{campos: array<string, mixed>}|null
     */
    public function execucao(array $fichaAtacante, int $pvDepois): ?array
    {
        $nivel = (int) ($fichaAtacante['nivel'] ?? 1);
        $tem = collect($fichaAtacante['caracteristicas'] ?? [])->contains(fn ($c) => ($c['hb'] ?? null) === 'superioridade-absoluta' && Regras::ativaNoNivel($c, $nivel));
        $bonus = (int) ($fichaAtacante['bonusExecucao'] ?? 0);
        if (! $tem || $pvDepois <= 0 || $pvDepois > $nivel + $bonus) {
            return null;
        }

        return ['campos' => ['bonusExecucao' => min(15, $bonus + 5)]];
    }

    public function categoriaDaDisparada(): ?string
    {
        return 'padrao';
    }

    public function defesa(array $variaveis): int
    {
        return (int) ($variaveis['ca'] ?? 10);
    }

    /** Catálogo de condições do sistema (id, nome, descrição, efeitos): usado ao aplicar condições a um alvo. */
    public function condicoes(): array
    {
        return Condicoes::catalogo();
    }

    public function regrasItem(): array
    {
        return FichaOnePiece::regrasItem();
    }

    public function alvosDeEfeito(): array
    {
        return FichaOnePiece::alvosDeEfeito();
    }
}
