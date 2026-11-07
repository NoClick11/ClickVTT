<?php

namespace Tests\Unit\Nucleo;

use App\Models\Pagina;
use App\Nucleo\Combate\Movimento;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

/** Os mesmos casos rodam no TS (`npm run test:regras`): a tela e o servidor medem e travam igual. */
class MovimentoTest extends TestCase
{
    public static function casos(): array
    {
        $casos = json_decode(file_get_contents(__DIR__.'/../../paridade/movimento.json'), true, flags: JSON_THROW_ON_ERROR);

        return array_column(array_map(fn ($c) => [$c['nome'], $c], $casos), null, 0);
    }

    #[DataProvider('casos')]
    public function test_limitar_confere_com_o_caso_de_paridade(string $nome, array $caso): void
    {
        $pagina = new Pagina($caso['escala']);
        $r = Movimento::limitar($caso['de'][0], $caso['de'][1], $caso['para'][0], $caso['para'][1], $caso['restante'], $pagina);

        $this->assertSame($caso['esperado']['travou'], $r['travou'], $nome);
        foreach (['x', 'y', 'metros'] as $k) {
            $this->assertEqualsWithDelta($caso['esperado'][$k], $r[$k], 0.001, "{$nome}: {$k}");
        }
    }

    public function test_fator_das_unidades(): void
    {
        $this->assertSame([1.0, 0.3048, 0.3048, 1000.0, 0.01, 1.0, 1.0], array_map(Movimento::fatorParaMetros(...), ['m', 'ft', 'pés', 'km', 'cm', 'quadrados', null]));
    }
}
