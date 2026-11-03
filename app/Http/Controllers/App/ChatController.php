<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mensagem;
use App\Models\Mesa;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ChatController extends Controller
{
    public function texto(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $dados = $request->validate([
            'texto' => ['required', 'string', 'max:1000'],
            'personagem_id' => ['nullable', 'integer', Rule::in($acesso->personagensPermitidos())], // "falando como"
        ]);

        $mensagem = $mesa->mensagens()->create([
            'jogador_id' => $acesso->jogador->id, 'personagem_id' => $dados['personagem_id'] ?? null,
            'tipo' => 'texto', 'visibilidade' => 'todos', 'texto' => trim($dados['texto']),
        ]);

        return $this->entregar($mesa, $mensagem, $acesso);
    }

    /**
     * Rolagem decidida no SERVIDOR (ninguém escolhe o resultado).
     * Jogador: `todos` ou `mestre` (eu e o mestre). Mestre: `todos`, `mestre` (só ele) ou `secreto`
     * (jogadores só veem o aviso de que houve rolagem, sem números).
     */
    public function rolar(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $permitidas = $acesso->ehMestre() ? ['todos', 'mestre', 'secreto'] : ['todos', 'mestre'];
        $dados = $request->validate([
            'dado' => ['required', Rule::in(array_keys(Mensagem::DADOS))],
            'quantidade' => ['required', 'integer', 'min:1', 'max:6'],
            'visibilidade' => ['required', Rule::in($permitidas)],
            'personagem_id' => ['nullable', 'integer', Rule::in($acesso->personagensPermitidos())], // personagem ativo
        ]);

        $faces = Mensagem::DADOS[$dados['dado']];
        $resultados = array_map(fn () => random_int(1, $faces), range(1, $dados['quantidade']));
        $total = array_sum($resultados);

        $mensagem = $mesa->mensagens()->create([
            'jogador_id' => $acesso->jogador->id,
            'personagem_id' => $dados['personagem_id'] ?? null,
            'tipo' => 'rolagem',
            'visibilidade' => $dados['visibilidade'],
            'texto' => "{$dados['quantidade']}{$dados['dado']}",
            'dados' => ['dado' => $dados['dado'], 'faces' => $faces, 'quantidade' => $dados['quantidade'], 'resultados' => $resultados, 'total' => $total],
        ]);

        return $this->entregar($mesa, $mensagem, $acesso);
    }

    /** Distribui a mensagem: cada canal recebe só o que pode ver. Quem enviou recebe a sua pela resposta. */
    private function entregar(Mesa $mesa, Mensagem $mensagem, AcessoMesa $acesso): JsonResponse
    {
        $mensagem->load(['personagem', 'jogador']);
        $autor = $acesso->jogador->id;

        switch ($mensagem->visibilidade) {
            case 'todos':
                Transmitir::enviar($mesa, 'mensagem', ['mensagem' => $mensagem->publica(), 'ator' => $autor], ['mesa']);
                break;
            case 'secreto':
                // Aviso sem números para todos; resultado completo só para o mestre.
                Transmitir::enviar($mesa, 'mensagem', ['mensagem' => $mensagem->publica(), 'ator' => $autor], ['mesa']);
                Transmitir::enviar($mesa, 'mensagem', ['mensagem' => $mensagem->para($this->mestreFicticio()), 'ator' => $autor, 'substitui' => true], ['mestre']);
                break;
            case 'mestre':
                $canais = $acesso->ehMestre() ? ['mestre'] : ["jogador.{$autor}", 'mestre'];
                Transmitir::enviar($mesa, 'mensagem', ['mensagem' => $mensagem->para($acesso->jogador), 'ator' => $autor], $canais);
                break;
        }

        return response()->json($mensagem->para($acesso->jogador), 201);
    }

    private function mestreFicticio(): \App\Models\Jogador
    {
        return new \App\Models\Jogador(['papel' => 'mestre']);
    }
}
