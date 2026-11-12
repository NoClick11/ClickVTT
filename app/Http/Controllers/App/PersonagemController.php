<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Http\Requests\Site\PersonagemRequest;
use App\Models\Mesa;
use App\Models\Objeto;
use App\Models\Personagem;
use App\Nucleo\Combate\CombateService;
use App\Support\AcessoMesa;
use App\Support\OtimizarImagem;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class PersonagemController extends Controller
{
    /**
     * O mestre cria um personagem de dentro do jogo (as mesmas regras do site: nome único na mesa, cor, jogadores
     * da mesa). Sem jogadores é um NPC, que só o mestre controla. A ficha nasce com os valores padrão do sistema.
     */
    public function criar(Request $request, Mesa $mesa): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        $dados = Validator::make($request->all(), PersonagemRequest::regrasPara($mesa), PersonagemRequest::mensagens())->validate();

        $personagem = $mesa->personagens()->create(['nome' => trim($dados['nome']), 'cor' => $dados['cor']]);
        $personagem->jogadores()->sync($dados['jogadores'] ?? []);
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($personagem->load('jogadores')->paraFront(), 201);
    }

    /** O mestre escolhe os jogadores de um personagem (N:N). */
    public function atribuir(Request $request, Mesa $mesa, Personagem $personagem): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);

        $dados = $request->validate([
            'jogadores' => ['present', 'array'],
            'jogadores.*' => ['integer', Rule::exists('jogadores', 'id')->where('mesa_id', $mesa->id)->where('papel', 'jogador')],
        ]);
        $personagem->jogadores()->sync($dados['jogadores']);
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($personagem->load('jogadores')->paraFront());
    }

    /**
     * Renomeia um personagem ou NPC na mesa (só o mestre).
     * O nome deve ser único na mesa e atualiza também os tokens vinculados no mapa.
     */
    public function renomear(Request $request, Mesa $mesa, Personagem $personagem): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);

        $dados = $request->validate([
            'nome' => ['required', 'string', 'max:60', Rule::unique('personagens', 'nome')->where('mesa_id', $mesa->id)->ignore($personagem->id)],
        ]);

        $novoNome = trim($dados['nome']);
        $personagem->update(['nome' => $novoNome]);

        // Atualiza o nome dos tokens deste personagem no mapa
        Objeto::query()->where('personagem_id', $personagem->id)->where('tipo', 'token')->update(['nome' => $novoNome]);

        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json($personagem->load('jogadores')->paraFront($acesso->podeControlar($personagem->id)));
    }

    /**
     * Altera ou remove a foto do personagem (PC ou NPC).
     * O mestre pode alterar qualquer um; o jogador só os seus.
     */
    public function foto(Request $request, Mesa $mesa, Personagem $personagem): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        abort_unless($acesso->podeControlar($personagem->id), 403, 'Você não controla este personagem.');

        $request->validate([
            'arquivo' => ['nullable', 'file', 'image', 'mimes:png,jpg,jpeg,webp,gif', 'max:10240'],
            'arquivo_token' => ['nullable', 'file', 'image', 'mimes:png,jpg,jpeg,webp,gif', 'max:10240'],
            'url' => ['nullable', 'string', 'max:2000'],
            'remover' => ['nullable', 'boolean'],
        ]);

        $ficha = $personagem->ficha ?? [];
        $fotoAntiga = $ficha['foto'] ?? null;
        $fotoTokenAntiga = $ficha['foto_token'] ?? null;
        $novaFoto = null;
        $novaFotoToken = null;

        if ($request->boolean('remover')) {
            $novaFoto = null;
            $novaFotoToken = null;
        } elseif ($request->hasFile('arquivo')) {
            $caminho = OtimizarImagem::armazenar($request->file('arquivo'), 'personagens');
            $novaFoto = '/storage/'.$caminho;
            if ($request->hasFile('arquivo_token')) {
                $caminhoToken = OtimizarImagem::armazenar($request->file('arquivo_token'), 'personagens');
                $novaFotoToken = '/storage/'.$caminhoToken;
            } else {
                $novaFotoToken = $novaFoto;
            }
        } elseif ($request->filled('url')) {
            $novaFoto = trim((string) $request->input('url'));
            $novaFotoToken = $novaFoto;
        } else {
            return response()->json(['ok' => true, 'foto' => $fotoAntiga, 'foto_token' => $fotoTokenAntiga]);
        }

        if ($fotoAntiga && $fotoAntiga !== $novaFoto && str_starts_with($fotoAntiga, '/storage/personagens/')) {
            Storage::disk('public')->delete(substr($fotoAntiga, 9));
        }
        if ($fotoTokenAntiga && $fotoTokenAntiga !== $novaFotoToken && $fotoTokenAntiga !== $fotoAntiga && str_starts_with($fotoTokenAntiga, '/storage/personagens/')) {
            Storage::disk('public')->delete(substr($fotoTokenAntiga, 9));
        }

        if ($novaFoto) {
            $ficha['foto'] = $novaFoto;
            $ficha['foto_token'] = $novaFotoToken;
        } else {
            unset($ficha['foto'], $ficha['foto_token']);
        }

        $personagem->forceFill(['ficha' => $ficha])->save();

        $idsPersonagens = [$personagem->id];

        // Se for um modelo de NPC ou uma instância de NPC, sincroniza modelo e instâncias filhas
        $npc = $personagem->ficha['npc'] ?? null;
        if (is_array($npc)) {
            $modeloId = $npc['instancia_de'] ?? $personagem->id;

            // Se esta era uma instância, atualiza o modelo de origem também
            if (! empty($npc['instancia_de'])) {
                $modelo = Personagem::query()->where('mesa_id', $mesa->id)->find($npc['instancia_de']);
                if ($modelo) {
                    $modeloFicha = $modelo->ficha ?? [];
                    if ($novaFoto) {
                        $modeloFicha['foto'] = $novaFoto;
                        $modeloFicha['foto_token'] = $novaFotoToken;
                    } else {
                        unset($modeloFicha['foto'], $modeloFicha['foto_token']);
                    }
                    $modelo->forceFill(['ficha' => $modeloFicha])->save();
                    $idsPersonagens[] = $modelo->id;
                }
            }

            // Atualiza todas as instâncias filhas do modelo na mesa
            $instancias = Personagem::query()
                ->where('mesa_id', $mesa->id)
                ->where('ficha->npc->instancia_de', $modeloId)
                ->where('id', '!=', $personagem->id)
                ->get();

            foreach ($instancias as $instancia) {
                $instFicha = $instancia->ficha ?? [];
                if ($novaFoto) {
                    $instFicha['foto'] = $novaFoto;
                    $instFicha['foto_token'] = $novaFotoToken;
                } else {
                    unset($instFicha['foto'], $instFicha['foto_token']);
                }
                $instancia->forceFill(['ficha' => $instFicha])->save();
                $idsPersonagens[] = $instancia->id;
            }
        }

        // Atualiza tokens existentes do personagem (e de suas instâncias de NPC) que usavam a foto antiga ou não tinham arquivo
        $tokens = Objeto::query()
            ->whereIn('personagem_id', $idsPersonagens)
            ->where('tipo', 'token')
            ->get();

        $caminhoRelativoTokenNovo = $novaFotoToken ? (str_starts_with($novaFotoToken, '/storage/') ? substr($novaFotoToken, 9) : $novaFotoToken) : null;
        $caminhoRelativoTokenAntigo = $fotoTokenAntiga ? (str_starts_with($fotoTokenAntiga, '/storage/') ? substr($fotoTokenAntiga, 9) : $fotoTokenAntiga) : null;
        $caminhoRelativoFotoAntigo = $fotoAntiga ? (str_starts_with($fotoAntiga, '/storage/') ? substr($fotoAntiga, 9) : $fotoAntiga) : null;

        foreach ($tokens as $token) {
            if (empty($token->arquivo) || $token->arquivo === $caminhoRelativoTokenAntigo || $token->arquivo === $caminhoRelativoFotoAntigo) {
                $token->arquivo = $caminhoRelativoTokenNovo;
                if ($caminhoRelativoTokenNovo) {
                    $ext = pathinfo($caminhoRelativoTokenNovo, PATHINFO_EXTENSION);
                    $token->arquivo_tipo = match (strtolower($ext)) {
                        'webm', 'mp4' => 'video',
                        'gif' => 'gif',
                        default => 'imagem',
                    };
                } else {
                    $token->arquivo_tipo = null;
                }
                $token->save();
            }
        }

        foreach ($idsPersonagens as $pid) {
            Transmitir::enviar($mesa, 'personagem:foto', [
                'personagem_id' => $pid,
                'foto' => $novaFoto,
                'foto_token' => $novaFotoToken,
            ], ['mesa']);
        }
        Transmitir::cena($mesa, null, $acesso->jogador->id);

        return response()->json([
            'ok' => true,
            'foto' => $novaFoto,
            'foto_token' => $novaFotoToken,
            'personagem' => $personagem->fresh()->load('jogadores')->paraFront($acesso->podeControlar($personagem->id)),
        ]);
    }

    /**
     * O mestre exclui um personagem: some a ficha, os tokens dele em todas as páginas e o lugar dele no combate (se era o turno
     * dele, passa para o primeiro da fila). Os itens da mesa não são tocados. Não dá para desfazer.
     */
    public function excluir(Request $request, Mesa $mesa, Personagem $personagem): JsonResponse
    {
        $acesso = AcessoMesa::exigirMestre($request, $mesa);
        abort_unless($personagem->mesa_id === $mesa->id, 404);
        $this->apagar($mesa, $personagem, $acesso->jogador->id);

        return response()->json(['ok' => true]);
    }

    /** Apaga o personagem e tudo que depende dele (tokens, vez no combate) e avisa a mesa. Usado também ao sumir a última cópia de um NPC. */
    public function apagar(Mesa $mesa, Personagem $personagem, int $atorId): void
    {
        $combate = DB::transaction(function () use ($mesa, $personagem) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $c = CombateService::normalizar($m->combate);
            $antes = count($c['itens']);
            $removidos = array_column(array_filter($c['itens'], fn ($i) => $i['personagem_id'] === $personagem->id), 'id');
            $c['itens'] = array_values(array_filter($c['itens'], fn ($i) => $i['personagem_id'] !== $personagem->id));
            if (in_array($c['atual'], $removidos, true)) {
                $c['atual'] = $c['fase'] === 'em_curso' ? ($c['itens'][0]['id'] ?? null) : null;
            }
            $mudou = count($c['itens']) !== $antes;
            if ($mudou) {
                $m->forceFill(['combate' => $c])->save();
            }
            Objeto::query()->where('personagem_id', $personagem->id)->delete(); // os tokens dele em todas as páginas
            $personagem->delete();

            return $mudou ? $c : null;
        });

        if ($combate) {
            Transmitir::enviar($mesa, 'combate', ['combate' => $combate, 'ator' => $atorId], ['mesa']);
        }
        Transmitir::cena($mesa, null, $atorId);
    }
}
