<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Sistemas\FichaCampos;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/** Ficha do personagem: salva campo a campo (edição pontual) ou em lote (etapa da criação guiada). */
class FichaController extends Controller
{
    /**
     * Corpo: `campos` = {caminho: valor} (1 campo = edição pontual; vários = etapa de criação, aplicados juntos)
     * e, opcional, `criacao` = {etapa, concluida} (ou null para encerrar a criação guiada).
     * Só o mestre e os jogadores do personagem; quem valida é o módulo do sistema da mesa.
     */
    public function atualizar(Request $request, Mesa $mesa, Personagem $personagem, RegistroSistemas $sistemas, FichaCampos $fichas): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        abort_unless($acesso->podeControlar($personagem->id), 403, 'Esta ficha não é sua.');
        $sistema = $sistemas->resolver($mesa->sistema->slug)
            ?? throw ValidationException::withMessages(['campos' => "O sistema {$mesa->sistema->nome} ainda não tem ficha."]);

        $request->validate([
            // Só a criação guiada pode vir sem campos (salvar a etapa e as escolhas do assistente).
            'campos' => ['required_without:criacao', 'nullable', 'array'],
            'criacao' => ['nullable', 'array'],
            'criacao.etapa' => ['required_with:criacao', 'string', 'max:40'],
            'criacao.concluida' => ['boolean'],
            // Escolhas do assistente de criação (para retomar de onde parou): objeto pequeno, validado só no tamanho.
            'criacao.dados' => ['nullable', 'array'],
        ]);
        $campos = $request->input('campos') ?? [];
        $criacao = $request->has('criacao') ? $request->input('criacao') : false;

        // Trava a linha: duas edições simultâneas de campos diferentes não se sobrescrevem.
        $atual = DB::transaction(function () use ($personagem, $sistema, $fichas, $campos, $criacao, $acesso, $mesa) {
            $p = Personagem::query()->whereKey($personagem->id)->lockForUpdate()->firstOrFail();
            if ($campos !== []) {
                $nova = $fichas->aplicar($sistema, $p->ficha, $campos);
                $this->conferirItensNovos($mesa, $sistema->itensReferenciados($p->ficha ?? $sistema->fichaPadrao()), $sistema->itensReferenciados($nova), $acesso->ehMestre());
                $p->ficha = $nova;
            }
            if ($criacao !== false) {
                $p->criacao = $criacao === null ? null : $this->criacaoNova($p->criacao, $criacao);
            }
            $p->save();

            return $p;
        });

        // Quem vê a ficha: o mestre e os jogadores do personagem (nunca o canal aberto da mesa).
        $canais = ['mestre', ...$atual->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all()];
        Transmitir::enviar($mesa, 'ficha', [
            'personagem_id' => $atual->id, 'campos' => $campos, 'criacao' => $atual->criacao, 'ator' => $acesso->jogador->id,
        ], $canais);

        // Os ícones de efeito no token são públicos: quem muda as condições avisa a mesa toda (só os ids, nunca a ficha).
        if (array_key_exists('condicoes', $campos)) {
            Transmitir::enviar($mesa, 'status', ['personagem_id' => $atual->id, 'status' => array_values($atual->ficha['condicoes'] ?? [])], ['mesa']);
        }

        return response()->json(['ficha' => $atual->ficha ?? $sistema->fichaPadrao(), 'criacao' => $atual->criacao]);
    }

    /**
     * Estado da criação guiada: etapa, se terminou e as escolhas do assistente (`dados`). Os valores rolados dos atributos
     * (`dados.rolados`) só o servidor define: nunca mudam por aqui, para ninguém repetir a rolagem até gostar.
     *
     * @param  array<string, mixed>|null  $atual
     * @param  array<string, mixed>  $novo
     * @return array<string, mixed>
     */
    private function criacaoNova(?array $atual, array $novo): array
    {
        $dados = $novo['dados'] ?? ($atual['dados'] ?? []);
        if (strlen((string) json_encode($dados)) > 20_000) {
            throw ValidationException::withMessages(['criacao.dados' => 'Escolhas grandes demais.']);
        }
        unset($dados['rolados']);
        if (isset($atual['dados']['rolados'])) {
            $dados['rolados'] = $atual['dados']['rolados'];
        }

        return ['etapa' => $novo['etapa'], 'concluida' => (bool) ($novo['concluida'] ?? false), 'dados' => $dados];
    }

    /**
     * Rola os 6 valores de atributo da criação (4d6 descartando o menor, no servidor) e os guarda em `criacao.dados.rolados`.
     * É uma vez só: com valores já rolados devolve os mesmos.
     */
    public function rolarAtributos(Request $request, Mesa $mesa, Personagem $personagem, ?Rolador $rolador = null): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        abort_unless($acesso->podeControlar($personagem->id), 403, 'Esta ficha não é sua.');

        $rolados = DB::transaction(function () use ($personagem, $rolador) {
            $p = Personagem::query()->whereKey($personagem->id)->lockForUpdate()->firstOrFail();
            $criacao = $p->criacao ?? ['etapa' => 'atributos', 'concluida' => false, 'dados' => []];
            if (isset($criacao['dados']['rolados'])) {
                return $criacao['dados']['rolados'];
            }
            $rolador ??= new Rolador;
            $valores = array_map(fn () => $rolador->rolar('4d6kh3')['total'], range(1, 6));
            $criacao['dados'] = [...($criacao['dados'] ?? []), 'rolados' => $valores];
            $p->criacao = $criacao;
            $p->save();

            return $valores;
        });

        return response()->json(['rolados' => $rolados]);
    }

    /**
     * Item que ainda não estava no inventário só entra pela mão do MESTRE (é quem entrega) e precisa existir nesta
     * mesa. Jogador pode equipar, mudar quantidades e tirar itens, nunca acrescentar.
     *
     * @param  list<int>  $antes
     * @param  list<int>  $depois
     */
    private function conferirItensNovos(Mesa $mesa, array $antes, array $depois, bool $mestre): void
    {
        $novos = array_values(array_diff($depois, $antes));
        if ($novos === []) {
            return;
        }
        if (! $mestre) {
            throw ValidationException::withMessages(['campos.inventario' => 'Só o mestre entrega itens ao personagem.']);
        }
        if ($mesa->itens()->whereIn('id', $novos)->count() !== count($novos)) {
            throw ValidationException::withMessages(['campos.inventario' => 'Algum item não existe nesta mesa.']);
        }
    }
}
