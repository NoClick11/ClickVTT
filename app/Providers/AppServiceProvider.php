<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
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
        // Entrada pelo convite: 8 por minuto por IP. Só em desenvolvimento e testes, o roteiro E2E (header `X-E2E`) fica de fora para não esperar.
        RateLimiter::for('convite', fn (Request $request) => app()->environment('local', 'testing') && $request->hasHeader('X-E2E')
            ? Limit::none()
            : Limit::perMinute(8)->by($request->ip()));
    }
}
