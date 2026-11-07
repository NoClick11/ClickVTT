<?php

namespace App\Sistemas\OnePiece;

/** Dados dos estilos de luta que o servidor precisa (o equipamento inicial), de `dados/estilos.json`, conferido contra o TS por teste. */
final class EstilosDeLuta
{
    private static ?array $catalogo = null;

    /** @return list<array{id: string, nome: string, equipamentoInicial: ?array<string, mixed>}> */
    public static function catalogo(): array
    {
        return (self::$catalogo ??= json_decode(file_get_contents(__DIR__.'/dados/estilos.json'), true))['estilos'];
    }

    /** @return array{id: string, nome: string, equipamentoInicial: ?array<string, mixed>}|null */
    public static function estilo(string $id): ?array
    {
        foreach (self::catalogo() as $e) {
            if ($e['id'] === $id) {
                return $e;
            }
        }

        return null;
    }

    /**
     * Os dados que rolam os Bellys iniciais do estilo (`5d10` e o multiplicador `1000`), ou null se o dinheiro é fixo ou não há.
     *
     * @return array{dados: string, multiplicador: int}|null
     */
    public static function dinheiroRolado(string $estiloId): ?array
    {
        $d = self::estilo($estiloId)['equipamentoInicial']['dinheiro'] ?? null;

        return isset($d['dados']) ? ['dados' => $d['dados'], 'multiplicador' => (int) $d['multiplicador']] : null;
    }
}
