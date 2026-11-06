<?php

namespace Tests\Unit\Nucleo;

use App\Nucleo\Efeitos\Efeitos;
use App\Nucleo\Efeitos\Formula;
use App\Nucleo\Efeitos\FormulaInvalida;
use Illuminate\Support\Facades\Validator;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/** Os mesmos casos de `tests/paridade/*.json` rodam no TS (`npm run test:regras`). */
class EfeitosTest extends TestCase
{
    private static function casos(string $arquivo): array
    {
        $casos = json_decode(file_get_contents(__DIR__.'/../../paridade/'.$arquivo), true, flags: JSON_THROW_ON_ERROR);

        return array_combine(array_map(fn ($c, $i) => "{$i}: {$c['nome']}", $casos, array_keys($casos)), array_map(fn ($c) => [$c], $casos));
    }

    public static function formulas(): array
    {
        return self::casos('formula.json');
    }

    public static function efeitos(): array
    {
        return self::casos('efeitos.json');
    }

    #[DataProvider('formulas')]
    public function test_formula_confere_com_o_caso_de_paridade(array $caso): void
    {
        if ($caso['erro'] ?? false) {
            $this->expectException(FormulaInvalida::class);
            Formula::avaliar($caso['expr'], $caso['vars']);

            return;
        }
        $this->assertEquals($caso['esperado'], Formula::avaliar($caso['expr'], $caso['vars']));
    }

    #[DataProvider('efeitos')]
    public function test_efeitos_conferem_com_o_caso_de_paridade(array $caso): void
    {
        $r = Efeitos::aplicar($caso['alvo'], $caso['base'], $caso['efeitos'], $caso['variaveis']);

        $this->assertEquals($caso['esperado']['valor'], $r['valor']);
        $this->assertEquals($caso['esperado']['origens'], $r['origens']);
        $this->assertSame($caso['esperado']['rolagem'], Efeitos::rolagem($caso['alvo'], $caso['efeitos']));
    }

    public function test_sintaxe_valida_aceita_variaveis_quaisquer(): void
    {
        $this->assertTrue(Formula::sintaxeValida('14+min(@mod.des,2)'));
        $this->assertTrue(Formula::sintaxeValida('@qualquer.coisa/2'));
        $this->assertFalse(Formula::sintaxeValida('2d6'));
        $this->assertFalse(Formula::sintaxeValida('1/0'));
        $this->assertFalse(Formula::sintaxeValida('min('));
    }

    public function test_curinga_so_no_fim(): void
    {
        $this->assertTrue(Efeitos::casa('pericia.*', 'pericia.percepcao'));
        $this->assertFalse(Efeitos::casa('pericia.*', 'pericia'));
        $this->assertFalse(Efeitos::casa('pericia.*', 'periciaX.a'));
        $this->assertFalse(Efeitos::casa('ca', 'ca.x'));
        $this->assertTrue(Efeitos::casa('ca', 'ca'));
    }

    public function test_de_fonte_acrescenta_o_nome_e_normaliza(): void
    {
        $r = Efeitos::deFonte('Anel', [['alvo' => 'ca', 'modo' => 'soma', 'valor' => 1, 'lixo' => 'x'], ['alvo' => 'ataque.arma', 'modo' => 'vantagem']]);

        $this->assertSame([['fonte' => 'Anel', 'alvo' => 'ca', 'modo' => 'soma', 'valor' => 1], ['fonte' => 'Anel', 'alvo' => 'ataque.arma', 'modo' => 'vantagem', 'valor' => null]], $r);
    }

    #[DataProvider('validacao')]
    public function test_validacao_do_formato_do_efeito(array $efeitos, bool $valido, ?array $alvos = null): void
    {
        $v = Validator::make(['efeitos' => $efeitos], Efeitos::regras('efeitos', $alvos));

        $this->assertSame($valido, ! $v->fails(), json_encode($v->errors()->all()));
    }

    public static function validacao(): array
    {
        return [
            'soma simples' => [[['alvo' => 'ca', 'modo' => 'soma', 'valor' => 1]], true],
            'fórmula' => [[['alvo' => 'ca', 'modo' => 'base', 'valor' => '14+min(@mod.des,2)']], true],
            'vantagem sem valor' => [[['alvo' => 'pericia.*', 'modo' => 'vantagem']], true],
            'lista vazia' => [[], true],
            'modo desconhecido' => [[['alvo' => 'ca', 'modo' => 'multiplica', 'valor' => 2]], false],
            'soma sem valor' => [[['alvo' => 'ca', 'modo' => 'soma']], false],
            'fórmula quebrada' => [[['alvo' => 'ca', 'modo' => 'soma', 'valor' => '2d6']], false],
            'valor enorme' => [[['alvo' => 'ca', 'modo' => 'soma', 'valor' => 5_000_000]], false],
            'alvo mal formado' => [[['alvo' => 'CA!', 'modo' => 'soma', 'valor' => 1]], false],
            'alvo ausente' => [[['modo' => 'soma', 'valor' => 1]], false],
            'efeito não é objeto' => [['ca'], false],
            'alvo fora do sistema' => [[['alvo' => 'mana', 'modo' => 'soma', 'valor' => 1]], false, ['ca', 'pericia.*']],
            'alvo do sistema' => [[['alvo' => 'pericia.*', 'modo' => 'soma', 'valor' => 1]], true, ['ca', 'pericia.*']],
            'dano extra em dados' => [[['alvo' => 'dano.arma', 'modo' => 'dados', 'valor' => '3d6']], true],
            'dano extra: 20 dados de 100 faces' => [[['alvo' => 'dano.arma', 'modo' => 'dados', 'valor' => '20d100']], true],
            'dano extra: mais de 20 dados' => [[['alvo' => 'dano.arma', 'modo' => 'dados', 'valor' => '21d6']], false],
            'dano extra: dado de 1 face' => [[['alvo' => 'dano.arma', 'modo' => 'dados', 'valor' => '1d1']], false],
            'dano extra: com modificador' => [[['alvo' => 'dano.arma', 'modo' => 'dados', 'valor' => '3d6+2']], false],
            'dano extra: número no lugar dos dados' => [[['alvo' => 'dano.arma', 'modo' => 'dados', 'valor' => 3]], false],
            'dano extra: sem valor' => [[['alvo' => 'dano.arma', 'modo' => 'dados']], false],
            'dano extra: fórmula' => [[['alvo' => 'dano.arma', 'modo' => 'dados', 'valor' => '@mod.for']], false],
            'efeitos demais' => [array_fill(0, 31, ['alvo' => 'ca', 'modo' => 'soma', 'valor' => 1]), false],
        ];
    }
}
