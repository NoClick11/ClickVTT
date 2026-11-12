<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Sistemas\OnePiece\Navios;
use App\Sistemas\OnePiece\NavioService;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Navios (cap. 14). O navio é um personagem sem jogadores com o bloco `ficha.navio`: o mestre cria, e TODOS os jogadores da
 * mesa veem a ficha e agem nela (construir, tesouro, carga, tripulação) por `acao`. PV, ajustes e concluir obra são do mestre.
 */
class NavioController extends Controller
{
    private const COR_PADRAO = '#0ea5e9';

    /** Corpo: `nome`, `modelo?` (modelo do livro) ou `tamanho` + `madeira` (em branco), `cor?`. */
    public function criar(Request $request, Mesa $mesa, RegistroSistemas $sistemas, NavioService $navios): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $sistema = $sistemas->resolver($mesa->sistema->slug);
        if ($mesa->sistema->slug !== 'one-piece' || ! $sistema) {
            throw ValidationException::withMessages(['nome' => 'Este sistema ainda não tem navios.']);
        }
        $d = $request->validate([
            'nome' => ['required', 'string', 'max:60'],
            'cor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'modelo' => ['nullable', 'string', Rule::in(array_column(Navios::dados()['modelos'], 'id'))],
            'tamanho' => ['required_without:modelo', 'nullable', 'string', Rule::in(array_column(Navios::dados()['tamanhos'], 'id'))],
            'madeira' => ['required_without:modelo', 'nullable', 'string', Rule::in(array_column(Navios::dados()['madeiras'], 'id'))],
        ]);

        $personagem = DB::transaction(function () use ($mesa, $d, $navios) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $nome = trim($d['nome']);
            $existentes = array_flip($m->personagens()->pluck('nome')->all());
            for ($n = 2, $livre = $nome; isset($existentes[$livre]); $n++) {
                $livre = "{$nome} {$n}";
            }
            $p = $m->personagens()->create(['nome' => $livre, 'cor' => $d['cor'] ?? self::COR_PADRAO]);
            $p->ficha = $navios->fichaNova($m, $d['modelo'] ?? null, $d['tamanho'] ?? 'pequeno', $d['madeira'] ?? 'cedro');
            $p->save();

            return $p;
        });
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($personagem->load('jogadores')->paraFront(true, $sistema), 201);
    }

    /**
     * Corpo: `acao` e os dados dela (ver `NavioService::operar`). Devolve os campos do navio que mudaram e, quando um personagem
     * muda junto (depósito, saque, carga), os dele.
     */
    public function acao(Request $request, Mesa $mesa, Personagem $personagem, NavioService $navios): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        $d = $request->validate(['acao' => ['required', 'string', 'max:20']]);

        $r = $navios->operar($mesa, $acesso, $personagem->id, $d['acao'], $request->all());

        // A ficha do navio é de toda a mesa
        $campos = NavioService::campos($r['navio']);
        Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $r['navio']->id, 'campos' => $campos, 'ator' => $acesso->jogador->id], ['mesa']);
        $outro = null;
        if ($r['outro']) {
            $o = $r['outro'];
            $outro = ['personagem_id' => $o->id, 'campos' => ['belly' => (int) ($o->ficha['belly'] ?? 0), 'inventario' => $o->ficha['inventario'] ?? []]];
            // a ficha do personagem só vai ao mestre e aos donos dele
            Transmitir::enviar($mesa, 'ficha', [...$outro, 'ator' => $acesso->jogador->id], $o->canaisDaFicha());
        }

        return response()->json(['personagem_id' => $r['navio']->id, 'campos' => $campos, 'outro' => $outro]);
    }
}
