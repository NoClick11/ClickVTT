<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mensagem;
use App\Models\Mesa;
use App\Nucleo\Combate\CombateService;
use App\Nucleo\Combate\Pipeline;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Rolagem\RolagemInvalida;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Nucleo\Sistemas\Sistema;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
use App\Support\Transmitir;
use Illuminate\Support\Facades\DB;
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
    public function rolar(Request $request, Mesa $mesa, Rolador $rolador, RegistroSistemas $sistemas, CombateService $combate, Pipeline $pipeline): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $permitidas = $acesso->ehMestre() ? ['todos', 'mestre', 'secreto'] : ['todos', 'mestre'];
        $dados = $request->validate([
            'expressao' => ['required', 'string', 'max:'.Rolador::MAX_EXPRESSAO],
            'rotulo' => ['nullable', 'string', 'max:60'],
            'visibilidade' => ['required', Rule::in($permitidas)],
            'personagem_id' => ['nullable', 'integer', Rule::in($acesso->personagensPermitidos())], // personagem ativo
            // Rolagem de dano: o tipo (fogo, cortante...) vai junto para o botão "Aplicar" respeitar resistências e imunidades.
            'dano' => ['nullable', 'array'],
            'dano.tipo' => ['nullable', 'string', 'max:30'],
            // Alvo do ataque (token mirado): com o combate em curso, abre a janela de reação e resolve o acerto.
            'alvo_personagem_id' => ['nullable', 'integer', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            // Ação do combate que esta rolagem gasta (categoria do sistema); recusada se não puder agir agora.
            'acao' => ['nullable', 'array'],
            'acao.categoria' => ['required_with:acao', 'string', 'max:20'],
            'acao.tecnica' => ['nullable', 'boolean'],
            'dano.fator' => ['nullable', 'numeric', 'between:0,4'], // fração do dano que vale (0,5 = metade, ex.: arma à distância do anão)
            // Ataque de uma Técnica: o card do chat oferece o dano dela (e o crítico) depois do acerto, e mostra a Salvaguarda do efeito.
            'tecnica' => ['nullable', 'array'],
            'tecnica.nome' => ['required_with:tecnica', 'string', 'max:120'],
            'tecnica.dano' => ['nullable', 'array'],
            'tecnica.dano.expressao' => ['required_with:tecnica.dano', 'string', 'max:'.Rolador::MAX_EXPRESSAO],
            'tecnica.dano.tipo' => ['nullable', 'string', 'max:30'],
            'tecnica.secundaria' => ['nullable', 'array'],
            'tecnica.secundaria.atributo' => ['required_with:tecnica.secundaria', 'string', 'max:3'],
            'tecnica.secundaria.desvantagem' => ['nullable', 'boolean'],
            'tecnica.secundaria.efeito' => ['required_with:tecnica.secundaria', 'string', 'max:200'],
            'tecnica.secundaria.aplica' => ['nullable', 'array'],
            'tecnica.secundaria.aplica.condicao' => ['required_with:tecnica.secundaria.aplica', 'string', 'max:40'],
            'tecnica.secundaria.aplica.turnos' => ['nullable', 'integer', 'between:1,99'],
            'tecnica.secundaria.aplica.aoDano' => ['nullable', 'boolean'],
        ]);

        if (isset($dados['acao']) && ! empty($dados['personagem_id'])) {
            $combate->gastar($mesa, $acesso, $dados['personagem_id'], $dados['acao']['categoria'], (bool) ($dados['acao']['tecnica'] ?? false));
        }

        [$sistema, $variaveis, $itens, $ficha] = $this->variaveis($mesa, $dados['personagem_id'] ?? null, $sistemas);
        try {
            $resultado = $rolador->rolar($dados['expressao'], $variaveis);
        } catch (RolagemInvalida $e) {
            throw ValidationException::withMessages(['expressao' => $e->getMessage()]);
        }
        // `^2` (rolar o dano duas vezes e ficar com o maior) é da Saijo Ô Wazamono equipada: até 3 usos por descanso longo, consumidos aqui (depois de a expressão rolar).
        if (str_contains($dados['expressao'], '^')) {
            \App\Sistemas\OnePiece\ConsumoDaSaijo::consumir($mesa, $dados['personagem_id'] ?? null, $sistema, $itens, $ficha);
        }
        // O sistema pode marcar a rolagem (ex.: ataque crítico); o núcleo só guarda e repassa.
        $marcas = $sistema?->metadadosDaRolagem($resultado['termos'], $variaveis, $itens, $ficha) ?? [];
        if (is_array($dados['tecnica'] ?? null) && $this->ehAtaque($resultado['termos'])) {
            $marcas = [...$marcas, ...$this->marcasDoAtaqueDeTecnica($dados['tecnica'], $resultado['termos'])];
        }
        if (is_array($dados['dano'] ?? null)) {
            $marcas['dano'] = [
                'tipo' => filled($dados['dano']['tipo'] ?? null) ? trim($dados['dano']['tipo']) : null,
                ...(isset($dados['dano']['fator']) && (float) $dados['dano']['fator'] !== 1.0 ? ['fator' => (float) $dados['dano']['fator']] : []),
            ];
            // Densidade e Balanço da arma (forja): o servidor deduz da arma da rolagem, nunca do que o cliente manda.
            if (preg_match('/@arma\.(\d+)\.dano/', (string) $dados['expressao'], $m)) {
                $ignora = \App\Sistemas\OnePiece\Forja::ignoraDoDano($itens[(int) $m[1]]['dados']['arma'] ?? null);
                if ($ignora) {
                    $marcas['dano']['ignora'] = $ignora;
                }
            }
        }

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
                ...(isset($resultado['limite']) ? ['limite' => $resultado['limite']] : []),
                ...(isset($resultado['repeticoes']) ? ['repeticoes' => $resultado['repeticoes'], 'escolhida' => $resultado['escolhida']] : []),
                ...($marcas ? ['sistema' => $marcas] : []),
            ],
        ]);

        $resposta = $this->entregar($mesa, $mensagem, $acesso);

        // Ataque contra um alvo mirado: a janela de reação abre (ou o ataque resolve na hora) e a rolagem ganha o resultado.
        if (! empty($dados['alvo_personagem_id']) && ! empty($dados['personagem_id']) && $this->ehAtaque($resultado['termos'])) {
            $pipeline->ataqueDeclarado($mesa, $acesso, $mensagem, $dados['personagem_id'], $dados['alvo_personagem_id']);

            return response()->json($mensagem->fresh()->para($acesso->jogador), 201);
        }

        return $resposta;
    }

    /**
     * O ataque de uma Técnica: o d20 puro na margem (20) é crítico, 1 é falha. No acerto o card oferece o dano da Técnica (no crítico,
     * os dados dobram, com o normal ao lado). A Salvaguarda do efeito (condição) vai no card para quem atingiu lembrar de pedir.
     *
     * @param  array<string, mixed>  $tecnica
     * @param  list<array>  $termos
     * @return array<string, mixed>
     */
    private function marcasDoAtaqueDeTecnica(array $tecnica, array $termos): array
    {
        $natural = Pipeline::naturalDoD20($termos);
        $destaque = $natural === null ? null : ($natural >= 20 ? 'critico' : ($natural === 1 ? 'falha' : null));
        $meta = ['margem' => 20, 'tecnica' => ['nome' => trim($tecnica['nome']), ...(isset($tecnica['secundaria']) ? ['secundaria' => $tecnica['secundaria']] : [])]];
        if ($destaque) {
            $meta['destaque'] = $destaque;
        }
        $dano = $tecnica['dano'] ?? null;
        if ($dano && $destaque !== 'falha') {
            $tipo = filled($dano['tipo'] ?? null) ? trim($dano['tipo']) : null;
            $acao = fn (string $id, string $rotulo, string $expressao) => [
                'id' => $id, 'rotulo' => $rotulo, 'resumo' => $expressao, 'expressao' => $expressao, 'rotuloRolagem' => trim($tecnica['nome']), 'dano' => ['tipo' => $tipo],
            ];
            $normal = $acao('dano', 'Dano', $dano['expressao']);
            $meta['acoes'] = $destaque === 'critico'
                ? [[...$acao('dano-critico', 'Dano crítico', \App\Sistemas\OnePiece\Regras::dobrarDadosDaExpressao($dano['expressao'])), 'destaque' => 'critico'], [...$normal, 'rotulo' => 'Dano normal']]
                : [$normal];
        }

        return $meta;
    }

    /** A rolagem é um ataque (usa a variável de ataque: `@ataque` ou `@arma.<id>.ataque`)? */
    private function ehAtaque(array $termos): bool
    {
        foreach ($termos as $t) {
            if (($t['tipo'] ?? null) === 'variavel' && ($t['nome'] === 'ataque' || preg_match('/^arma\.\d+\.ataque$/', $t['nome']))) {
                return true;
            }
        }

        return false;
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
        EntregarMensagem::para($mesa, $mensagem, $acesso);

        return response()->json($mensagem->para($acesso->jogador), 201);
    }
}
