<?php

namespace App\Providers;

use App\Nucleo\Sistemas\RegistroSistemas;
use App\Sistemas\Dnd5e\Dnd5e;
use App\Sistemas\OnePiece\OnePiece;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Módulos de sistema instalados. Para um novo sistema: criar `app/Sistemas/<Nome>` e listar aqui.
        $this->app->singleton(RegistroSistemas::class, fn () => new RegistroSistemas([
            Dnd5e::class,
            OnePiece::class,
        ]));
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
