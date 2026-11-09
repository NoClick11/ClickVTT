<?php

namespace App\Sistemas\OnePiece;

use App\Models\Mesa;
use App\Nucleo\Loja\LojaService;
use Illuminate\Support\Str;

/**
 * Itens iniciais da profissão (Cap. 4): ao concluir a criação da ficha eles entram sozinhos no inventário. O texto do livro ("1 mochila
 * pequena", "3 kits de primeiros socorros", "1 bússola ou log pose à escolha") é lido em quantidade + nome; o nome que bate com um item do
 * catálogo do Cap. 8 vira esse item (o mesmo da loja); o que não bate ("livros de marcenaria", "apito") ou é uma escolha entre itens ("bússola ou
 * log pose") vira um item simples da mesa.
 */
final class ItensIniciais
{
    /** Palavras que não distinguem um item do outro ("kit de chaves" = "kit chaves"). */
    private const SEM_PESO = ['de', 'da', 'do', 'das', 'dos', 'para', 'a', 'o', 'as', 'os', 'e', 'com', 'um', 'uma'];

    /** @var array<string, string>|null chave normalizada => id do catálogo */
    private static ?array $indice = null;

    /** A forma comparável de um nome: sem acento, sem artigos e no singular ("Kits de Primeiros Socorros" = "kit primeiro socorro"). */
    public static function chave(string $texto): string
    {
        $palavras = preg_split('/[^a-z0-9]+/', Str::ascii(mb_strtolower($texto)), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $palavras = array_values(array_filter($palavras, fn ($p) => ! in_array($p, self::SEM_PESO, true)));

        return implode(' ', array_map(self::singular(...), $palavras));
    }

    private static function singular(string $p): string
    {
        return match (true) {
            strlen($p) > 4 && str_ends_with($p, 'oes') => substr($p, 0, -3).'ao',
            strlen($p) > 4 && str_ends_with($p, 'aes') => substr($p, 0, -3).'ao',
            strlen($p) > 4 && str_ends_with($p, 'ais') => substr($p, 0, -3).'al',
            strlen($p) > 4 && str_ends_with($p, 'res') => substr($p, 0, -2),
            strlen($p) > 3 && str_ends_with($p, 's') => substr($p, 0, -1),
            default => $p,
        };
    }

    /** @return array<string, string> */
    private static function indice(): array
    {
        if (self::$indice === null) {
            self::$indice = [];
            foreach (Itens::catalogo()['itens'] as $i) {
                self::$indice[self::chave($i['nome'])] ??= $i['id'];
            }
        }

        return self::$indice;
    }

    /**
     * Um texto do livro em item: `{qtd, nome, catalogo}` (`catalogo` = id do item do catálogo, ou null para um item simples).
     *
     * @return array{qtd: int, nome: string, catalogo: ?string}
     */
    public static function ler(string $texto): array
    {
        $texto = trim($texto);
        $qtd = 1;
        if (preg_match('/^(\d+)\s+(.+)$/u', $texto, $m)) {
            $qtd = max(1, (int) $m[1]);
            $texto = $m[2];
        }
        // "à sua escolha" não faz parte do nome ("1 instrumento musical à sua escolha" = o item do catálogo). Uma escolha entre itens diferentes
        // ("bússola ou log pose") é do jogador: entra como item simples com o texto inteiro, para ele trocar pelo que escolher.
        $limpo = trim(preg_replace('/\s+(à|a)\s+(sua\s+)?escolha\s*$/iu', '', $texto) ?? $texto);
        if (! preg_match('/\s+ou\s+|\(/iu', $limpo)) {
            foreach ([$limpo, preg_replace('/^(par|pares)\s+de\s+/iu', '', $limpo) ?? $limpo] as $candidata) {
                $id = self::indice()[self::chave($candidata)] ?? null;
                if ($id) {
                    return ['qtd' => $qtd, 'nome' => Itens::item($id)['nome'], 'catalogo' => $id];
                }
            }
        }

        return ['qtd' => $qtd, 'nome' => Str::ucfirst($limpo), 'catalogo' => null];
    }

    /**
     * A ficha depois de entregar o inventário inicial da criação: os itens da profissão, o equipamento do estilo (pela arma favorita escolhida)
     * e os Bellys do estilo (fixos, ou os rolados no servidor). Tira antes o que uma criação anterior entregou (refazer não duplica) e guarda o que
     * entregou em `itensIniciais` e `dinheiroInicial`.
     *
     * @param  array<string, mixed>  $ficha
     * @param  array<string, mixed>|null  $criacao  o estado da criação (`dados.escolhas` do assistente e `dados.dinheiro` rolado no servidor)
     * @return array<string, mixed>
     */
    public static function entregar(Mesa $mesa, OnePiece $sistema, array $ficha, ?array $criacao = null): array
    {
        foreach ($ficha['itensIniciais'] ?? [] as $antigo) {
            $ficha = self::retirar($ficha, (int) $antigo['item_id'], (int) $antigo['qtd']);
        }
        $ficha['belly'] = max(0, (int) ($ficha['belly'] ?? 0) - (int) ($ficha['dinheiroInicial'] ?? 0));
        $entregues = [];
        $entregar = function (array $item, string $descricao) use ($mesa, $sistema, &$ficha, &$entregues) {
            $modelo = $item['catalogo']
                ? app(LojaService::class)->materializar($mesa, $sistema, Itens::item($item['catalogo']))
                : $mesa->itens()->firstOrCreate(
                    ['catalogo_id' => substr('inicial:'.Str::slug($item['nome']), 0, 60)],
                    ['nome' => $item['nome'], 'descricao' => $descricao, 'peso' => 0, 'equipavel' => false, 'requer_sintonia' => false],
                );
            $ficha = $sistema->entregarNoInventario($ficha, $modelo->id, $item['qtd']);
            $entregues[] = ['item_id' => $modelo->id, 'qtd' => $item['qtd']];
        };

        // cada profissão da ficha entrega os seus itens (a Singularidade Pau-para-Toda-Obra tem duas profissões iniciais)
        $lista = empty($ficha['profissoes']['semProfissao']) ? ($ficha['profissoes']['lista'] ?? []) : [];
        foreach ($lista as $entrada) {
            $profissao = Profissoes::profissao((string) ($entrada['id'] ?? ''));
            foreach ($profissao['itens'] ?? [] as $texto) {
                $entregar(self::ler($texto), "Item inicial da profissão {$profissao['nome']}.");
            }
        }

        // equipamento do estilo: o da arma favorita escolhida e os itens fixos; depois o dinheiro
        $estilo = EstilosDeLuta::estilo((string) ($ficha['estiloId'] ?? ''));
        $equipamento = $estilo['equipamentoInicial'] ?? null;
        $dinheiro = 0;
        if ($equipamento) {
            $favorita = (string) ($criacao['dados']['escolhas']['estilo']['armaFavorita'] ?? '');
            foreach ([...($equipamento['porArma'][$favorita] ?? []), ...($equipamento['itens'] ?? [])] as $i) {
                $item = Itens::item($i['catalogo']);
                if ($item) {
                    $entregar(['qtd' => (int) $i['qtd'], 'nome' => $item['nome'], 'catalogo' => $i['catalogo']], '');
                    // a arma já vem ajustada para esta ficha (a espada do Deus da Arma: 2d8, +2/+2)
                    if (! empty($i['arma'])) {
                        $ficha = self::ajustarArma($ficha, (int) end($entregues)['item_id'], $i['arma']);
                    }
                }
            }
            $d = $equipamento['dinheiro'] ?? null;
            if (isset($d['valor'])) {
                $dinheiro = (int) $d['valor'];
            } elseif ($d) {
                $rolado = $criacao['dados']['dinheiro'] ?? null;
                $dinheiro = ($rolado['estilo'] ?? null) === $estilo['id'] ? (int) $rolado['bellys'] : 0;
            }
        }
        $ficha['belly'] = min(1_000_000_000_000, (int) ($ficha['belly'] ?? 0) + $dinheiro);
        $ficha['itensIniciais'] = $entregues;
        $ficha['dinheiroInicial'] = $dinheiro;

        return $ficha;
    }

    /** Guarda o ajuste da arma (só desta ficha) na linha do inventário. */
    private static function ajustarArma(array $ficha, int $itemId, array $ajuste): array
    {
        foreach ($ficha['inventario'] ?? [] as $s => $secao) {
            foreach ($secao['itens'] ?? [] as $i => $ref) {
                if ((int) ($ref['item_id'] ?? 0) === $itemId) {
                    $ficha['inventario'][$s]['itens'][$i]['arma'] = $ajuste;

                    return $ficha;
                }
            }
        }

        return $ficha;
    }

    /** Tira `$qtd` unidades do item do inventário (some a linha se zerar). */
    private static function retirar(array $ficha, int $itemId, int $qtd): array
    {
        foreach ($ficha['inventario'] ?? [] as $s => $secao) {
            foreach ($secao['itens'] ?? [] as $i => $ref) {
                if ((int) ($ref['item_id'] ?? 0) !== $itemId) {
                    continue;
                }
                $resta = (int) $ref['qtd'] - $qtd;
                if ($resta > 0) {
                    $ficha['inventario'][$s]['itens'][$i]['qtd'] = $resta;
                } else {
                    unset($ficha['inventario'][$s]['itens'][$i]);
                    $ficha['inventario'][$s]['itens'] = array_values($ficha['inventario'][$s]['itens']);
                }

                return $ficha;
            }
        }

        return $ficha;
    }
}
