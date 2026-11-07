<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mensagem;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Combate\Dano;
use App\Nucleo\Combate\Duracoes;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Sistemas\FichaCampos;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Nucleo\Sistemas\Sistema;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Ações sobre um personagem ALVO, feitas por qualquer participante da mesa (o jogador mira num token e age sobre ele):
 * aplicar o dano de uma rolagem e aplicar/remover uma condição. O valor do dano nunca vem do cliente: sai da mensagem da
 * rolagem (decidida pelo servidor). Quem altera a ficha do alvo é o servidor, com a mesma validação da ficha.
 */
class AlvoController extends Controller
{
    /**
     * Aplica o total de uma rolagem de dano ao alvo, respeitando imunidade, resistência e vulnerabilidade ao tipo do dano.
     * Só o autor da rolagem ou o mestre; cada rolagem vale uma vez por alvo. Corpo: `mensagem_id`.
     */
    public function dano(Request $request, Mesa $mesa, Personagem $personagem, RegistroSistemas $sistemas, FichaCampos $fichas): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        $entrada = $request->validate(['mensagem_id' => ['required', 'integer']]);
        $sistema = $this->sistema($mesa, $sistemas);

        $resultado = DB::transaction(function () use ($mesa, $personagem, $acesso, $entrada, $sistema, $fichas) {
            /** @var Mensagem $mensagem */
            $mensagem = $mesa->mensagens()->whereKey($entrada['mensagem_id'])->lockForUpdate()->firstOrFail();
            $dano = $mensagem->dados['sistema']['dano'] ?? null;
            if ($mensagem->tipo !== 'rolagem' || ! is_array($dano)) {
                throw ValidationException::withMessages(['mensagem_id' => 'Esta mensagem não é uma rolagem de dano.']);
            }
            abort_unless($acesso->ehMestre() || $mensagem->jogador_id === $acesso->jogador->id, 403, 'Só quem rolou o dano (ou o mestre) pode aplicá-lo.');
            $jaAplicado = $mensagem->dados['aplicado'] ?? [];
            if (in_array($personagem->id, $jaAplicado, true)) {
                throw ValidationException::withMessages(['mensagem_id' => 'Este dano já foi aplicado a este alvo.']);
            }

            $p = Personagem::query()->whereKey($personagem->id)->lockForUpdate()->firstOrFail();
            $ficha = $p->fichaCompleta($sistema);
            $tipo = $dano['tipo'] ?? null;
            // Fração do dano que vale (arma à distância do anão: metade), antes das defesas do alvo.
            $total = (int) floor(((int) ($mensagem->dados['total'] ?? 0)) * (float) ($dano['fator'] ?? 1));
            if (($ficha['hospedado'] ?? null) !== null) {
                throw ValidationException::withMessages(['mensagem_id' => "{$p->nome} está hospedado no espaço de outro personagem: ataque o hospedeiro."]);
            }
            $calculo = Dano::calcular($ficha, $total, $tipo);
            $pv = Dano::noPv($ficha['pv'] ?? [], $calculo['final']);
            $campos = ['pv.atual' => $pv['atual'], 'pv.temp' => $pv['temp']];

            // Condições "até receber dano" (ex.: Atordoado de Instintos Animalescos) acabam com o dano.
            $acabaram = [];
            if ($calculo['final'] > 0) {
                foreach ($ficha['duracoes'] ?? [] as $id => $d) {
                    if ($d['aoDano'] ?? false) {
                        $acabaram[] = $id;
                    }
                }
                if ($acabaram) {
                    $campos['condicoes'] = array_values(array_diff($ficha['condicoes'] ?? [], $acabaram));
                    $campos['duracoes'] = array_diff_key($ficha['duracoes'] ?? [], array_flip($acabaram));
                }
            }
            $p->ficha = $fichas->aplicar($sistema, $p->ficha, $campos);
            $p->save();

            $mensagem->dados = [...$mensagem->dados, 'aplicado' => [...$jaAplicado, $personagem->id]];
            $mensagem->save();

            // Hóspede Feérico: quem está no espaço deste alvo sofre METADE do dano que o alvo recebeu, ignorando as defesas dele.
            $hospedes = [];
            foreach ($mesa->personagens()->get() as $outro) {
                if ($outro->id === $p->id || (int) ($outro->ficha['hospedado'] ?? 0) !== $p->id) {
                    continue;
                }
                $outraFicha = $outro->fichaCompleta($sistema);
                $pvHospede = Dano::noPv($outraFicha['pv'] ?? [], intdiv($calculo['final'], 2));
                $camposHospede = ['pv.atual' => $pvHospede['atual'], 'pv.temp' => $pvHospede['temp']];
                $outro->ficha = $fichas->aplicar($sistema, $outro->ficha, $camposHospede);
                $outro->save();
                $hospedes[] = [$outro, $camposHospede, intdiv($calculo['final'], 2)];
            }

            return [$p, $mensagem, $calculo, $total, $tipo, $campos, $acabaram, $hospedes];
        });

        [$alvo, $mensagem, $calculo, $total, $tipo, $campos, $acabaram, $hospedes] = $resultado;
        Duracoes::transmitir($mesa, $alvo, $campos, $acabaram !== []);
        foreach ($hospedes as [$hospede, $camposHospede, $parte]) {
            Duracoes::transmitir($mesa, $hospede, $camposHospede);
            $this->avisar($mesa, $acesso, $mensagem->visibilidade, "{$hospede->nome} sofreu {$parte} de dano como hóspede de {$alvo->nome}.");
        }

        $texto = $this->textoDoDano($alvo->nome, $total, $tipo, $calculo);
        $this->avisar($mesa, $acesso, $mensagem->visibilidade, $texto);

        return response()->json(['final' => $calculo['final'], 'modo' => $calculo['modo'], 'texto' => $texto]);
    }

    /**
     * Liga ou desliga uma condição do alvo, com duração em turnos opcional (`turnos`: acaba no fim do turno dele que zera
     * a contagem; `ao_dano`: acaba ao receber dano). Imunidade à condição (ou ao nome dela) impede. Corpo: `condicao`,
     * `acao` (`aplicar`|`remover`), `turnos`, `ao_dano`.
     */
    public function condicao(Request $request, Mesa $mesa, Personagem $personagem, RegistroSistemas $sistemas, FichaCampos $fichas, Rolador $rolador): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        $sistema = $this->sistema($mesa, $sistemas);
        $catalogo = collect(method_exists($sistema, 'condicoes') ? $sistema->condicoes() : [])->keyBy('id');
        $entrada = $request->validate([
            'condicao' => ['required', 'string', Rule::in($catalogo->keys()->all())],
            'acao' => ['required', Rule::in(['aplicar', 'remover'])],
            // Duração: um número de turnos ou dados (`1d4`), sorteados aqui no servidor.
            'turnos' => ['nullable', 'string', 'regex:/^\d{1,2}(d\d{1,2})?$/'],
            'ao_dano' => ['nullable', 'boolean'],
            // Salvaguarda do ALVO contra a condição: o servidor rola `1d20 + salvaguarda do atributo` e só aplica se ficar abaixo da CD.
            'salvaguarda' => ['nullable', 'array'],
            'salvaguarda.atributo' => ['required_with:salvaguarda', 'string', 'max:10'],
            'salvaguarda.cd' => ['required_with:salvaguarda', 'integer', 'between:1,40'],
        ]);
        $turnos = isset($entrada['turnos']) ? $this->turnos($entrada['turnos'], $rolador) : null;
        $id = $entrada['condicao'];
        $nome = $catalogo[$id]['nome'];

        $resultado = DB::transaction(function () use ($personagem, $sistema, $fichas, $entrada, $id, $nome, $turnos, $rolador) {
            $p = Personagem::query()->whereKey($personagem->id)->lockForUpdate()->firstOrFail();
            $ficha = $p->fichaCompleta($sistema);
            $condicoes = array_values(array_diff($ficha['condicoes'] ?? [], [$id]));
            $duracoes = $ficha['duracoes'] ?? [];
            unset($duracoes[$id]);
            if ($entrada['acao'] === 'aplicar') {
                if (Dano::contem($ficha['imunidades'] ?? [], $nome) || Dano::contem($ficha['imunidades'] ?? [], $id)) {
                    return [$p, 'imune'];
                }
                if (isset($entrada['salvaguarda'])) {
                    $variaveis = $sistema->variaveisDeRolagem($ficha, []);
                    $chave = 'salv.'.strtolower($entrada['salvaguarda']['atributo']);
                    if (! array_key_exists($chave, $variaveis)) {
                        throw ValidationException::withMessages(['salvaguarda.atributo' => 'Atributo de salvaguarda desconhecido neste sistema.']);
                    }
                    $teste = $rolador->rolar("1d20+@{$chave}", $variaveis)['total'];
                    if ($teste >= (int) $entrada['salvaguarda']['cd']) {
                        return [$p, 'resistiu', null, $teste];
                    }
                    $falhou = $teste;
                }
                $condicoes[] = $id;
                if ($turnos !== null || ! empty($entrada['ao_dano'])) {
                    $duracoes[$id] = ['turnos' => $turnos ?? 99, 'aoDano' => (bool) ($entrada['ao_dano'] ?? false)];
                }
            }
            $campos = ['condicoes' => $condicoes];
            if (array_key_exists('duracoes', $ficha)) {
                $campos['duracoes'] = $duracoes;
            }
            $p->ficha = $fichas->aplicar($sistema, $p->ficha, $campos);
            $p->save();

            return [$p, $entrada['acao'], $campos, $falhou ?? null];
        });

        [$alvo, $situacao] = $resultado;
        if ($situacao === 'resistiu') {
            $texto = "{$alvo->nome} resistiu a {$nome} (salvaguarda {$resultado[3]} contra CD {$entrada['salvaguarda']['cd']}).";
            $this->avisar($mesa, $acesso, 'todos', $texto);

            return response()->json(['imune' => false, 'resistiu' => true, 'texto' => $texto]);
        }
        if ($situacao === 'imune') {
            $this->avisar($mesa, $acesso, 'todos', "{$alvo->nome} é imune a {$nome}.");

            return response()->json(['imune' => true, 'texto' => "{$alvo->nome} é imune a {$nome}."]);
        }
        Duracoes::transmitir($mesa, $alvo, $resultado[2], true);
        $duracao = $turnos !== null ? " por {$turnos} turno".($turnos > 1 ? 's' : '').(! empty($entrada['ao_dano']) ? ' (ou até receber dano)' : '') : (! empty($entrada['ao_dano']) ? ' até receber dano' : '');
        $falha = isset($resultado[3]) ? " (falhou na salvaguarda: {$resultado[3]} contra CD {$entrada['salvaguarda']['cd']})" : '';
        $texto = $situacao === 'aplicar' ? "{$alvo->nome} recebeu a condição {$nome}{$duracao}{$falha}." : "{$alvo->nome} não está mais {$nome}.";
        $this->avisar($mesa, $acesso, 'todos', $texto);

        return response()->json(['imune' => false, 'texto' => $texto]);
    }

    /** `3` vale 3 turnos; `1d4` sorteia 1 a 4 (decisão do servidor). */
    private function turnos(string $valor, Rolador $rolador): int
    {
        return max(1, min(99, (int) (str_contains($valor, 'd') ? $rolador->rolar($valor)['total'] : $valor)));
    }

    private function sistema(Mesa $mesa, RegistroSistemas $sistemas): Sistema
    {
        return $sistemas->resolver($mesa->sistema->slug)
            ?? throw ValidationException::withMessages(['sistema' => "O sistema {$mesa->sistema->nome} ainda não tem ficha."]);
    }

    /** @param  array{final: int, modo: string}  $calculo */
    private function textoDoDano(string $nome, int $total, ?string $tipo, array $calculo): string
    {
        $tipoTexto = filled($tipo) ? " de {$tipo}" : '';

        return match ($calculo['modo']) {
            'imune' => "{$nome} é imune a dano{$tipoTexto}: nenhum dano.",
            'resistido' => "{$nome} recebeu {$calculo['final']} de dano{$tipoTexto} (resistência: {$total} pela metade).",
            'vulneravel' => "{$nome} recebeu {$calculo['final']} de dano{$tipoTexto} (vulnerável: {$total} em dobro).",
            default => "{$nome} recebeu {$calculo['final']} de dano{$tipoTexto}.",
        };
    }

    /** Mensagem de texto no chat, na mesma visibilidade do dano (rolagem secreta/do mestre não vaza o aviso). */
    private function avisar(Mesa $mesa, AcessoMesa $acesso, string $visibilidade, string $texto): void
    {
        $mensagem = $mesa->mensagens()->create([
            'jogador_id' => $acesso->jogador->id, 'personagem_id' => null, 'tipo' => 'texto',
            'visibilidade' => $visibilidade === 'secreto' ? 'mestre' : $visibilidade, 'texto' => $texto, 'dados' => null,
        ]);
        EntregarMensagem::para($mesa, $mensagem, $acesso);
    }
}
