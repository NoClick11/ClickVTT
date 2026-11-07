<?php

namespace App\Sistemas\OnePiece;

use App\Nucleo\Combate\SistemaDeCombate;
use App\Nucleo\Sistemas\Sistema;

/** Módulo de One Piece: parte das regras do D&D 5e, com atributos, perícias, técnicas e pontos de poder próprios. */
class OnePiece implements Sistema, SistemaDeCombate
{
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
        $monta = function (string $id, array $dados, array $custo) use ($gatilho, &$ofertas) {
            $r = $dados['reacao'] ?? null;
            if (! is_array($r) || ($r['gatilho'] ?? null) !== $gatilho) {
                return;
            }
            $ofertas[] = [
                'id' => $id, 'rotulo' => $dados['nome'] ?? 'Reação', 'descricao' => $dados['descricao'] ?? '', 'categoria' => 'reacao',
                'alcance' => $r['alcance'] ?? 'si', 'cura' => $r['cura'] ?? null, 'custo' => $custo,
                'efeitos' => isset($r['defesa']) ? [['alvo' => 'defesa', 'modo' => 'soma', 'valor' => (int) $r['defesa']]] : [],
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
