<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Jogador;
use App\Models\Mensagem;
use App\Models\Mesa;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Rolagem\RolagemInvalida;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Nucleo\Sistemas\Sistema;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

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
     * Rolagem decidida no SERVIDOR (ninguém escolhe o resultado). O cliente manda só a EXPRESSÃO
     * (`1d20+5`, `2d20kh1`, `1d20+@mod.for`...) e um rótulo. As variáveis (`@...`) vêm da ficha SALVA do
     * personagem que rola, calculadas pelo módulo do sistema: o cliente nunca informa valores.
     * Jogador: `todos` ou `mestre` (eu e o mestre). Mestre: `todos`, `mestre` (só ele) ou `secreto`
     * (jogadores só veem o aviso de que houve rolagem, sem números).
     */
    public function rolar(Request $request, Mesa $mesa, Rolador $rolador, RegistroSistemas $sistemas): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $permitidas = $acesso->ehMestre() ? ['todos', 'mestre', 'secreto'] : ['todos', 'mestre'];
        $dados = $request->validate([
            'expressao' => ['required', 'string', 'max:'.Rolador::MAX_EXPRESSAO],
            'rotulo' => ['nullable', 'string', 'max:60'],
            'visibilidade' => ['required', Rule::in($permitidas)],
            'personagem_id' => ['nullable', 'integer', Rule::in($acesso->personagensPermitidos())], // personagem ativo
        ]);

        [$sistema, $variaveis, $itens, $ficha] = $this->variaveis($mesa, $dados['personagem_id'] ?? null, $sistemas);
        try {
            $resultado = $rolador->rolar($dados['expressao'], $variaveis);
        } catch (RolagemInvalida $e) {
            throw ValidationException::withMessages(['expressao' => $e->getMessage()]);
        }
        // O sistema pode marcar a rolagem (ex.: ataque crítico); o núcleo só guarda e repassa.
        $marcas = $sistema?->metadadosDaRolagem($resultado['termos'], $variaveis, $itens, $ficha) ?? [];

        $mensagem = $mesa->mensagens()->create([
            'jogador_id' => $acesso->jogador->id,
            'personagem_id' => $dados['personagem_id'] ?? null,
            'tipo' => 'rolagem',
            'visibilidade' => $dados['visibilidade'],
            'texto' => $resultado['expressao'],
            'dados' => [
                'expressao' => $resultado['expressao'],
                'rotulo' => filled($dados['rotulo'] ?? null) ? trim($dados['rotulo']) : null,
                'termos' => $resultado['termos'],
                'total' => $resultado['total'],
                ...($marcas ? ['sistema' => $marcas] : []),
            ],
        ]);

        return $this->entregar($mesa, $mensagem, $acesso);
    }

    /**
     * O módulo do sistema, as variáveis do personagem e os itens da ficha dele (sem personagem ou sem módulo:
     * `[null, [], [], []]`).
     *
     * @return array{0: ?Sistema, 1: array<string, int|float>, 2: array<int, array>, 3: array<string, mixed>}
     */
    private function variaveis(Mesa $mesa, ?int $personagemId, RegistroSistemas $sistemas): array
    {
        $personagem = $personagemId ? $mesa->personagens()->find($personagemId) : null;
        $sistema = $personagem ? $sistemas->resolver($mesa->sistema->slug) : null;

        if (! $sistema) {
            return [null, [], [], []];
        }
        $ficha = $personagem->fichaCompleta($sistema);
        $ids = $sistema->itensReferenciados($ficha);
        $itens = $ids ? $mesa->itens()->whereIn('id', $ids)->get()->mapWithKeys(fn ($i) => [$i->id => $i->paraFront()])->all() : [];

        return [$sistema, $sistema->variaveisDeRolagem($ficha, $itens), $itens, $ficha];
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

    private function mestreFicticio(): Jogador
    {
        return new Jogador(['papel' => 'mestre']);
    }
}
