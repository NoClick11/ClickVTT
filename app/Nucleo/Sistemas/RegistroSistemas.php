<?php

namespace App\Nucleo\Sistemas;

use InvalidArgumentException;

/** Catálogo dos módulos de sistema instalados (embutidos no código), indexados por slug. */
class RegistroSistemas
{
    /** @var array<string, class-string<Sistema>> */
    private array $modulos = [];

    /** @param  list<class-string<Sistema>>  $modulos */
    public function __construct(array $modulos = [])
    {
        foreach ($modulos as $classe) {
            $this->registrar($classe);
        }
    }

    /** @param  class-string<Sistema>  $classe */
    public function registrar(string $classe): void
    {
        if (! is_subclass_of($classe, Sistema::class)) {
            throw new InvalidArgumentException("{$classe} não implementa ".Sistema::class.'.');
        }
        $slug = $classe::slug();
        if (isset($this->modulos[$slug]) && $this->modulos[$slug] !== $classe) {
            throw new InvalidArgumentException("O slug de sistema \"{$slug}\" já está registrado por {$this->modulos[$slug]}.");
        }
        $this->modulos[$slug] = $classe;
    }

    /** Sistema sem módulo (ex.: ainda não implementado) devolve null: o chamador decide o fallback. */
    public function resolver(?string $slug): ?Sistema
    {
        $classe = $slug !== null ? ($this->modulos[$slug] ?? null) : null;

        return $classe ? app($classe) : null;
    }

    public function possui(?string $slug): bool
    {
        return $slug !== null && isset($this->modulos[$slug]);
    }

    /** @return list<string> */
    public function slugs(): array
    {
        return array_keys($this->modulos);
    }
}
