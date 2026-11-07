<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Loja\LojaService;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Sistemas\OnePiece\Ferreiro;
use App\Sistemas\OnePiece\Forja;
use App\Sistemas\OnePiece\Itens;
use App\Sistemas\OnePiece\OnePiece;
use App\Sistemas\OnePiece\Regras;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Forja do Ferreiro (cap. 4, "Forjar Equipamentos" e "Lâminas"): cria armas e equipamentos do catálogo gastando 1 lingote de metal do
 * inventário e Belly, e aprimora a arma de QUALQUER personagem (a própria ou a de outro) com os Pontos de Forja do ferreiro: Meito,
 * Yoto, Expertise, Supremacia, Densidade, Dureza, Balanço e Fio. O servidor rola o Teste, confere os PF, os materiais e o dinheiro.
 */
class ForjaController extends Controller
{
    /** As armas do inventário de um personagem (o que o ferreiro pode aprimorar), com a forja e o dano atuais. */
    public function armas(Request $request, Mesa $mesa, RegistroSistemas $sistemas): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $this->sistema($mesa, $sistemas);
        $dados = $request->validate(['personagem_id' => ['required', 'integer', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)]]);
        $this->exigirFerreiro($mesa, $acesso);
        $alvo = Personagem::findOrFail($dados['personagem_id']);
        $ids = collect($alvo->ficha['inventario'] ?? [])->flatMap(fn ($s) => collect($s['itens'] ?? [])->pluck('item_id'))->unique()->all();
        $armas = $mesa->itens()->whereIn('id', $ids)->get()->filter(fn (Item $i) => is_array($i->dados['arma'] ?? null))->map(function (Item $i) {
            $arma = $i->dados['arma'];

            return [
                'item_id' => $i->id, 'nome' => $i->nome, 'dano' => $arma['dano'] ?? null, 'tipoDano' => $arma['tipoDano'] ?? null,
                'cortante' => str_contains(\App\Nucleo\Combate\Dano::normalizar((string) ($arma['tipoDano'] ?? '')), 'cortante'),
                'forja' => $arma['forja'] ?? new \stdClass,
            ];
        })->values();

        return response()->json(['armas' => $armas]);
    }

    /** Forjar um item do catálogo: Teste (Força, Destreza ou Sabedoria) contra a CD; no sucesso gasta 1 lingote e o dinheiro e entrega. */
    public function criar(Request $request, Mesa $mesa, RegistroSistemas $sistemas, LojaService $loja, Rolador $rolador): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $sistema = $this->sistema($mesa, $sistemas);
        $d = $request->validate(['ferreiro_id' => ['required', 'integer'], 'item' => ['required', 'string', 'max:60'], 'atributo' => ['required', Rule::in(['for', 'des', 'sab'])]]);
        abort_unless($acesso->podeControlar($d['ferreiro_id']), 403, 'Esta ficha não é sua.');
        $entrada = $loja->entrada($mesa, $sistema, $d['item']);
        if (! $entrada || ($entrada['tipo'] ?? 'item') !== 'item' || $entrada['preco'] === null) {
            throw ValidationException::withMessages(['item' => 'Este item não pode ser forjado.']);
        }

        $r = DB::transaction(function () use ($mesa, $sistema, $loja, $rolador, $d, $entrada) {
            $p = Personagem::query()->whereKey($d['ferreiro_id'])->where('mesa_id', $mesa->id)->lockForUpdate()->firstOrFail();
            $ficha = $p->ficha ?? $sistema->fichaPadrao();
            if (! Ferreiro::ehFerreiro($ficha)) {
                throw ValidationException::withMessages(['ferreiro' => "{$p->nome} não tem a profissão Ferreiro."]);
            }
            $custo = Forja::custoEmDinheiro((int) $entrada['preco']);
            $this->exigirMateriais($mesa, $ficha, $custo, $entrada['nome']);
            $itens = $this->itensDoInventario($mesa, $sistema, $ficha);
            $variaveis = $sistema->variaveisDeRolagem($ficha, $itens);
            $cd = Ferreiro::cd($ficha);
            $teste = $rolador->rolar("1d20+@mod.{$d['atributo']}+@prof", $variaveis);
            $sucesso = $teste['total'] >= $cd;
            if ($sucesso) {
                $item = $loja->materializar($mesa, $sistema, $entrada);
                $ficha = $this->gastarMateriais($mesa, $sistema, $ficha, $custo);
                $ficha = $sistema->entregarNoInventario($ficha, $item->id, 1);
                if (($entrada['categoria'] ?? '') === 'armas-cortantes') {
                    $ficha['forja']['laminas'] = (int) ($ficha['forja']['laminas'] ?? 0) + 1;
                }
                $p->ficha = $ficha;
                $p->save();
            }

            return ['p' => $p, 'teste' => $teste, 'cd' => $cd, 'sucesso' => $sucesso, 'custo' => $custo, 'ficha' => $ficha];
        });

        $p = $r['p'];
        $texto = sprintf('%s tenta forjar %s: %s (Teste CD %d) — %s.', $p->nome, $entrada['nome'], $r['teste']['total'], $r['cd'], $r['sucesso']
            ? 'sucesso! Gastou 1 lingote de metal e ฿ '.number_format($r['custo'], 0, ',', '.')
            : 'falhou, nada foi gasto');
        $this->avisar($mesa, $acesso, $p, $texto);
        $campos = $this->camposDaFicha($r['ficha']);
        $this->transmitir($mesa, $acesso, $p, $campos);
        Transmitir::cena($mesa, null, $acesso->jogador->id); // quem recebe o item novo recarrega os itens da mesa

        return response()->json(['sucesso' => $r['sucesso'], 'total' => $r['teste']['total'], 'cd' => $r['cd'], 'custo' => $r['custo'], 'campos' => $campos, 'texto' => $texto]);
    }

    /**
     * Aprimora uma arma (de qualquer personagem) com os PF do ferreiro. A arma vira uma CÓPIA forjada (a original, que outros podem ter,
     * não muda). Custo: PF + 1 lingote + ฿ 20.000 ou 20% do valor da arma (o maior), pagos pelo ferreiro.
     */
    public function aprimorar(Request $request, Mesa $mesa, RegistroSistemas $sistemas): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $sistema = $this->sistema($mesa, $sistemas);
        $d = $request->validate([
            'ferreiro_id' => ['required', 'integer'],
            'alvo_id' => ['required', 'integer', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            'item_id' => ['required', 'integer'],
            'melhorias' => ['required', 'array'],
            'melhorias.meito' => ['nullable', 'string', Rule::in(Forja::ids('meito'))],
            'melhorias.yoto' => ['nullable', 'string', Rule::in(Forja::ids('yoto'))],
            'melhorias.expertise' => ['nullable', 'array', 'max:2'],
            'melhorias.expertise.*' => ['string', Rule::in(Forja::ids('expertises'))],
            'melhorias.densidade' => ['nullable', 'string', Rule::in(Forja::catalogo()['tiposFisicos'])],
            'melhorias.dureza' => ['nullable', 'boolean'],
            'melhorias.balanco' => ['nullable', 'boolean'],
            'melhorias.fio' => ['nullable', 'integer', 'between:0,'.Forja::catalogo()['maxFio']],
        ]);
        abort_unless($acesso->podeControlar($d['ferreiro_id']), 403, 'Esta ficha não é sua.');

        $r = DB::transaction(function () use ($mesa, $sistema, $d, $acesso) {
            $ids = array_values(array_unique([$d['ferreiro_id'], $d['alvo_id']]));
            sort($ids);
            $linhas = Personagem::query()->whereIn('id', $ids)->where('mesa_id', $mesa->id)->orderBy('id')->lockForUpdate()->get()->keyBy('id');
            $ferreiro = $linhas[$d['ferreiro_id']] ?? abort(404);
            $alvo = $linhas[$d['alvo_id']] ?? abort(404);
            $fichaF = $ferreiro->ficha ?? $sistema->fichaPadrao();
            if (! Ferreiro::ehFerreiro($fichaF)) {
                throw ValidationException::withMessages(['ferreiro' => "{$ferreiro->nome} não tem a profissão Ferreiro."]);
            }
            $fichaA = $alvo->id === $ferreiro->id ? $fichaF : ($alvo->ficha ?? $sistema->fichaPadrao());
            $item = $mesa->itens()->find($d['item_id']);
            $arma = $item?->dados['arma'] ?? null;
            if (! $item || ! is_array($arma) || ! in_array($item->id, $sistema->itensReferenciados($fichaA), true)) {
                throw ValidationException::withMessages(['item' => 'Esta arma não está no inventário do personagem.']);
            }
            $antiga = (array) ($arma['forja'] ?? []);
            $nova = $this->mesclar($antiga, $d['melhorias']);
            $cortante = str_contains(\App\Nucleo\Combate\Dano::normalizar((string) ($arma['tipoDano'] ?? '')), 'cortante');
            if ($problemas = Forja::problemas($nova, $cortante)) {
                throw ValidationException::withMessages(['melhorias' => $problemas[0]]);
            }
            $custoPF = Forja::custoEmPF($antiga, $nova);
            if ($custoPF === null || $custoPF['total'] < 1) {
                throw ValidationException::withMessages(['melhorias' => $custoPF === null ? 'Não dá para tirar ou reduzir melhorias já feitas.' : 'Escolha ao menos uma melhoria.']);
            }
            $pf = Ferreiro::pontos($fichaF);
            if ($pf['disponiveis'] < $custoPF['total']) {
                throw ValidationException::withMessages(['pf' => "Faltam Pontos de Forja: custa {$custoPF['total']} e {$ferreiro->nome} tem {$pf['disponiveis']}."]);
            }
            $custo = Forja::custoEmDinheiro($this->precoBase($mesa, $sistema, $item));
            $this->exigirMateriais($mesa, $fichaF, $custo, $item->nome);

            // a cópia forjada (some da aba Itens do mestre: `catalogo_id` começa com "forjado:")
            $dados = $item->dados;
            $dados['arma']['forja'] = $nova;
            if ($nova === []) {
                unset($dados['arma']['forja']);
            }
            $copia = $mesa->itens()->create([
                'catalogo_id' => 'forjado:'.($item->catalogo_id ?: 'mesa').':'.bin2hex(random_bytes(3)),
                'nome' => $item->nome, 'peso' => $item->peso, 'equipavel' => $item->equipavel, 'requer_sintonia' => $item->requer_sintonia, 'efeitos' => $item->efeitos,
                'descricao' => trim(mb_substr((string) $item->descricao, 0, 1700)."\nForjada por {$ferreiro->nome}: ".implode(', ', $custoPF['itens']).'.'),
                'dados' => $dados,
            ]);

            $fichaA = $this->trocarNoInventario($fichaA, $item->id, $copia->id);
            if ($alvo->id === $ferreiro->id) {
                $fichaF = $fichaA;
            }
            $fichaF = $this->gastarMateriais($mesa, $sistema, $fichaF, $custo);
            $fichaF['forja']['gastos'] = (int) ($fichaF['forja']['gastos'] ?? 0) + $custoPF['total'];
            if ($alvo->id === $ferreiro->id) {
                $fichaA = $fichaF;
            }
            $ferreiro->ficha = $fichaF;
            $ferreiro->save();
            if ($alvo->id !== $ferreiro->id) {
                $alvo->ficha = $fichaA;
                $alvo->save();
            }

            return compact('ferreiro', 'alvo', 'fichaF', 'fichaA', 'custoPF', 'custo', 'item', 'copia');
        });

        $texto = sprintf('%s aprimora %s de %s: %s (%d PF, 1 lingote e ฿ %s).', $r['ferreiro']->nome, $r['item']->nome, $r['alvo']->nome, implode(', ', $r['custoPF']['itens']), $r['custoPF']['total'], number_format($r['custo'], 0, ',', '.'));
        $this->avisar($mesa, $acesso, $r['ferreiro'], $texto);
        $camposF = $this->camposDaFicha($r['fichaF']);
        $this->transmitir($mesa, $acesso, $r['ferreiro'], $camposF);
        $camposA = $this->camposDaFicha($r['fichaA']);
        if ($r['alvo']->id !== $r['ferreiro']->id) {
            $this->transmitir($mesa, $acesso, $r['alvo'], $camposA);
        }
        Transmitir::cena($mesa, null, $acesso->jogador->id); // o dono da arma recarrega os itens (a cópia forjada é nova)

        return response()->json([
            'texto' => $texto, 'pf' => Ferreiro::pontos($r['fichaF']), 'camposFerreiro' => $camposF, 'camposAlvo' => $camposA, 'alvo_id' => $r['alvo']->id, 'item' => $r['copia']->paraFront(),
        ]);
    }

    private function sistema(Mesa $mesa, RegistroSistemas $sistemas): OnePiece
    {
        $s = $sistemas->resolver($mesa->sistema->slug);
        abort_unless($s instanceof OnePiece, 422, 'Este sistema não tem forja.');

        return $s;
    }

    /** Só quem controla um Ferreiro (ou o mestre) consulta as armas dos outros. */
    private function exigirFerreiro(Mesa $mesa, AcessoMesa $acesso): void
    {
        if ($acesso->ehMestre()) {
            return;
        }
        $achou = $mesa->personagens()->whereIn('id', $acesso->personagensPermitidos())->get()->contains(fn ($p) => Ferreiro::ehFerreiro($p->ficha ?? []));
        abort_unless($achou, 403, 'Só um Ferreiro aprimora armas.');
    }

    /** As melhorias pedidas por cima da forja atual (o que não veio fica; `kokuto` nunca muda por aqui). @return array<string, mixed> */
    private function mesclar(array $antiga, array $m): array
    {
        $nova = $antiga;
        foreach (['meito', 'yoto', 'densidade'] as $k) {
            if (array_key_exists($k, $m)) {
                $nova[$k] = $m[$k] ?: null;
            }
        }
        foreach (['dureza', 'balanco'] as $k) {
            if (array_key_exists($k, $m)) {
                $nova[$k] = (bool) $m[$k];
            }
        }
        if (array_key_exists('expertise', $m)) {
            $nova['expertise'] = array_values($m['expertise'] ?? []);
        }
        if (array_key_exists('fio', $m)) {
            $nova['fio'] = (int) $m['fio'];
        }

        return array_filter($nova, fn ($v) => $v !== null && $v !== [] && $v !== false && $v !== 0);
    }

    private function precoBase(Mesa $mesa, OnePiece $sistema, Item $item): ?int
    {
        $ref = (string) $item->catalogo_id;
        if (str_starts_with($ref, 'forjado:')) {
            $ref = explode(':', $ref)[1] ?? '';
        }
        if ($ref === '') {
            return null;
        }
        $e = app(LojaService::class)->entrada($mesa, $sistema, $ref);

        return $e ? ($e['preco'] === null ? null : (int) $e['preco']) : null;
    }

    /** Falta lingote ou dinheiro? Lança o erro com o que falta. */
    private function exigirMateriais(Mesa $mesa, array $ficha, int $custo, string $nome): void
    {
        if ($this->refDoLingote($mesa, $ficha) === null) {
            throw ValidationException::withMessages(['materiais' => "Falta 1 Lingote de Metal no inventário para trabalhar em {$nome}."]);
        }
        $belly = (int) ($ficha['belly'] ?? 0);
        if ($belly < $custo) {
            throw ValidationException::withMessages(['dinheiro' => sprintf('Sem dinheiro: o trabalho em %s custa ฿ %s e há ฿ %s.', $nome, number_format($custo, 0, ',', '.'), number_format($belly, 0, ',', '.'))]);
        }
    }

    /** @return array{0: int, 1: int}|null [seção, índice] da referência do lingote de metal com ao menos 1 unidade */
    private function refDoLingote(Mesa $mesa, array $ficha): ?array
    {
        // o lingote comprado na loja (`catalogo_id`) ou um item do mestre chamado "Lingote de Metal"
        $ids = $mesa->itens()->where(fn ($q) => $q->where('catalogo_id', 'lingote-de-metal')->orWhereRaw('lower(nome) like ?', ['lingote de metal%']))->pluck('id')->all();
        foreach ($ficha['inventario'] ?? [] as $s => $secao) {
            foreach ($secao['itens'] ?? [] as $i => $ref) {
                if (in_array((int) ($ref['item_id'] ?? 0), $ids, true) && (int) ($ref['qtd'] ?? 0) >= 1) {
                    return [$s, $i];
                }
            }
        }

        return null;
    }

    /** Tira 1 lingote do inventário e o dinheiro da ficha. */
    private function gastarMateriais(Mesa $mesa, OnePiece $sistema, array $ficha, int $custo): array
    {
        $pos = $this->refDoLingote($mesa, $ficha);
        if ($pos !== null) {
            [$s, $i] = $pos;
            $ficha['inventario'][$s]['itens'][$i]['qtd']--;
            if ($ficha['inventario'][$s]['itens'][$i]['qtd'] <= 0) {
                array_splice($ficha['inventario'][$s]['itens'], $i, 1);
            }
        }
        $ficha['belly'] = (int) ($ficha['belly'] ?? 0) - $custo;

        return $ficha;
    }

    /** Troca o item no inventário pela cópia forjada: se havia só uma unidade, no mesmo lugar (mantém equipada); senão, uma unidade sai e a cópia entra. */
    private function trocarNoInventario(array $ficha, int $velhoId, int $novoId): array
    {
        foreach ($ficha['inventario'] ?? [] as $s => $secao) {
            foreach ($secao['itens'] ?? [] as $i => $ref) {
                if ((int) ($ref['item_id'] ?? 0) !== $velhoId) {
                    continue;
                }
                if ((int) $ref['qtd'] <= 1) {
                    $ficha['inventario'][$s]['itens'][$i]['item_id'] = $novoId;
                } else {
                    $ficha['inventario'][$s]['itens'][$i]['qtd']--;
                    $ficha['inventario'][$s]['itens'][] = ['item_id' => $novoId, 'qtd' => 1, 'equipado' => false, 'sintonizado' => false];
                }

                return $ficha;
            }
        }

        return $ficha;
    }

    /** @return array<int, array<string, mixed>> os itens (da mesa) que a ficha referencia, para calcular os Testes. */
    private function itensDoInventario(Mesa $mesa, OnePiece $sistema, array $ficha): array
    {
        $ids = $sistema->itensReferenciados($ficha);

        return $ids ? $mesa->itens()->whereIn('id', $ids)->get()->mapWithKeys(fn ($i) => [$i->id => $i->paraFront()])->all() : [];
    }

    /** @return array<string, mixed> */
    private function camposDaFicha(array $ficha): array
    {
        return ['belly' => (int) ($ficha['belly'] ?? 0), 'inventario' => $ficha['inventario'] ?? [], 'forja' => $ficha['forja'] ?? Ferreiro::padrao()];
    }

    private function transmitir(Mesa $mesa, AcessoMesa $acesso, Personagem $p, array $campos): void
    {
        $canais = ['mestre', ...$p->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all()];
        Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $p->id, 'campos' => $campos, 'criacao' => $p->criacao, 'ator' => $acesso->jogador->id], $canais);
    }

    /** O resultado vai para o chat (todos veem a forja acontecer). */
    private function avisar(Mesa $mesa, AcessoMesa $acesso, Personagem $p, string $texto): void
    {
        $mensagem = $mesa->mensagens()->create(['jogador_id' => $acesso->jogador->id, 'personagem_id' => $p->id, 'tipo' => 'texto', 'visibilidade' => 'todos', 'texto' => mb_substr($texto, 0, 1000)]);
        EntregarMensagem::para($mesa, $mensagem, $acesso);
    }
}
