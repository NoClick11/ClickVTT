<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mesa;
use App\Models\Objeto;
use App\Models\Pagina;
use App\Nucleo\Cena\Paredes;
use App\Nucleo\Combate\CombateService;
use App\Nucleo\Combate\TecnicasAtivas;
use App\Support\AcessoMesa;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ObjetoController extends Controller
{
    /** Tipos que o JOGADOR também pode criar (sempre na camada Jogadores, na página onde está). */
    private const TIPOS_DO_JOGADOR = ['traco', 'texto'];

    public function store(Request $request, Mesa $mesa, Pagina $pagina): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($pagina->mesa_id === $mesa->id, 404);

        $dados = $request->validate([
            'camada' => ['required', Rule::in(Objeto::CAMADAS)],
            'tipo' => ['required', Rule::in(Objeto::TIPOS)],
            'personagem_id' => ['nullable', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            'nome' => ['nullable', 'string', 'max:80'],
            'x' => ['required', 'numeric'],
            'y' => ['required', 'numeric'],
            'largura' => ['required', 'numeric', 'min:1', 'max:20000'],
            'altura' => ['required', 'numeric', 'min:1', 'max:20000'],
            'z' => ['sometimes', 'integer'],
            'arquivo' => ['nullable', 'file', 'mimes:png,jpg,jpeg,webp,gif,webm,mp4', 'max:102400'],
            'dados' => ['nullable', 'array'],
            'dados.pontos' => ['required_if:tipo,parede,traco', 'array', 'min:4', 'max:6000'],
            'dados.pontos.*' => ['numeric'],
            'dados.tipo' => ['nullable', Rule::in(['parede', 'porta', 'janela'])],
            'dados.raio' => ['required_if:tipo,luz', 'numeric', 'min:1'],
            'dados.cor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'dados.aberta' => ['nullable', 'boolean'],
            'dados.espessura' => ['nullable', 'numeric', 'min:1', 'max:80'],
            'dados.largura_original' => ['nullable', 'numeric', 'min:1'],
            'dados.altura_original' => ['nullable', 'numeric', 'min:1'],
            'dados.texto' => ['required_if:tipo,texto', 'nullable', 'string', 'max:500'],
            'dados.tamanho' => ['nullable', 'numeric', 'min:6', 'max:400'],
            'dados.trancada' => ['nullable', 'boolean'],
            'dados.visao' => ['nullable', 'numeric', 'min:0', 'max:200'],
            'dados.visao_ativa' => ['nullable', 'boolean'],
            'dados.bloqueio' => ['nullable', 'array'],
            'dados.bloqueio.movimento' => ['nullable', 'boolean'],
            'dados.bloqueio.visao' => ['nullable', 'boolean'],
            'dados.bloqueio.luz' => ['nullable', 'boolean'],
            'dados.ativa' => ['nullable', 'boolean'],
            'dados.intensidade' => ['nullable', 'numeric', 'min:0', 'max:1'],
            'dados.raio_claro' => ['nullable', 'numeric', 'min:0', 'max:20000'],
            'dados.angulo' => ['nullable', 'numeric', 'min:1', 'max:360'],
            'dados.direcao' => ['nullable', 'numeric', 'min:-720', 'max:720'],
            'dados.atravessa' => ['nullable', 'boolean'],
        ]);
        $this->validarCamada($dados['camada'], $dados['tipo']);
        $this->validarPares($dados);

        if ($acesso->ehMestre()) {
            $somenteMestre = $dados['camada'] === 'mestre';
        } else {
            // Jogador: só traço e texto, na camada Jogadores, na própria página, em seu nome (jogador).
            abort_unless(in_array($dados['tipo'], self::TIPOS_DO_JOGADOR, true) && $dados['camada'] === 'jogadores', 403);
            abort_unless($pagina->id === $this->paginaDe($mesa, $acesso), 403);
            $dados['jogador_id'] = $acesso->jogador->id;
            $dados['personagem_id'] = null;
            $somenteMestre = false;
        }

        $arquivo = $request->file('arquivo');
        unset($dados['arquivo']);
        if ($arquivo) {
            abort_unless($acesso->ehMestre(), 403);
            $dados['arquivo'] = $arquivo->store('cenas', 'public');
            $dados['arquivo_tipo'] = $this->tipoDoArquivo($arquivo->getClientOriginalExtension());
        }

        $objeto = $pagina->objetos()->create($dados)->refresh();
        Transmitir::cena($mesa, $pagina->id, $acesso->jogador->id, $somenteMestre);

        return response()->json($objeto->paraFront(), 201);
    }

    public function update(Request $request, Mesa $mesa, Objeto $objeto): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $this->pertence($mesa, $objeto);

        if ($acesso->ehMestre()) {
            $dados = $request->validate([
                'camada' => ['sometimes', Rule::in(Objeto::CAMADAS)],
                'nome' => ['sometimes', 'nullable', 'string', 'max:80'],
                'x' => ['sometimes', 'numeric'],
                'y' => ['sometimes', 'numeric'],
                'largura' => ['sometimes', 'numeric', 'min:1', 'max:20000'],
                'altura' => ['sometimes', 'numeric', 'min:1', 'max:20000'],
                'z' => ['sometimes', 'integer'],
                'dados' => ['sometimes', 'nullable', 'array'],
                'dados.cor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
                'dados.aberta' => ['nullable', 'boolean'],
                'dados.raio' => ['nullable', 'numeric', 'min:1'],
                'dados.texto' => ['nullable', 'string', 'max:500'],
                'dados.tamanho' => ['nullable', 'numeric', 'min:6', 'max:400'],
                'dados.espessura' => ['nullable', 'numeric', 'min:1', 'max:80'],
                'dados.trancada' => ['nullable', 'boolean'],
                'dados.visao' => ['nullable', 'numeric', 'min:0', 'max:200'],
                'dados.visao_ativa' => ['nullable', 'boolean'],
                'dados.bloqueio' => ['nullable', 'array'],
                'dados.bloqueio.movimento' => ['nullable', 'boolean'],
                'dados.bloqueio.visao' => ['nullable', 'boolean'],
                'dados.bloqueio.luz' => ['nullable', 'boolean'],
                'dados.ativa' => ['nullable', 'boolean'],
                'dados.intensidade' => ['nullable', 'numeric', 'min:0', 'max:1'],
                'dados.raio_claro' => ['nullable', 'numeric', 'min:0', 'max:20000'],
                'dados.angulo' => ['nullable', 'numeric', 'min:1', 'max:360'],
                'dados.direcao' => ['nullable', 'numeric', 'min:-720', 'max:720'],
                'dados.atravessa' => ['nullable', 'boolean'],
            ]);
            if (isset($dados['camada'])) {
                $this->validarCamada($dados['camada'], $objeto->tipo);
            }
            // `dados` é mesclado: pontos/tipo de uma parede nunca se perdem ao mudar só a cor ou aberta.
            if (array_key_exists('dados', $dados) && is_array($dados['dados'])) {
                $dados['dados'] = array_merge($objeto->dados ?? [], $dados['dados']);
            }
        } else {
            // Jogador: só move token de personagem SEU ou desenho/texto SEU, na camada Jogadores e na página onde está.
            abort_unless(
                $objeto->camada === 'jogadores'
                && $this->ehMeu($objeto, $acesso)
                && $objeto->pagina_id === $this->paginaDe($mesa, $acesso),
                403,
            );
            // Em combate, só o token de quem está no turno se move (o mestre ignora).
            if ($objeto->tipo === 'token' && CombateService::emCurso($mesa)) {
                $atual = CombateService::itemAtual(CombateService::normalizar($mesa->combate));
                abort_unless($atual !== null && $atual['personagem_id'] !== null && $atual['personagem_id'] === $objeto->personagem_id, 403, 'Não é o turno deste personagem.');
            }
            $dados = $request->validate(['x' => ['required', 'numeric'], 'y' => ['required', 'numeric']]);
        }

        $de = ['x' => (float) $objeto->x, 'y' => (float) $objeto->y];
        // Paredes barram o movimento (o mestre atravessa): se o caminho reto até o ponto novo cruza uma parede (ou porta/janela fechada),
        // o token fica onde estava. O cliente já trava antes; aqui é a palavra final.
        if ($objeto->tipo === 'token' && isset($dados['x'], $dados['y']) && ! $acesso->ehMestre()) {
            $mx = (float) $objeto->largura / 2;
            $my = (float) $objeto->altura / 2;
            if (! Paredes::caminhoLivre($objeto->pagina, $de['x'] + $mx, $de['y'] + $my, (float) $dados['x'] + $mx, (float) $dados['y'] + $my)) {
                $dados['x'] = $de['x'];
                $dados['y'] = $de['y'];
            }
        }
        // Token em combate: o que andou entra no deslocamento do turno; quem não é o mestre trava no limite (como a régua).
        if ($objeto->tipo === 'token' && isset($dados['x'], $dados['y']) && CombateService::emCurso($mesa)) {
            $r = app(CombateService::class)->registrarMovimento($mesa, $objeto, (float) $dados['x'], (float) $dados['y'], ! $acesso->ehMestre());
            $dados['x'] = $r['x'];
            $dados['y'] = $r['y'];
        }

        $objeto->update($dados);
        Transmitir::cena($mesa, $objeto->pagina_id, $acesso->jogador->id, $this->soMestre($objeto));
        // Vigília (Overwatch): o atirador que anda a encerra
        if ($objeto->tipo === 'token' && isset($dados['x'], $dados['y']) && ($de['x'] !== (float) $dados['x'] || $de['y'] !== (float) $dados['y'])) {
            TecnicasAtivas::aoMover($mesa, $acesso, $objeto);
        }

        return response()->json($objeto->paraFront());
    }

    /**
     * Abrir ou fechar uma porta ou janela. Qualquer jogador da página pode, desde que não esteja trancada; só o mestre tranca e
     * destranca (pelo `update`) e só ele mexe numa trancada. O servidor é quem decide: o cliente nunca manda o novo estado.
     */
    public function alternar(Request $request, Mesa $mesa, Objeto $objeto): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $this->pertence($mesa, $objeto);
        abort_unless($objeto->tipo === 'parede' && in_array($objeto->dados['tipo'] ?? 'parede', ['porta', 'janela'], true), 422, 'Só portas e janelas abrem.');
        if (! $acesso->ehMestre()) {
            abort_unless($objeto->pagina_id === $this->paginaDe($mesa, $acesso), 403);
            abort_if((bool) ($objeto->dados['trancada'] ?? false), 422, 'Está trancada.');
            abort_unless($this->estaPerto($objeto, $acesso), 422, 'Chegue mais perto para abrir ou fechar.');
        }
        // Trava a linha: dois cliques simultâneos não se anulam (cada um vê o estado que o outro deixou).
        $objeto = DB::transaction(function () use ($objeto) {
            $o = Objeto::query()->whereKey($objeto->id)->lockForUpdate()->firstOrFail();
            $o->update(['dados' => array_merge($o->dados ?? [], ['aberta' => ! ($o->dados['aberta'] ?? false)])]);

            return $o;
        });
        Transmitir::cena($mesa, $objeto->pagina_id, $acesso->jogador->id, $this->soMestre($objeto));

        return response()->json($objeto->paraFront());
    }

    /** Algum token do jogador está encostado na porta (a até um quadrado da borda do token)? Só de perto se abre. */
    private function estaPerto(Objeto $porta, AcessoMesa $acesso): bool
    {
        $p = Paredes::pontos($porta);
        if (! $p) {
            return false;
        }
        $alcance = (float) $porta->pagina->tamanho_quadrado;

        return $porta->pagina->objetos()->where('tipo', 'token')->where('camada', 'jogadores')
            ->whereIn('personagem_id', $acesso->personagensPermitidos() ?: [0])->get()
            ->contains(fn (Objeto $t) => Paredes::distanciaAoSegmento($t->x + $t->largura / 2, $t->y + $t->altura / 2, ...$p) - max($t->largura, $t->altura) / 2 <= $alcance);
    }

    public function destroy(Request $request, Mesa $mesa, Objeto $objeto): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $this->pertence($mesa, $objeto);

        if (! $acesso->ehMestre()) {
            // Jogador só apaga o que ele mesmo desenhou/escreveu (não tokens, mapas, luzes).
            abort_unless(
                in_array($objeto->tipo, self::TIPOS_DO_JOGADOR, true)
                && $objeto->camada === 'jogadores'
                && $objeto->jogador_id === $acesso->jogador->id,
                403,
            );
        }
        $paginaId = $objeto->pagina_id;
        $somenteMestre = $this->soMestre($objeto);
        $personagemId = $objeto->tipo === 'token' ? $objeto->personagem_id : null;
        $objeto->delete();
        Transmitir::cena($mesa, $paginaId, $acesso->jogador->id, $somenteMestre);
        $this->apagarCopiaSemToken($mesa, $personagemId, $acesso->jogador->id);

        return response()->json(['ok' => true]);
    }

    /**
     * A cópia de um NPC (criada ao arrastá-lo para o mapa) só existe enquanto tem token: sumiu o último, a cópia é apagada
     * (com a vez dela no combate). O NPC modelo e os personagens comuns nunca são apagados por aqui.
     */
    private function apagarCopiaSemToken(Mesa $mesa, ?int $personagemId, int $atorId): void
    {
        if (! $personagemId || Objeto::query()->where('personagem_id', $personagemId)->exists()) {
            return;
        }
        $p = $mesa->personagens()->find($personagemId);
        if ($p && isset($p->ficha['npc']['instancia_de'])) {
            app(PersonagemController::class)->apagar($mesa, $p, $atorId);
        }
    }

    /** Token: o personagem é de um dos personagens do jogador. Desenho/texto: foi ele que fez. */
    private function ehMeu(Objeto $objeto, AcessoMesa $acesso): bool
    {
        return in_array($objeto->tipo, self::TIPOS_DO_JOGADOR, true)
            ? $objeto->jogador_id === $acesso->jogador->id
            : $objeto->tipo === 'token' && $acesso->podeControlar($objeto->personagem_id);
    }

    private function soMestre(Objeto $objeto): bool
    {
        return $objeto->camada === 'mestre';
    }

    private function pertence(Mesa $mesa, Objeto $objeto): void
    {
        abort_unless($objeto->pagina()->where('mesa_id', $mesa->id)->exists(), 404);
    }

    private function paginaDe(Mesa $mesa, AcessoMesa $acesso): ?int
    {
        return $acesso->jogador->pagina_id ?? $mesa->paginas()->value('id');
    }

    /** Paredes e luzes vivem na iluminação; traços e textos nunca (só nas outras camadas). */
    private function validarCamada(string $camada, string $tipo): void
    {
        $iluminacao = in_array($tipo, ['luz', 'parede'], true);
        abort_if($tipo === 'loot' && ! in_array($camada, ['mestre', 'jogadores'], true), 422, 'O loot fica na camada Mestre (oculto) ou Jogadores (aberto).');
        abort_if($iluminacao && $camada !== 'iluminacao', 422, 'Luzes e paredes pertencem à camada de iluminação.');
        abort_if(! $iluminacao && $camada === 'iluminacao', 422, 'Esta camada só aceita luzes e paredes.');
    }

    /** Pontos de traço/parede precisam vir em pares (x, y). */
    private function validarPares(array $dados): void
    {
        $pontos = $dados['dados']['pontos'] ?? null;
        if ($pontos !== null) {
            abort_unless(count($pontos) % 2 === 0, 422, 'Pontos inválidos.');
            if (($dados['tipo'] ?? '') === 'parede') {
                abort_unless(count($pontos) === 4, 422, 'Parede precisa de dois pontos.');
            }
        }
    }

    private function tipoDoArquivo(string $extensao): string
    {
        return match (strtolower($extensao)) {
            'gif' => 'gif',
            'webm', 'mp4' => 'video',
            default => 'imagem',
        };
    }
}
