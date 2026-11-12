<?php

namespace App\Http\Middleware;

use Illuminate\Routing\Middleware\ThrottleRequests;

/**
 * `throttle:N,M` contado por PARTICIPANTE e por ROTA.
 *
 * O padrão do Laravel usa uma única chave por visitante (o IP, para quem não tem conta) em TODAS as rotas. Os jogadores entram
 * pelo convite (sem conta) e, atrás do Docker ou de um túnel, chegam todos com o mesmo IP: a mesa inteira dividia um só contador,
 * e uma rota de limite baixo passava a recusar (429) assim que a soma de tudo que todos fizeram no minuto o ultrapassava. Na
 * ficha isso aparecia como "mudei e voltou" (PP, descanso, edições). Aqui cada navegador (sessão) tem o seu contador em cada rota.
 */
class LimitePorParticipante extends ThrottleRequests
{
    protected function resolveRequestSignature($request)
    {
        $route = $request->route();
        $quem = $request->hasSession() ? $request->session()->getId() : $request->ip();
        $rota = $route ? ($route->getName() ?? $route->uri()) : $request->path();

        return sha1($rota.'|'.$quem);
    }
}
