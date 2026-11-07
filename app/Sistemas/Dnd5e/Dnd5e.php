<?php

namespace App\Sistemas\Dnd5e;

use App\Nucleo\Combate\SistemaDeCombate;
use App\Nucleo\Sistemas\Sistema;

/** Módulo de Dungeons & Dragons, quinta edição. As regras entram aqui conforme o núcleo as pede. */
class Dnd5e implements Sistema, SistemaDeCombate
{
    public static function slug(): string
    {
        return 'dnd-5e';
    }

    public function fichaPadrao(): array
    {
        return FichaDnd5e::padrao();
    }

    public function regrasFicha(): array
    {
        return FichaDnd5e::regras();
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

    /** Ação, ação bônus, livre e reação (1 por rodada, usável fora do turno). */
    public function categoriasDeAcao(): array
    {
        return [
            ['id' => 'padrao', 'nome' => 'Ação', 'porTurno' => 1, 'porRodada' => null, 'soNoTurno' => true],
            ['id' => 'bonus', 'nome' => 'Ação bônus', 'porTurno' => 1, 'porRodada' => null, 'soNoTurno' => true],
            ['id' => 'livre', 'nome' => 'Interação livre', 'porTurno' => null, 'porRodada' => null, 'soNoTurno' => true],
            ['id' => 'reacao', 'nome' => 'Reação', 'porTurno' => null, 'porRodada' => 1, 'soNoTurno' => false],
        ];
    }

    public function iniciativa(array $ficha): string
    {
        return '1d20+@iniciativa';
    }

    /** O deslocamento do D&D é texto livre ("9 m", "30 ft"): vale o primeiro número (vírgula decimal aceita); sem número, 9 m. */
    public function deslocamentoDoTurno(array $ficha, array $variaveis): float
    {
        return preg_match('/\d+(?:[.,]\d+)?/', (string) ($ficha['deslocamento'] ?? ''), $m) ? (float) str_replace(',', '.', $m[0]) : 9.0;
    }

    /** O D&D ainda não declara reações em fichas: nenhuma oferta. */
    public function ofertasDeReacao(string $gatilho, array $contexto, array $ficha, array $variaveis): array
    {
        return [];
    }

    public function pagarReacao(array $ficha, array $oferta): array
    {
        return [];
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
        return FichaDnd5e::regrasItem();
    }

    public function alvosDeEfeito(): array
    {
        return FichaDnd5e::alvosDeEfeito();
    }
}
