<?php

namespace Tests\Unit\Nucleo;

use App\Nucleo\Sistemas\RegistroSistemas;
use App\Nucleo\Sistemas\Sistema;
use App\Sistemas\Dnd5e\Dnd5e;
use InvalidArgumentException;
use stdClass;
use Tests\TestCase;

class SistemaFalso implements Sistema
{
    public static function slug(): string
    {
        return 'falso';
    }

    public function fichaPadrao(): array
    {
        return [];
    }

    public function regrasFicha(): array
    {
        return [];
    }

    public function variaveisDeRolagem(array $ficha, array $itens = []): array
    {
        return [];
    }

    public function metadadosDaRolagem(array $termos, array $variaveis, array $itens = []): array
    {
        return [];
    }

    public function itensReferenciados(array $ficha): array
    {
        return [];
    }

    public function semItem(array $ficha, int $itemId): array
    {
        return $ficha;
    }

    public function regrasItem(): array
    {
        return [];
    }

    public function alvosDeEfeito(): array
    {
        return [];
    }
}

class OutroComMesmoSlug extends SistemaFalso {}

class RegistroSistemasTest extends TestCase
{
    public function test_resolve_modulo_pelo_slug(): void
    {
        $registro = new RegistroSistemas([SistemaFalso::class]);

        $this->assertInstanceOf(SistemaFalso::class, $registro->resolver('falso'));
        $this->assertTrue($registro->possui('falso'));
        $this->assertSame(['falso'], $registro->slugs());
    }

    public function test_sistema_sem_modulo_devolve_null(): void
    {
        $registro = new RegistroSistemas([SistemaFalso::class]);

        $this->assertNull($registro->resolver('one-piece'));
        $this->assertNull($registro->resolver(null));
        $this->assertFalse($registro->possui('one-piece'));
    }

    public function test_rejeita_classe_que_nao_e_sistema_e_slug_duplicado(): void
    {
        $registro = new RegistroSistemas([SistemaFalso::class]);
        $registro->registrar(SistemaFalso::class); // repetir o mesmo módulo é inofensivo

        try {
            $registro->registrar(stdClass::class);
            $this->fail('Aceitou uma classe que não implementa Sistema.');
        } catch (InvalidArgumentException) {
        }

        $this->expectException(InvalidArgumentException::class);
        $registro->registrar(OutroComMesmoSlug::class);
    }

    public function test_aplicacao_registra_o_dnd_5e(): void
    {
        $registro = app(RegistroSistemas::class);

        $this->assertInstanceOf(Dnd5e::class, $registro->resolver('dnd-5e'));
    }
}
