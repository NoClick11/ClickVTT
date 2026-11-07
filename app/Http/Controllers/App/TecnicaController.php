<?php

namespace App\Http\Controllers\App;

use App\Http\Controllers\Controller;
use App\Models\Mensagem;
use App\Models\Mesa;
use App\Models\Personagem;
use App\Nucleo\Combate\AplicarCondicao;
use App\Nucleo\Combate\AplicarDano;
use App\Nucleo\Combate\CombateService;
use App\Nucleo\Combate\Duracoes;
use App\Nucleo\Combate\Equipes;
use App\Nucleo\Combate\Visibilidade;
use App\Nucleo\Combate\Pipeline;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Rolagem\RolagemInvalida;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Sistemas\OnePiece\ConsumoDaSaijo;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
use App\Support\Transmitir;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

/**
 * Técnica de Salvaguarda: quem usa a Técnica abre um card no chat com os alvos da área; cada alvo rola a Salvaguarda contra a CD de quem
 * usou (o dono do personagem, ou o mestre); com todos rolados o servidor rola o dano UMA vez e o desconta de cada um: todo o dano se
 * falhou, metade (ou nada) se passou. A CD, as rolagens e o dano saem do servidor; o cliente só diz quem é alvo e o que a Técnica rola.
 */
class TecnicaController extends Controller
{
    private const ATRIBUTOS = ['for', 'des', 'con', 'sab', 'pre', 'von'];

    /** Abre a Salvaguarda coletiva no chat. */
    public function abrir(Request $request, Mesa $mesa, RegistroSistemas $sistemas, Rolador $rolador): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $d = $request->validate([
            'personagem_id' => ['required', 'integer', Rule::in($acesso->personagensPermitidos())],
            'nome' => ['required', 'string', 'max:120'],
            'atributo' => ['required', Rule::in(self::ATRIBUTOS)],
            'desvantagem' => ['nullable', 'boolean'],
            'ao_passar' => ['nullable', Rule::in(['metade', 'nada'])],
            'alvos' => ['required', 'array', 'min:1', 'max:30'],
            'alvos.*' => ['integer', 'distinct', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            'dano' => ['nullable', 'array'],
            'dano.expressao' => ['required_with:dano', 'string', 'max:'.Rolador::MAX_EXPRESSAO],
            'dano.tipo' => ['nullable', 'string', 'max:30'],
            'efeito' => ['nullable', 'string', 'max:200'], // o que acontece com quem falha (Salvaguarda do efeito)
            // A condição que quem falha recebe sozinha, com a duração (id da condição do sistema)
            'aplica' => ['nullable', 'array'],
            'aplica.condicao' => ['required_with:aplica', 'string', 'max:40'],
            'aplica.turnos' => ['nullable', 'integer', 'between:1,99'],
            'aplica.aoDano' => ['nullable', 'boolean'],
            'secundaria' => ['nullable', 'array'],
            'secundaria.aplica' => ['nullable', 'array'],
            'secundaria.aplica.condicao' => ['required_with:secundaria.aplica', 'string', 'max:40'],
            'secundaria.aplica.turnos' => ['nullable', 'integer', 'between:1,99'],
            'secundaria.aplica.aoDano' => ['nullable', 'boolean'],
            'secundaria.atributo' => ['required_with:secundaria', Rule::in(self::ATRIBUTOS)],
            'secundaria.desvantagem' => ['nullable', 'boolean'],
            'secundaria.efeito' => ['required_with:secundaria', 'string', 'max:200'],
        ]);
        $sistema = $sistemas->resolver($mesa->sistema->slug) ?? throw ValidationException::withMessages(['sistema' => 'Este sistema não tem ficha.']);
        $atacante = $mesa->personagens()->findOrFail($d['personagem_id']);
        foreach ($d['alvos'] as $alvoId) {
            Equipes::exigirPodeAtingir($mesa, $atacante->id, (int) $alvoId, 'alvos');
            // camadas: quem está só na camada do Mestre não é visto pelos jogadores, então a área deles não o atinge
            if (! $acesso->ehMestre() && Visibilidade::oculto((int) $alvoId)) {
                throw ValidationException::withMessages(['alvos' => 'Esse alvo não está à vista.']);
            }
        }
        $ficha = $atacante->fichaCompleta($sistema);
        $variaveis = $sistema->variaveisDeRolagem($ficha, []);
        if (! isset($variaveis['cd'])) {
            throw ValidationException::withMessages(['sistema' => 'Este sistema não tem CD de Técnicas.']);
        }
        if (isset($d['dano'])) {
            try {
                $rolador->rolar($d['dano']['expressao'], $variaveis); // só valida a expressão
            } catch (RolagemInvalida $e) {
                throw ValidationException::withMessages(['dano.expressao' => $e->getMessage()]);
            }
            // `^2` (Saijo Ô): o uso é gasto agora, ao abrir
            if (str_contains($d['dano']['expressao'], '^')) {
                $itensIds = $sistema->itensReferenciados($ficha);
                $itens = $itensIds ? $mesa->itens()->whereIn('id', $itensIds)->get()->mapWithKeys(fn ($i) => [$i->id => $i->paraFront()])->all() : [];
                ConsumoDaSaijo::consumir($mesa, $atacante->id, $sistema, $itens, $ficha);
            }
        }

        $mensagem = $this->criar($mesa, $acesso, $atacante, [
            'nome' => trim($d['nome']), 'atributo' => $d['atributo'], 'desvantagem' => (bool) ($d['desvantagem'] ?? false),
            'cd' => (int) $variaveis['cd'], 'aoPassar' => $d['ao_passar'] ?? 'metade',
            'dano' => isset($d['dano']) ? ['expressao' => $d['dano']['expressao'], 'tipo' => filled($d['dano']['tipo'] ?? null) ? trim($d['dano']['tipo']) : null] : null,
            'efeito' => $d['efeito'] ?? null, 'aplica' => $d['aplica'] ?? null, 'secundaria' => $d['secundaria'] ?? null,
        ], $d['alvos']);

        return response()->json($mensagem->para($acesso->jogador), 201);
    }

    /** A Técnica de arma de fogo gasta a munição do Requisito (o servidor lê o custo da Técnica salva na ficha). */
    public function gastarMunicao(Request $request, Mesa $mesa, RegistroSistemas $sistemas): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        $d = $request->validate([
            'personagem_id' => ['required', 'integer', Rule::in($acesso->personagensPermitidos())],
            'tecnica' => ['required', 'string', 'max:120'],
        ]);
        $sistema = $sistemas->resolver($mesa->sistema->slug) ?? throw ValidationException::withMessages(['sistema' => 'Este sistema não tem ficha.']);
        $personagem = $mesa->personagens()->findOrFail($d['personagem_id']);

        return response()->json(['gasto' => \App\Sistemas\OnePiece\Municoes::gastarDaTecnica($mesa, $personagem, $sistema, $d['tecnica'])]);
    }

    /**
     * O efeito da munição de um ataque que acertou (o card oferece o botão): Kairoseki dá Enfraquecido a quem usa Akuma no Mi até o fim do
     * próximo turno dele; Bola Explosiva abre a Salvaguarda de Destreza CD 16 (3d6 de Fogo, metade se passar) de quem está na área de 1,5 m.
     * Uma vez por ataque; o ataque tem de ter acertado (ou não ter alvo resolvido). O cliente só diz o alvo e quem está na área.
     */
    public function efeitoDaMunicao(Request $request, Mesa $mesa, Mensagem $mensagem, RegistroSistemas $sistemas, AplicarCondicao $condicoes): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($mensagem->mesa_id === $mesa->id && $mensagem->tipo === 'rolagem' && $mensagem->personagem_id, 404);
        abort_unless($acesso->podeControlar((int) $mensagem->personagem_id), 403, 'Este ataque não é seu.');
        $d = $request->validate([
            'alvo_id' => ['nullable', 'integer', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
            'alvos' => ['nullable', 'array', 'max:30'],
            'alvos.*' => ['integer', 'distinct', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
        ]);
        $sistema = $sistemas->resolver($mesa->sistema->slug) ?? throw ValidationException::withMessages(['sistema' => 'Este sistema não tem ficha.']);
        $erro = fn (string $m) => throw ValidationException::withMessages(['efeito' => $m]);

        $resposta = DB::transaction(function () use ($mesa, $mensagem, $d, $sistema, $acesso, $condicoes, $erro) {
            $m = Mensagem::query()->whereKey($mensagem->id)->lockForUpdate()->firstOrFail();
            $dados = $m->dados;
            $municao = $dados['sistema']['municao'] ?? null;
            $efeito = $municao['efeito'] ?? null;
            if (! $efeito) {
                $erro('Esta munição não tem efeito especial.');
            }
            if ($municao['usado'] ?? false) {
                $erro('O efeito desta munição já foi usado.');
            }
            $res = $dados['sistema']['resolucao'] ?? null;
            if ($res && ($res['estado'] ?? null) === 'aguardando') {
                $erro('Espere o alvo reagir: o ataque ainda não foi resolvido.');
            }
            if ($res && ! ($res['acerto'] ?? false)) {
                $erro('O ataque errou: a munição não faz efeito.');
            }
            if (($dados['sistema']['destaque'] ?? null) === 'falha') {
                $erro('O ataque falhou: a munição não faz efeito.');
            }
            $alvoId = (int) ($res['alvo_id'] ?? $d['alvo_id'] ?? 0);
            if (! $alvoId) {
                $erro('Mire o alvo atingido.');
            }
            $atacante = Personagem::query()->where('mesa_id', $mesa->id)->findOrFail($m->personagem_id);
            Equipes::exigirPodeAtingir($mesa, $atacante->id, $alvoId, 'alvo_id');
            if (! $acesso->ehMestre() && Visibilidade::oculto($alvoId)) {
                $erro('Esse alvo não está à vista.');
            }
            $alvo = Personagem::query()->where('mesa_id', $mesa->id)->findOrFail($alvoId);
            $saida = ['efeito' => $efeito];

            if ($efeito === 'kairoseki') {
                $f = $alvo->fichaCompleta($sistema);
                if (($f['akuma']['tipo'] ?? '') === '') {
                    $erro("{$alvo->nome} não usa Akuma no Mi: a Kairoseki não faz efeito.");
                }
                $c = $condicoes->aplicar($alvo->id, $sistema, 'enfraquecido', 1);
                $saida['condicao'] = $c;
                $saida['texto'] = match ($c['situacao']) {
                    'aplicada' => "{$alvo->nome} foi atingido por Kairoseki: perde os poderes da Akuma no Mi e fica Enfraquecido até o fim do próximo turno.",
                    'imune' => "{$alvo->nome} é imune a {$c['nome']}.",
                    default => 'A condição Enfraquecido não existe neste sistema.',
                };
            } else {
                $alvos = array_values(array_unique([...($d['alvos'] ?? []), $alvoId]));
                foreach ($alvos as $id) {
                    Equipes::exigirPodeAtingir($mesa, $atacante->id, (int) $id, 'alvos');
                    if (! $acesso->ehMestre() && Visibilidade::oculto((int) $id)) {
                        $erro('Alguém na área não está à vista.');
                    }
                }
                $saida['explosao'] = $alvos;
            }
            $dados['sistema']['municao']['usado'] = true;
            $m->dados = $dados;
            $m->save();
            $saida['mensagem'] = $m;
            $saida['atacante'] = $atacante;

            return $saida;
        });

        $m = $resposta['mensagem'];
        EntregarMensagem::para($mesa, $m, $acesso, substitui: true);
        if (($resposta['efeito'] ?? '') === 'kairoseki') {
            if ($resposta['condicao']['situacao'] === 'aplicada') {
                Duracoes::transmitir($mesa, $resposta['condicao']['p'], $resposta['condicao']['campos'], true);
            }
            AplicarDano::postar($mesa, $acesso, 'todos', $resposta['texto']);
        } else {
            $this->criar($mesa, $acesso, $resposta['atacante'], [
                'nome' => 'Bola Explosiva', 'atributo' => 'des', 'desvantagem' => false, 'cd' => 16, 'aoPassar' => 'metade',
                'dano' => ['expressao' => '3d6', 'tipo' => 'Fogo'], 'efeito' => null, 'aplica' => null, 'secundaria' => null,
            ], $resposta['explosao']);
        }

        return response()->json($m->para($acesso->jogador));
    }

    /**
     * Um efeito de Técnica que a mesa comanda (botão do card do ataque): Execução, Zona do Atirador, Headshot, Covering, Mira Cruel e a redução
     * extra da Defesa Improvisada. O servidor confere o dono, o acerto (e o crítico onde pede), que o botão existe para a Técnica e uma vez só.
     */
    public function especial(Request $request, Mesa $mesa, Mensagem $mensagem, RegistroSistemas $sistemas, Rolador $rolador, AplicarDano $aplicar, AplicarCondicao $condicoes): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($mensagem->mesa_id === $mesa->id && $mensagem->tipo === 'rolagem' && $mensagem->personagem_id, 404);
        abort_unless($acesso->podeControlar((int) $mensagem->personagem_id), 403, 'Este ataque não é seu.');
        $d = $request->validate([
            'efeito' => ['required', 'string', 'max:30'],
            'alvo_id' => ['nullable', 'integer', Rule::exists('personagens', 'id')->where('mesa_id', $mesa->id)],
        ]);
        $sistema = $sistemas->resolver($mesa->sistema->slug) ?? throw ValidationException::withMessages(['sistema' => 'Este sistema não tem ficha.']);
        $erro = fn (string $m) => throw ValidationException::withMessages(['efeito' => $m]);
        $textos = [];
        $aplicados = [];
        $condicionados = [];
        $combateNovo = null;

        $m = DB::transaction(function () use ($mesa, $mensagem, $d, $sistema, $acesso, $rolador, $aplicar, $condicoes, $erro, &$textos, &$aplicados, &$condicionados, &$combateNovo) {
            $m = Mensagem::query()->whereKey($mensagem->id)->lockForUpdate()->firstOrFail();
            $dados = $m->dados;
            $sis = $dados['sistema'] ?? [];
            $nome = $sis['tecnica']['nome'] ?? null;
            $botoes = collect($sis['tecnica']['especiais'] ?? []);
            if (! $nome || ! $botoes->contains('id', $d['efeito'])) {
                $erro('Este efeito não existe para esta Técnica.');
            }
            $atacante = Personagem::query()->where('mesa_id', $mesa->id)->findOrFail($m->personagem_id);
            if (! \App\Sistemas\OnePiece\TecnicasEspeciais::naFicha($atacante->fichaCompleta($sistema), $nome)) {
                $erro("{$atacante->nome} não tem a Técnica {$nome}.");
            }
            $usados = $sis['tecnica']['usados'] ?? [];
            // a redução da Defesa Improvisada pode somar várias vezes; os demais efeitos valem uma vez por ataque
            if ($d['efeito'] !== 'reducao_extra' && in_array($d['efeito'], $usados, true)) {
                $erro('Este efeito já foi usado neste ataque.');
            }
            $res = $sis['resolucao'] ?? null;
            if ($d['efeito'] !== 'reducao_extra') {
                if ($res && ($res['estado'] ?? null) === 'aguardando') {
                    $erro('Espere o alvo reagir: o ataque ainda não foi resolvido.');
                }
                if ($res && ! ($res['acerto'] ?? false)) {
                    $erro('O ataque errou.');
                }
                if (($sis['destaque'] ?? null) === 'falha') {
                    $erro('O ataque falhou.');
                }
            }
            $catalogo = collect(\App\Sistemas\OnePiece\TecnicasEspeciais::CATALOGO[$nome] ?? [])->firstWhere('id', $d['efeito']);
            if (! empty($catalogo['soMestre']) && ! $acesso->ehMestre()) {
                $erro('Só o Narrador decide isto.');
            }
            $alvoId = (int) ($res['alvo_id'] ?? $d['alvo_id'] ?? 0);
            $alvo = $alvoId ? Personagem::query()->where('mesa_id', $mesa->id)->find($alvoId) : null;
            $contraAlvo = ! in_array($d['efeito'], ['zona', 'reducao_extra'], true);
            if ($contraAlvo) {
                if (! $alvo) {
                    $erro('Mire o alvo atingido.');
                }
                Equipes::exigirPodeAtingir($mesa, $atacante->id, $alvo->id, 'alvo_id');
                if (! $acesso->ehMestre() && Visibilidade::oculto($alvo->id)) {
                    $erro('Esse alvo não está à vista.');
                }
            }
            $verdadeiro = fn (Personagem $p) => $aplicar->aplicar($mesa, $p->id, $sistema, 99999, 'Verdadeiro', [], $atacante->id);

            switch ($d['efeito']) {
                case 'executar':
                    $pv = (int) ($alvo->fichaCompleta($sistema)['pv']['atual'] ?? 0);
                    if ($pv > 150) {
                        $erro("{$alvo->nome} tem {$pv} PV: a Execução só mata quem tem 150 PV ou menos.");
                    }
                    $aplicados[] = $verdadeiro($alvo);
                    $textos[] = "{$alvo->nome} tinha {$pv} PV e morre instantaneamente (Execução).";
                    break;
                case 'cabeca':
                    $aplicados[] = $verdadeiro($alvo);
                    $textos[] = "{$atacante->nome} atravessa a cabeça de {$alvo->nome}: o Narrador decidiu que ela morre (Headshot).";
                    break;
                case 'extra':
                    $r = $rolador->rolar('6d10', []);
                    $res2 = $aplicar->aplicar($mesa, $alvo->id, $sistema, $r['total'], 'Perfurante', [], $atacante->id);
                    $aplicados[] = $res2;
                    $textos[] = "Headshot: {$r['total']} de dano Perfurante extra em {$alvo->nome} ({$res2['calculo']['final']} depois das defesas).";
                    break;
                case 'zona':
                    $f = $atacante->ficha ?? [];
                    $f['pv']['temp'] = max((int) ($f['pv']['temp'] ?? 0), 60);
                    $atacante->ficha = $f;
                    $atacante->save();
                    $canais = ['mestre', ...$atacante->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all()];
                    Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $atacante->id, 'campos' => ['pv.temp' => $f['pv']['temp']], 'criacao' => $atacante->criacao, 'ator' => 0], $canais);
                    $textos[] = "{$atacante->nome} recebe 60 PV temporários e tem vantagem nas jogadas de ataque (comum) por até 1 minuto (Zona do Atirador).";
                    break;
                case 'desvantagem':
                    $c = $condicoes->aplicar($alvo->id, $sistema, 'covering', 1);
                    $c['texto'] = match ($c['situacao']) {
                        'aplicada' => "{$alvo->nome} fica sob Fogo Cadenciado: a próxima jogada de ataque dele tem desvantagem, até o fim do próximo turno dele (Covering).",
                        'imune' => "{$alvo->nome} é imune a {$c['nome']}.",
                        default => 'A condição Fogo Cadenciado não existe neste sistema.',
                    };
                    $condicionados[] = $c;
                    break;
                case 'metade_movimento':
                    $mesaTrava = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
                    $cb = CombateService::normalizar($mesaTrava->combate);
                    $k = collect($cb['itens'])->search(fn ($i) => $i['personagem_id'] === $alvo->id);
                    if ($cb['fase'] !== 'em_curso' || $k === false) {
                        $erro("{$alvo->nome} não está no combate em curso: reduza o movimento dele à mão.");
                    }
                    $mov = $cb['itens'][$k]['movimento'];
                    $cb['itens'][$k]['movimento'] = [...$mov, 'base' => $mov['base'] !== null ? round($mov['base'] / 2, 3) : null, 'bonus' => round($mov['bonus'] / 2, 3)];
                    $mesaTrava->forceFill(['combate' => $cb])->save();
                    $combateNovo = $cb;
                    $textos[] = "{$alvo->nome} tem o deslocamento pela metade neste turno (Mira Cruel).";
                    break;
                case 'reducao_extra':
                    $red = $sis['reducao'] ?? null;
                    if (! $red || ($red['dados'] ?? 0) + 2 > 20) {
                        $erro('A redução já chegou ao limite de 20d8.');
                    }
                    $f = $atacante->ficha ?? [];
                    if ((int) ($f['pp']['atual'] ?? 0) < 1) {
                        $erro('Sem PP: cada 2d8 extras custam 1 PP.');
                    }
                    $f['pp']['atual'] = (int) $f['pp']['atual'] - 1;
                    $atacante->ficha = $f;
                    $atacante->save();
                    $canais = ['mestre', ...$atacante->jogadores()->pluck('jogadores.id')->map(fn ($id) => "jogador.{$id}")->all()];
                    Transmitir::enviar($mesa, 'ficha', ['personagem_id' => $atacante->id, 'campos' => ['pp.atual' => $f['pp']['atual']], 'criacao' => $atacante->criacao, 'ator' => 0], $canais);
                    $r = $rolador->rolar('2d8', []);
                    $sis['reducao'] = ['dados' => $red['dados'] + 2, 'total' => $red['total'] + $r['total']];
                    if ($sis['reducao']['dados'] >= 20) {
                        $sis['tecnica']['especiais'] = [];
                    }
                    $textos[] = "Defesa Improvisada: +2d8 ({$r['total']}) por 1 PP; redução total {$sis['reducao']['total']} ({$sis['reducao']['dados']}d8).";
                    break;
            }
            if ($d['efeito'] !== 'reducao_extra') {
                $sis['tecnica']['usados'] = [...$usados, $d['efeito']];
                $sis['tecnica']['especiais'] = array_values(array_filter($sis['tecnica']['especiais'] ?? [], fn ($b) => $b['id'] !== $d['efeito']));
            }
            $dados['sistema'] = $sis;
            $m->dados = $dados;
            $m->save();

            return $m;
        });

        foreach ($aplicados as $r) {
            $aplicar->avisar($mesa, $acesso, 'todos', $r, postar: false);
        }
        foreach ($condicionados as $c) {
            if ($c['situacao'] === 'aplicada') {
                Duracoes::transmitir($mesa, $c['p'], $c['campos'], true);
            }
            $textos[] = $c['texto'];
        }
        if ($combateNovo) {
            Transmitir::enviar($mesa, 'combate', ['combate' => $combateNovo, 'ator' => $acesso->jogador->id], ['mesa']);
        }
        foreach ($textos as $t) {
            AplicarDano::postar($mesa, $acesso, 'todos', $t);
        }
        EntregarMensagem::para($mesa, $m, $acesso, substitui: true);

        return response()->json($m->para($acesso->jogador));
    }

    /** Um alvo rola a Salvaguarda (o dono do personagem, ou o mestre). Com o último, o dano é rolado e aplicado. */
    public function rolar(Request $request, Mesa $mesa, Mensagem $mensagem, RegistroSistemas $sistemas, Rolador $rolador, AplicarDano $aplicar, AplicarCondicao $condicoes): JsonResponse
    {
        $acesso = AcessoMesa::exigir($request, $mesa);
        abort_unless($mensagem->mesa_id === $mesa->id && $mensagem->tipo === 'tecnica', 404);
        $d = $request->validate(['personagem_id' => ['required', 'integer']]);
        abort_unless($acesso->podeControlar($d['personagem_id']), 403, 'Este personagem não é seu.');
        $sistema = $sistemas->resolver($mesa->sistema->slug) ?? throw ValidationException::withMessages(['sistema' => 'Este sistema não tem ficha.']);

        $aplicados = [];
        $condicionados = [];
        $mensagem = DB::transaction(function () use ($mesa, $mensagem, $d, $sistema, $rolador, $aplicar, $condicoes, &$aplicados, &$condicionados) {
            $m = Mensagem::query()->whereKey($mensagem->id)->lockForUpdate()->firstOrFail();
            $dados = $m->dados;
            if (($dados['estado'] ?? null) !== 'aguardando') {
                throw ValidationException::withMessages(['personagem_id' => 'Esta Técnica já foi resolvida.']);
            }
            $i = collect($dados['alvos'])->search(fn ($a) => $a['personagem_id'] === $d['personagem_id']);
            if ($i === false || $dados['alvos'][$i]['estado'] !== 'pendente') {
                throw ValidationException::withMessages(['personagem_id' => 'Este personagem não tem Salvaguarda a rolar.']);
            }
            $t = $dados['tecnica'];
            $alvo = Personagem::query()->where('mesa_id', $mesa->id)->findOrFail($d['personagem_id']);
            $vars = $sistema->variaveisDeRolagem($alvo->fichaCompleta($sistema), []);
            $r = $rolador->rolar(($t['desvantagem'] ? '2d20kl1' : '1d20')."+@salv.{$t['atributo']}", $vars);
            $dados['alvos'][$i] = [...$dados['alvos'][$i], 'estado' => 'rolou', 'total' => $r['total'], 'termos' => $r['termos'], 'passou' => $r['total'] >= $t['cd']];

            if (collect($dados['alvos'])->every(fn ($a) => $a['estado'] === 'rolou')) {
                $dados = $this->resolver($mesa, $m, $dados, $sistema, $rolador, $aplicar, $condicoes, $aplicados, $condicionados);
            }
            $m->dados = $dados;
            $m->save();

            return $m;
        });

        foreach ($aplicados as $r) {
            $aplicar->avisar($mesa, $acesso, 'todos', $r, postar: false);
        }
        foreach ($condicionados as $c) {
            if ($c['situacao'] === 'aplicada') {
                Duracoes::transmitir($mesa, $c['p'], $c['campos'], true);
            }
            AplicarDano::postar($mesa, $acesso, 'todos', $c['texto']);
        }
        EntregarMensagem::para($mesa, $mensagem, $acesso, substitui: true);
        $this->abrirSecundaria($mesa, $acesso, $mensagem);

        return response()->json($mensagem->para($acesso->jogador));
    }

    /**
     * Resolve: rola o dano uma vez (com as variáveis de quem usou) e o aplica a cada alvo: todo se falhou, metade ou nada se passou.
     *
     * @param  array<string, mixed>  $dados
     * @param  list<array>  $aplicados  recebe os resultados do AplicarDano (para avisar depois da transação)
     * @return array<string, mixed>
     */
    private function resolver(Mesa $mesa, Mensagem $m, array $dados, mixed $sistema, Rolador $rolador, AplicarDano $aplicar, AplicarCondicao $condicoes, array &$aplicados, array &$condicionados): array
    {
        $t = $dados['tecnica'];
        $atacante = Personagem::query()->where('mesa_id', $mesa->id)->find($t['atacante_id']);
        if ($t['dano']) {
            $vars = $atacante ? $sistema->variaveisDeRolagem($atacante->fichaCompleta($sistema), []) : [];
            $r = $rolador->rolar($t['dano']['expressao'], $vars);
            $dados['dano'] = ['total' => $r['total'], 'termos' => $r['termos'], 'expressao' => $r['expressao'], 'tipo' => $t['dano']['tipo'], ...(isset($r['repeticoes']) ? ['repeticoes' => $r['repeticoes'], 'escolhida' => $r['escolhida']] : [])];
            foreach ($dados['alvos'] as $i => $a) {
                $base = $a['passou'] ? ($t['aoPassar'] === 'metade' ? intdiv($r['total'], 2) : 0) : $r['total'];
                $dados['alvos'][$i]['base'] = $base;
                $dados['alvos'][$i]['final'] = 0;
                if ($base > 0) {
                    $res = $aplicar->aplicar($mesa, $a['personagem_id'], $sistema, $base, $t['dano']['tipo'], [], $t['atacante_id']);
                    $dados['alvos'][$i]['final'] = $res['calculo']['final'];
                    $dados['alvos'][$i]['modo'] = $res['calculo']['modo'];
                    $aplicados[] = $res;
                }
            }
        }
        // A condição da Técnica vai sozinha para quem falhou, com a duração (imunidade respeitada)
        if ($t['aplica'] ?? null) {
            foreach ($dados['alvos'] as $i => $a) {
                if ($a['passou']) {
                    continue;
                }
                $c = $condicoes->aplicar($a['personagem_id'], $sistema, $t['aplica']['condicao'], $t['aplica']['turnos'] ?? null, (bool) ($t['aplica']['aoDano'] ?? false));
                $dados['alvos'][$i]['condicao'] = ['nome' => $c['nome'], 'situacao' => $c['situacao']];
                $duracao = isset($t['aplica']['turnos']) ? " por {$t['aplica']['turnos']} turno".($t['aplica']['turnos'] > 1 ? 's' : '') : '';
                $c['texto'] = match ($c['situacao']) {
                    'aplicada' => "{$a['nome']} recebeu a condição {$c['nome']}{$duracao} ({$t['nome']}).",
                    'imune' => "{$a['nome']} é imune a {$c['nome']}.",
                    default => "{$t['nome']}: condição {$t['aplica']['condicao']} não existe neste sistema.",
                };
                $condicionados[] = $c;
            }
        }
        $dados['estado'] = 'resolvido';

        return $dados;
    }

    /** Depois do dano: quem falhou numa Técnica com Salvaguarda do efeito (Sangramento...) rola a segunda Salvaguarda. */
    private function abrirSecundaria(Mesa $mesa, AcessoMesa $acesso, Mensagem $m): void
    {
        $dados = $m->dados;
        $s = $dados['tecnica']['secundaria'] ?? null;
        if (($dados['estado'] ?? null) !== 'resolvido' || ! $s || ($dados['secundariaAberta'] ?? false)) {
            return;
        }
        $falharam = collect($dados['alvos'])->where('passou', false)->pluck('personagem_id')->all();
        $dados['secundariaAberta'] = true;
        $m->dados = $dados;
        $m->save();
        if (! $falharam) {
            return;
        }
        $atacante = Personagem::query()->where('mesa_id', $mesa->id)->find($dados['tecnica']['atacante_id']);
        $t = $dados['tecnica'];
        $this->criar($mesa, $acesso, $atacante, [
            'nome' => "{$t['nome']}: efeito", 'atributo' => $s['atributo'], 'desvantagem' => (bool) ($s['desvantagem'] ?? false), 'cd' => $t['cd'],
            'aoPassar' => 'nada', 'dano' => null, 'efeito' => $s['efeito'], 'aplica' => $s['aplica'] ?? null, 'secundaria' => null,
        ], $falharam);
    }

    /**
     * Cria o card da Salvaguarda coletiva e o entrega à mesa.
     *
     * @param  array<string, mixed>  $t
     * @param  list<int>  $alvos
     */
    private function criar(Mesa $mesa, AcessoMesa $acesso, ?Personagem $atacante, array $t, array $alvos): Mensagem
    {
        $nomes = Personagem::query()->where('mesa_id', $mesa->id)->whereIn('id', $alvos)->pluck('nome', 'id');
        $mensagem = $mesa->mensagens()->create([
            'jogador_id' => $acesso->jogador->id, 'personagem_id' => $atacante?->id, 'tipo' => 'tecnica', 'visibilidade' => 'todos', // os alvos precisam ver o card para rolar a Salvaguarda
            'texto' => "{$t['nome']}: Salvaguarda de ".strtoupper($t['atributo'])." CD {$t['cd']}",
            'dados' => [
                'rotulo' => $t['nome'], 'estado' => 'aguardando',
                'tecnica' => [...$t, 'atacante_id' => $atacante?->id],
                'alvos' => array_map(fn ($id) => ['personagem_id' => (int) $id, 'nome' => $nomes[$id] ?? '?', 'estado' => 'pendente'], $alvos),
            ],
        ]);
        EntregarMensagem::para($mesa, $mensagem, $acesso);

        return $mensagem;
    }
}
