<?php

use App\Http\Middleware\HandleInertiaRequests;
use App\Http\Middleware\LimitePorParticipante;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Middleware\AddLinkHeadersForPreloadedAssets;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        channels: __DIR__.'/../routes/channels.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware) {
        // A ficha guarda "" como "" (campo de texto limpo), não como null. Middleware global: a rota ainda
        // não foi resolvida aqui, então a exceção é por caminho.
        $middleware->convertEmptyStringsToNull(except: [fn (Request $request) => $request->is('jogo/*/personagens/*/ficha')]);
        // Limite de requisições por participante e por rota (o padrão soma a mesa inteira num contador só: ver a classe).
        $middleware->alias(['throttle' => LimitePorParticipante::class]);
        $middleware->web(append: [
            HandleInertiaRequests::class,
            AddLinkHeadersForPreloadedAssets::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions) {
        //
    })->create();
