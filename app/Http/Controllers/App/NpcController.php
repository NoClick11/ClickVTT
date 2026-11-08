<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Sistemas\FichaCampos;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * NPCs (só o mestre). Um NPC é um personagem sem jogadores cuja ficha traz o bloco `npc` (a ficha de uma tela só).
 * `criar` guarda um NPC novo (em branco ou copiado do catálogo, que é só leitura: o que o mestre edita é sempre a cópia).
 * `instanciar` cria a cópia que vira o token no mapa: cada token tem PV, PP e usos próprios, com nome numerado.
 */
class NpcController extends Controller
{
    private const COR_PADRAO = '#ef4444';

    /** Corpo: `nome`, `cor?`, `pasta_id?` e `campos` ({caminho: valor}, validados pelas regras da ficha do sistema; deve incluir `npc`). */
    public function criar(Request $request, Mesa $mesa, RegistroSistemas $sistemas, FichaCampos $fichas): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $sistema = $sistemas->resolver($mesa->sistema->slug);
        if ($mesa->sistema->slug !== 'one-piece' || ! $sistema) {
            throw ValidationException::withMessages(['campos' => 'Este sistema ainda não tem NPCs.']);
        }
        $dados = $request->validate([
            'nome' => ['required', 'string', 'max:60'],
            'cor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'pasta_id' => ['nullable', Rule::exists('diario_pastas', 'id')->where('mesa_id', $mesa->id)],
            'campos' => ['required', 'array'],
            'campos.npc' => ['required', 'array'],
        ]);
        // Os campos vêm do corpo inteiro (o `validate` só devolve as chaves com regra própria): quem valida cada um é o `FichaCampos`.
        $ficha = $fichas->aplicar($sistema, null, (array) $request->input('campos'));

        $personagem = DB::transaction(function () use ($mesa, $dados, $ficha) {
            Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $p = $mesa->personagens()->create([
                'nome' => $this->nomeLivre($mesa, trim($dados['nome'])),
                'cor' => $dados['cor'] ?? self::COR_PADRAO,
                'pasta_id' => $dados['pasta_id'] ?? null,
            ]);
            $p->ficha = $ficha;
            $p->save();

            return $p;
        });
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($personagem->load('jogadores')->paraFront(true, $sistema), 201);
    }

    /** A cópia do NPC para o mapa: PV e PP cheios, sem condições nem usos gastos, nome "Pirata 2". */
    public function instanciar(Request $request, Mesa $mesa, Personagem $personagem, RegistroSistemas $sistemas): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        $sistema = $sistemas->resolver($mesa->sistema->slug);
        $npc = $personagem->ficha['npc'] ?? null;
        if (! is_array($npc) || ! $sistema) {
            throw ValidationException::withMessages(['personagem' => 'Este personagem não é um NPC.']);
        }

        $copia = DB::transaction(function () use ($mesa, $personagem, $npc) {
            Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $origem = $npc['instancia_de'] ?? $personagem->id; // copiar uma cópia continua sendo do mesmo modelo
            $base = isset($npc['instancia_de']) ? preg_replace('/ \d+$/', '', $personagem->nome) : $personagem->nome;
            $ficha = $personagem->ficha;
            $ficha['npc'] = [...$npc, 'instancia_de' => $origem, 'usos' => [], 'lendarias_usadas' => 0];
            $ficha['pv']['atual'] = (int) ($ficha['pv']['max'] ?? 0);
            $ficha['pv']['temp'] = 0;
            $ficha['pv']['escudo'] = 0;
            $ficha['pp']['atual'] = (int) ($npc['pp'] ?? 0);
            foreach (['condicoes', 'duracoes', 'reducao', 'bonusTecnica'] as $campo) {
                $ficha[$campo] = [];
            }

            $c = $mesa->personagens()->create([
                'nome' => $this->proximoNumero($mesa, $base),
                'cor' => $personagem->cor,
                'pasta_id' => $personagem->pasta_id,
            ]);
            $c->ficha = $ficha;
            $c->save();

            return $c;
        });
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($copia->load('jogadores')->paraFront(true, $sistema), 201);
    }

    /** O nome pedido, ou com " 2", " 3"... se já existir na mesa (o nome é único por mesa). */
    private function nomeLivre(Mesa $mesa, string $nome): string
    {
        $existentes = $mesa->personagens()->pluck('nome')->all();
        if (! in_array($nome, $existentes, true)) {
            return $nome;
        }

        return $this->proximoNumero($mesa, $nome);
    }

    /** "Base N" com o menor N ≥ 1 ainda livre. */
    private function proximoNumero(Mesa $mesa, string $base): string
    {
        $existentes = array_flip($mesa->personagens()->pluck('nome')->all());
        for ($n = 1; isset($existentes["{$base} {$n}"]); $n++);

        return "{$base} {$n}";
    }
}
