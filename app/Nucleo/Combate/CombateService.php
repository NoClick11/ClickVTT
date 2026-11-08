<?php

namespace App\Nucleo\Combate;

use App\Models\Mesa;
use App\Models\Objeto;
use App\Models\Personagem;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
use App\Support\Transmitir;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * O encontro (combate) de uma mesa, decidido no servidor. O estado fica em `mesas.combate` e só muda por aqui, em
 * transação com a mesa travada: iniciar, rolar iniciativa, passar/voltar o turno, reordenar etc. O núcleo não conhece
 * regras de sistema; pergunta ao módulo (`SistemaDeCombate`) como rolar a iniciativa.
 *
 * Fases: `inativo` (sem combate) → `iniciativa` (cada um rola a sua) → `em_curso` (turnos). Os itens ficam NA ORDEM DOS
 * TURNOS (o mestre pode reordenar à mão).
 *
 * Item: `{id, nome, cor, personagem_id, objeto_id, disposicao, iniciativa, acoes: {categoria: usos}, movimento: {usado, bonus}}`.
 * `disposicao`: `jogadores` | `aliado` | `inimigo` (define quem é aliado de quem nas reações).
 */
final class CombateService
{
    public const DISPOSICOES = ['jogadores', 'aliado', 'inimigo'];

    public function __construct(private readonly RegistroSistemas $sistemas, private readonly Rolador $rolador) {}

    /** O estado completo, com os padrões preenchidos (combates salvos no formato antigo continuam válidos). */
    public static function normalizar(?array $c): array
    {
        $c ??= [];
        $itens = array_map(fn (array $i) => [
            'id' => (string) $i['id'], 'nome' => (string) ($i['nome'] ?? '?'), 'cor' => $i['cor'] ?? null,
            'personagem_id' => $i['personagem_id'] ?? null, 'objeto_id' => $i['objeto_id'] ?? null,
            'disposicao' => $i['disposicao'] ?? (($i['personagem_id'] ?? null) ? 'jogadores' : 'inimigo'),
            'iniciativa' => $i['iniciativa'] ?? null,
            'acoes' => $i['acoes'] ?? [],
            // `base`: o deslocamento do turno em metros (do sistema, no começo do turno); null = sem limite medido.
            'movimento' => ['usado' => (float) ($i['movimento']['usado'] ?? 0), 'bonus' => (float) ($i['movimento']['bonus'] ?? 0), 'base' => isset($i['movimento']['base']) ? (float) $i['movimento']['base'] : null],
        ], array_values($c['itens'] ?? []));
        $ativo = (bool) ($c['ativo'] ?? false);

        return [
            'ativo' => $ativo,
            'fase' => $ativo ? ($c['fase'] ?? 'em_curso') : 'inativo',
            'rodada' => (int) ($c['rodada'] ?? 1),
            'atual' => $c['atual'] ?? null,
            'itens' => $itens,
            // Técnicas com duração em andamento (Quick Draw...): ver `TecnicasAtivas`
            'ativas' => array_values($c['ativas'] ?? []),
        ];
    }

    public static function emCurso(Mesa $mesa): bool
    {
        return (self::normalizar($mesa->combate)['fase']) === 'em_curso';
    }

    /** O item do turno atual (ou null). */
    public static function itemAtual(array $combate): ?array
    {
        foreach ($combate['itens'] as $i) {
            if ($i['id'] === $combate['atual']) {
                return $i;
            }
        }

        return null;
    }

    /**
     * Executa um comando sobre o encontro, com a mesa travada, e transmite o novo estado a todos.
     * Comandos do mestre: iniciar, rolar_npcs, definir_iniciativa, definir_disposicao, comecar, turno, rodada, ordem,
     * adicionar, remover, encerrar. Do jogador: iniciativa (só dos personagens dele).
     *
     * @param  array<string, mixed>  $d
     * @return array<string, mixed> o estado novo
     */
    public function executar(Mesa $mesa, AcessoMesa $acesso, string $comando, array $d): array
    {
        $mestreApenas = $comando !== 'iniciativa';
        abort_if($mestreApenas && ! $acesso->ehMestre(), 403, 'Só o mestre controla o combate.');

        $antes = null;
        $depois = DB::transaction(function () use ($mesa, $acesso, $comando, $d, &$antes) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $antes = self::normalizar($m->combate);
            $c = $this->aplicar($m, $acesso, $comando, $d, $antes);
            // Técnicas com duração: uma rodada a menos a cada rodada nova; saem as que acabaram e as de quem saiu do encontro
            $c['ativas'] = TecnicasAtivas::aposMudanca($antes, $c);
            $m->forceFill(['combate' => $c])->save();

            return $c;
        });

        // Passou o turno: um turno a menos nas condições com duração de quem terminou
        Duracoes::aoMudarOCombate($mesa, $antes, $depois);
        // ...e as Técnicas ativas pedem o ataque contra quem começa o turno ao alcance
        TecnicasAtivas::aoMudarOTurno($mesa, $acesso, $antes, $depois);
        Transmitir::enviar($mesa, 'combate', ['combate' => $depois, 'ator' => $acesso->jogador->id], ['mesa']);

        return $depois;
    }

    /**
     * Gasta uma ação de `$categoria` de um personagem (se ele está no combate em curso). Atômico, com a mesa travada.
     * Recusa (422) com o motivo se a categoria do sistema tem trava (`soNoTurno`, `soTecnicas`, `porTurno`, `porRodada`); o One Piece
     * não declara nenhuma (age-se livremente), só o movimento fora do turno é travado (ObjetoController). O mestre nunca é recusado (o gasto só é anotado). Fora do combate em curso, ou com o
     * personagem fora do encontro, ou sistema sem categorias: não bloqueia nada.
     *
     * @return array<string, mixed> o estado (já transmitido se mudou)
     */
    public function gastar(Mesa $mesa, AcessoMesa $acesso, int $personagemId, string $categoria, bool $tecnica = false, ?int $ataquesPorAcao = null): array
    {
        abort_unless($acesso->podeControlar($personagemId), 403, 'Este personagem não é seu.');
        $sistema = $this->sistemas->resolver($mesa->sistema->slug);
        $cats = $sistema instanceof SistemaDeCombate ? collect($sistema->categoriasDeAcao())->keyBy('id') : collect();
        $mudou = false;
        $depois = DB::transaction(function () use ($mesa, $acesso, $personagemId, $categoria, $tecnica, $ataquesPorAcao, $cats, &$mudou) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $c = self::normalizar($m->combate);
            $k = collect($c['itens'])->search(fn ($i) => $i['personagem_id'] === $personagemId);
            if ($c['fase'] !== 'em_curso' || $k === false || ! $cats->has($categoria)) {
                return $c;
            }
            $cfg = $cats[$categoria];
            $item = $c['itens'][$k];
            $usos = (int) ($item['acoes'][$categoria] ?? 0);
            // Ataque com arma (Ação "Atacar"): o 1º gasta a Ação; os seguintes valem até o limite de ataques por Ação (Ataque Extra) mais os
            // extras do turno, sem gastar outra Ação. O contador `ataques` zera sozinho a cada turno (junto das demais ações).
            if ($ataquesPorAcao !== null && $categoria === 'padrao') {
                $feitos = (int) ($item['acoes']['ataques'] ?? 0);
                if ($feitos > 0) {
                    $max = $ataquesPorAcao + (int) ($item['acoes']['extras'] ?? 0);
                    if (! $acesso->ehMestre() && ($cfg['porTurno'] ?? null) !== null) {
                        if (($cfg['soNoTurno'] ?? false) && $c['atual'] !== $item['id']) {
                            throw ValidationException::withMessages(['acao' => 'Não é o seu turno: fora dele só dá para usar reações.']);
                        }
                        if ($feitos >= $max) {
                            throw ValidationException::withMessages(['acao' => "Você já fez seus {$max} ataque".($max > 1 ? 's' : '').' neste turno.']);
                        }
                    }
                    $c['itens'][$k]['acoes']['ataques'] = $feitos + 1;
                    $m->forceFill(['combate' => $c])->save();
                    $mudou = true;

                    return $c;
                }
            }
            if (! $acesso->ehMestre()) {
                $motivo = null;
                if (($cfg['soNoTurno'] ?? false) && $c['atual'] !== $item['id']) {
                    $motivo = 'Não é o seu turno: fora dele só dá para usar reações.';
                } elseif (($cfg['soTecnicas'] ?? false) && ! $tecnica) {
                    $motivo = "{$cfg['nome']} só serve para técnicas.";
                } elseif (($cfg['porTurno'] ?? null) !== null && $usos >= $cfg['porTurno']) {
                    $motivo = "Você já usou sua {$cfg['nome']} neste turno.";
                } elseif (($cfg['porRodada'] ?? null) !== null && $usos >= $cfg['porRodada']) {
                    $motivo = "Você já usou sua {$cfg['nome']} nesta rodada.";
                }
                if ($motivo) {
                    throw ValidationException::withMessages(['acao' => $motivo]);
                }
            }
            $c['itens'][$k]['acoes'][$categoria] = $usos + 1;
            if ($ataquesPorAcao !== null && $categoria === 'padrao') {
                $c['itens'][$k]['acoes']['ataques'] = 1;
            }
            $m->forceFill(['combate' => $c])->save();
            $mudou = true;

            return $c;
        });
        if ($mudou) {
            Transmitir::enviar($mesa, 'combate', ['combate' => $depois, 'ator' => $acesso->jogador->id], ['mesa']);
        }
        return $depois;
    }

    /**
     * Ataques extras do turno (Tempestade de Balas, Alvo Travado, Ataques Múltiplos...): somam ao limite de ataques da Ação. Só no turno do
     * personagem (o mestre sempre). `n` pode ser negativo para desfazer; o total nunca fica abaixo de 0.
     */
    public function darAtaquesExtras(Mesa $mesa, AcessoMesa $acesso, int $personagemId, int $n): array
    {
        abort_unless($acesso->podeControlar($personagemId), 403, 'Este personagem não é seu.');
        $depois = DB::transaction(function () use ($mesa, $acesso, $personagemId, $n) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $c = self::normalizar($m->combate);
            $k = collect($c['itens'])->search(fn ($i) => $i['personagem_id'] === $personagemId);
            if ($c['fase'] !== 'em_curso' || $k === false) {
                throw ValidationException::withMessages(['acao' => 'Só dá para ganhar ataques extras com o combate em curso.']);
            }
            $extras = max(0, (int) ($c['itens'][$k]['acoes']['extras'] ?? 0) + $n);
            if ($extras > 0) {
                $c['itens'][$k]['acoes']['extras'] = $extras;
            } else {
                unset($c['itens'][$k]['acoes']['extras']);
            }
            $m->forceFill(['combate' => $c])->save();

            return $c;
        });
        Transmitir::enviar($mesa, 'combate', ['combate' => $depois, 'ator' => $acesso->jogador->id], ['mesa']);

        return $depois;
    }

    /**
     * Registra o deslocamento de um token em combate. Se o token é o do turno atual, o que ele andou entra em
     * `movimento.usado`; quem não é o mestre não passa do deslocamento do turno (o ponto final é limitado, como a régua
     * que trava na tela). Token de outro participante, fora do combate em curso ou sem deslocamento medido: não muda nada.
     *
     * @return array{x: float, y: float, travou: bool}
     */
    public function registrarMovimento(Mesa $mesa, Objeto $token, float $x1, float $y1, bool $limitar): array
    {
        $final = ['x' => $x1, 'y' => $y1, 'travou' => false];
        $mudou = false;
        $depois = DB::transaction(function () use ($mesa, $token, $x1, $y1, $limitar, &$final, &$mudou) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $c = self::normalizar($m->combate);
            $k = collect($c['itens'])->search(fn ($i) => $i['id'] === $c['atual']);
            if ($c['fase'] !== 'em_curso' || $k === false || $token->personagem_id === null || $c['itens'][$k]['personagem_id'] !== $token->personagem_id) {
                return $c;
            }
            $item = $c['itens'][$k];
            $base = $this->baseDoTurno($m, $item) ?? $item['movimento']['base'];
            if ($base === null) {
                return $c;
            }
            $pagina = $token->pagina;
            $restante = $base + $item['movimento']['bonus'] - $item['movimento']['usado'];
            $r = $limitar ? Movimento::limitar((float) $token->x, (float) $token->y, $x1, $y1, $restante, $pagina) : [
                'x' => $x1, 'y' => $y1, 'metros' => Movimento::metros($x1 - (float) $token->x, $y1 - (float) $token->y, $pagina), 'travou' => false,
            ];
            $final = ['x' => $r['x'], 'y' => $r['y'], 'travou' => $r['travou']];
            $c['itens'][$k]['movimento'] = [...$item['movimento'], 'usado' => round($item['movimento']['usado'] + $r['metros'], 3), 'base' => $base];
            $m->forceFill(['combate' => $c])->save();
            $mudou = true;

            return $c;
        });
        if ($mudou) {
            Transmitir::enviar($mesa, 'combate', ['combate' => $depois, 'ator' => 0], ['mesa']);
        }

        return $final;
    }

    /**
     * Soma ao turno `fator` vezes o deslocamento do personagem (a Disparada soma 1; Recuo Estratégico, 2). A ação que o botão
     * gasta já foi gasta antes (`gastar`); aqui só entra o deslocamento. Só no combate em curso e no turno dele (o mestre sempre).
     */
    public function somarDeslocamento(Mesa $mesa, AcessoMesa $acesso, int $personagemId, int $fator): array
    {
        abort_unless($acesso->podeControlar($personagemId), 403, 'Este personagem não é seu.');
        abort_unless(self::emCurso($mesa), 422, 'O deslocamento extra só vale em combate.');
        $depois = DB::transaction(function () use ($mesa, $acesso, $personagemId, $fator) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $c = self::normalizar($m->combate);
            $k = collect($c['itens'])->search(fn ($i) => $i['personagem_id'] === $personagemId);
            abort_if($k === false, 422, 'O personagem não está no combate.');
            abort_if(! $acesso->ehMestre() && $c['atual'] !== $c['itens'][$k]['id'], 422, 'Não é o seu turno.');
            $base = $this->baseDoTurno($m, $c['itens'][$k]) ?? $c['itens'][$k]['movimento']['base'] ?? 0.0;
            $c['itens'][$k]['movimento']['bonus'] += $base * max(1, $fator);
            $c['itens'][$k]['movimento']['base'] = $base;
            $m->forceFill(['combate' => $c])->save();

            return $c;
        });
        Transmitir::enviar($mesa, 'combate', ['combate' => $depois, 'ator' => $acesso->jogador->id], ['mesa']);

        return $depois;
    }

    /**
     * Disparada: anota a ação que o sistema define para ela e soma ao turno
     * outro deslocamento inteiro. Só vale no combate em curso, para o personagem do turno.
     */
    public function disparar(Mesa $mesa, AcessoMesa $acesso, int $personagemId): array
    {
        $sistema = $this->sistemas->resolver($mesa->sistema->slug);
        $categoria = $sistema instanceof SistemaDeCombate ? $sistema->categoriaDaDisparada() : null;
        abort_if($categoria === null, 422, 'Este sistema não tem Disparada.');
        abort_unless(self::emCurso($mesa), 422, 'A Disparada só vale em combate.');
        $this->gastar($mesa, $acesso, $personagemId, $categoria);

        $depois = DB::transaction(function () use ($mesa, $acesso, $personagemId) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $c = self::normalizar($m->combate);
            $k = collect($c['itens'])->search(fn ($i) => $i['personagem_id'] === $personagemId);
            // o deslocamento é movimento: só no turno do personagem (a única trava real do combate); o mestre sempre
            abort_if($k !== false && ! $acesso->ehMestre() && $c['atual'] !== $c['itens'][$k]['id'], 422, 'Não é o seu turno.');
            if ($k !== false) {
                $base = $this->baseDoTurno($m, $c['itens'][$k]) ?? $c['itens'][$k]['movimento']['base'] ?? 0.0;
                $c['itens'][$k]['movimento']['bonus'] += $base;
                $c['itens'][$k]['movimento']['base'] = $base;
                $m->forceFill(['combate' => $c])->save();
            }

            return $c;
        });
        Transmitir::enviar($mesa, 'combate', ['combate' => $depois, 'ator' => $acesso->jogador->id], ['mesa']);

        return $depois;
    }

    /** @param array<string, mixed> $c o estado normalizado */
    private function aplicar(Mesa $mesa, AcessoMesa $acesso, string $comando, array $d, array $c): array
    {
        return match ($comando) {
            'iniciar' => $this->iniciar($mesa, $d),
            'iniciativa' => $this->iniciativa($mesa, $acesso, $c, (string) $d['item_id']),
            'rolar_npcs' => $this->rolarNpcs($mesa, $acesso, $c),
            'definir_iniciativa' => $this->alterarItem($c, (string) $d['item_id'], fn (array $i) => [...$i, 'iniciativa' => $d['iniciativa'] ?? null], reordenar: true),
            'definir_disposicao' => $this->alterarItem($c, (string) $d['item_id'], fn (array $i) => [...$i, 'disposicao' => $d['disposicao']]),
            'comecar' => $this->comecar($mesa, $c),
            'turno' => $this->turno($mesa, $c, (string) ($d['sentido'] ?? 'proximo'), $d['item_id'] ?? null),
            'rodada' => $this->definirRodada($c, max(1, (int) $d['rodada'])),
            'ordem' => $this->reordenar($c, array_map('strval', $d['ids'])),
            'adicionar' => $this->adicionar($mesa, $c, $d),
            'adicionar_varios' => $this->adicionarVarios($mesa, $c, $d),
            'remover' => $this->remover($c, (string) $d['item_id']),
            'devolver' => $this->devolver($c, (string) $d['item_id'], (string) $d['categoria']),
            'definir_movimento' => $this->alterarItem($c, (string) $d['item_id'], fn (array $i) => [...$i, 'movimento' => [...$i['movimento'], 'bonus' => (float) ($d['bonus'] ?? $i['movimento']['bonus']), 'usado' => (float) ($d['usado'] ?? $i['movimento']['usado'])]]),
            'encerrar' => $this->encerrar($mesa),
            default => throw ValidationException::withMessages(['comando' => 'Comando de combate desconhecido.']),
        };
    }

    /** O mestre fixa a rodada: ao mudar de rodada, a reação de todos volta (como na virada normal). */
    private function definirRodada(array $c, int $rodada): array
    {
        if ($rodada !== $c['rodada']) {
            $c['itens'] = array_map(function (array $it) {
                unset($it['acoes']['reacao']);

                return $it;
            }, $c['itens']);
        }

        return [...$c, 'rodada' => $rodada];
    }

    /** Fim do encontro: o combate zera e os bônus que duram "até o fim do encontro" (`bonusExecucao`) voltam a 0. */
    private function encerrar(Mesa $mesa): array
    {
        $sistema = $this->sistemas->resolver($mesa->sistema->slug);
        foreach (Personagem::query()->where('mesa_id', $mesa->id)->get() as $p) {
            // O sistema renova o que volta ao fim do encontro (ex.: Pontos de Escudo do Haki)
            if ($sistema && method_exists($sistema, 'aoEncerrarCombate') && ($renovar = $sistema->aoEncerrarCombate($p->fichaCompleta($sistema))) !== []) {
                $p->ficha = app(\App\Nucleo\Sistemas\FichaCampos::class)->aplicar($sistema, $p->ficha, $renovar);
                $p->save();
                Duracoes::transmitir($mesa, $p, $renovar);
            }
            // Condições com duração em turnos e reduções armadas só contam em combate: ao encerrar, não ficam presas na ficha
            Duracoes::aoEncerrarCombate($mesa, $p);
            if ((int) ($p->ficha['bonusExecucao'] ?? 0) > 0) {
                $ficha = $p->ficha;
                $ficha['bonusExecucao'] = 0;
                $p->ficha = $ficha;
                $p->save();
                Duracoes::transmitir($mesa, $p, ['bonusExecucao' => 0]);
            }
        }

        return self::normalizar(null);
    }

    /** O mestre devolve um uso de uma categoria de ação (ou tudo: `todas`) a um participante. */
    private function devolver(array $c, string $itemId, string $categoria): array
    {
        return $this->alterarItem($c, $itemId, function (array $i) use ($categoria) {
            if ($categoria === 'movimento') {
                $i['movimento'] = [...$i['movimento'], 'usado' => 0.0, 'bonus' => 0.0];
            } elseif ($categoria === 'todas') {
                $i['acoes'] = [];
            } elseif (($i['acoes'][$categoria] ?? 0) > 0) {
                $i['acoes'][$categoria]--;
                if ($i['acoes'][$categoria] === 0) {
                    unset($i['acoes'][$categoria]);
                    if ($categoria === 'padrao') {
                        unset($i['acoes']['ataques'], $i['acoes']['extras']); // a Ação devolvida leva os ataques dela
                    }
                }
            }

            return $i;
        });
    }

    // --- iniciar e iniciativa -------------------------------------------------------------------------------------------

    /**
     * Abre o combate na fase de iniciativa com os tokens de personagem da página (ou só os `objetos` informados). Cada
     * personagem entra uma vez; token sem personagem (monstro avulso) também entra.
     */
    private function iniciar(Mesa $mesa, array $d): array
    {
        $tokens = Objeto::query()->where('tipo', 'token')->whereIn('camada', ['jogadores', 'mestre'])
            ->whereHas('pagina', fn ($q) => $q->where('mesa_id', $mesa->id))
            ->when(isset($d['pagina_id']), fn ($q) => $q->where('pagina_id', $d['pagina_id']))
            ->when(! empty($d['objetos']), fn ($q) => $q->whereIn('id', $d['objetos']))
            ->orderBy('id')->get();
        $personagens = Personagem::query()->where('mesa_id', $mesa->id)->with('jogadores')->get()->keyBy('id');

        $vistos = [];
        $itens = [];
        foreach ($tokens as $t) {
            if ($t->personagem_id && isset($vistos[$t->personagem_id])) {
                continue;
            }
            $vistos[$t->personagem_id] = true;
            $p = $t->personagem_id ? $personagens->get($t->personagem_id) : null;
            $itens[] = $this->novoItem($t->nome ?: ($p?->nome ?? 'Token'), $p?->cor ?? ($t->dados['cor'] ?? null), $p?->id, $t->id, $p && $p->jogadores->isNotEmpty() ? 'jogadores' : 'inimigo');
        }

        return ['ativo' => true, 'fase' => 'iniciativa', 'rodada' => 1, 'atual' => null, 'itens' => $itens];
    }

    private function novoItem(string $nome, ?string $cor, ?int $personagemId, ?int $objetoId, string $disposicao): array
    {
        return [
            'id' => Str::lower(Str::random(8)), 'nome' => $nome, 'cor' => $cor, 'personagem_id' => $personagemId, 'objeto_id' => $objetoId,
            'disposicao' => $disposicao, 'iniciativa' => null, 'acoes' => [], 'movimento' => ['usado' => 0.0, 'bonus' => 0.0],
        ];
    }

    /** O jogador rola a iniciativa dos personagens DELE (o mestre, a de qualquer um): a rolagem é do servidor. */
    private function iniciativa(Mesa $mesa, AcessoMesa $acesso, array $c, string $itemId): array
    {
        $item = $this->item($c, $itemId);
        abort_unless($c['fase'] === 'iniciativa' || $acesso->ehMestre(), 422, 'A iniciativa não está sendo rolada.');
        abort_unless($acesso->ehMestre() || ($item['personagem_id'] !== null && $acesso->podeControlar($item['personagem_id'])), 403, 'Este personagem não é seu.');
        if ($item['iniciativa'] !== null && ! $acesso->ehMestre()) {
            throw ValidationException::withMessages(['item_id' => 'Você já rolou a iniciativa.']);
        }

        return $this->alterarItem($c, $itemId, fn (array $i) => [...$i, 'iniciativa' => $this->rolarDe($mesa, $acesso, $i)], reordenar: $c['fase'] === 'em_curso');
    }

    /** Rola a iniciativa de todos os que ainda não têm (normalmente os NPCs); o jogador rola a sua pela tela dele. */
    private function rolarNpcs(Mesa $mesa, AcessoMesa $acesso, array $c): array
    {
        foreach ($c['itens'] as $k => $i) {
            $temDono = $i['personagem_id'] !== null && Personagem::query()->whereKey($i['personagem_id'])->first()?->jogadores()->exists();
            if ($i['iniciativa'] === null && ! $temDono) {
                $c['itens'][$k]['iniciativa'] = $this->rolarDe($mesa, $acesso, $i);
            }
        }

        return $c['fase'] === 'em_curso' ? $this->ordenar($c) : $c;
    }

    /** Rola e posta o cartão no chat; devolve o total. Sem ficha/sistema com combate, rola 1d20 puro. */
    private function rolarDe(Mesa $mesa, AcessoMesa $acesso, array $item): int
    {
        $personagem = $item['personagem_id'] ? Personagem::query()->where('mesa_id', $mesa->id)->find($item['personagem_id']) : null;
        $sistema = $personagem ? $this->sistemas->resolver($mesa->sistema->slug) : null;
        $ficha = $personagem && $sistema ? $personagem->fichaCompleta($sistema) : [];
        $expressao = $sistema instanceof SistemaDeCombate ? $sistema->iniciativa($ficha) : '1d20';
        $variaveis = $sistema ? $sistema->variaveisDeRolagem($ficha, []) : [];
        $r = $this->rolador->rolar($expressao, $variaveis);

        $mensagem = $mesa->mensagens()->create([
            'jogador_id' => $acesso->jogador->id, 'personagem_id' => $personagem?->id, 'tipo' => 'rolagem', 'visibilidade' => 'todos',
            'texto' => $r['expressao'],
            'dados' => ['expressao' => $r['expressao'], 'rotulo' => "Iniciativa de {$item['nome']}", 'termos' => $r['termos'], 'total' => $r['total']],
        ]);
        EntregarMensagem::para($mesa, $mensagem, $acesso);

        return $r['total'];
    }

    // --- turnos ---------------------------------------------------------------------------------------------------------

    /** Termina a fase de iniciativa: ordena (maior primeiro, sem valor por último) e abre o turno do primeiro. */
    private function comecar(Mesa $mesa, array $c): array
    {
        abort_unless($c['fase'] === 'iniciativa', 422, 'O combate não está na fase de iniciativa.');
        abort_if($c['itens'] === [], 422, 'Não há participantes.');
        $c = $this->ordenar($c);

        return [...$c, 'fase' => 'em_curso', 'rodada' => 1, 'atual' => $c['itens'][0]['id'], 'itens' => $this->novoTurno($mesa, $c['itens'], $c['itens'][0]['id'])];
    }

    /** `proximo`, `anterior` ou `escolher` (um item: o mestre passa a vez para quem quiser). A rodada muda ao dar a volta. */
    private function turno(Mesa $mesa, array $c, string $sentido, ?string $itemId): array
    {
        abort_unless($c['fase'] === 'em_curso', 422, 'O combate não está em curso.');
        $n = count($c['itens']);
        abort_if($n === 0, 422, 'Não há participantes.');
        $i = array_search($c['atual'], array_column($c['itens'], 'id'), true);
        $rodada = $c['rodada'];
        if ($sentido === 'escolher') {
            $novo = array_search((string) $itemId, array_column($c['itens'], 'id'), true);
            abort_if($novo === false, 422, 'Participante desconhecido.');
        } else {
            $novo = $i === false ? 0 : $i + ($sentido === 'anterior' ? -1 : 1);
            if ($novo >= $n) {
                $novo = 0;
                $rodada++;
            } elseif ($novo < 0) {
                $novo = $n - 1;
                $rodada = max(1, $rodada - 1);
            }
        }
        $itens = $this->novoTurno($mesa, $c['itens'], $c['itens'][$novo]['id']);
        if ($rodada > $c['rodada']) {
            // Nova rodada: a reação de todos volta (a categoria por rodada zera)
            $itens = array_map(function (array $it) {
                unset($it['acoes']['reacao']);

                return $it;
            }, $itens);
        }

        return [...$c, 'rodada' => $rodada, 'atual' => $c['itens'][$novo]['id'], 'itens' => $itens];
    }

    /** Quem entra no turno começa sem ações gastas e sem movimento usado, com o deslocamento do turno calculado agora. */
    private function novoTurno(Mesa $mesa, array $itens, string $id): array
    {
        return array_map(fn (array $i) => $i['id'] === $id ? [...$i, 'acoes' => array_intersect_key($i['acoes'], ['reacao' => 1]), 'movimento' => ['usado' => 0.0, 'bonus' => 0.0, 'base' => $this->baseDoTurno($mesa, $i)]] : $i, $itens);
    }

    /** O deslocamento do turno em metros (pelo sistema e a ficha), ou null se o sistema não mede ou o participante não tem personagem. */
    public function baseDoTurno(Mesa $mesa, array $item): ?float
    {
        $sistema = $this->sistemas->resolver($mesa->sistema->slug);
        $personagem = $item['personagem_id'] ? Personagem::query()->where('mesa_id', $mesa->id)->find($item['personagem_id']) : null;
        if (! $sistema instanceof SistemaDeCombate || ! $personagem) {
            return null;
        }
        $ficha = $personagem->fichaCompleta($sistema);

        return $sistema->deslocamentoDoTurno($ficha, $sistema->variaveisDeRolagem($ficha, []));
    }

    // --- itens ----------------------------------------------------------------------------------------------------------

    private function adicionar(Mesa $mesa, array $c, array $d): array
    {
        $p = isset($d['personagem_id']) ? Personagem::query()->where('mesa_id', $mesa->id)->with('jogadores')->find($d['personagem_id']) : null;
        abort_if(isset($d['personagem_id']) && ! $p, 422, 'Personagem desconhecido.');
        abort_if($p && collect($c['itens'])->contains('personagem_id', $p->id), 422, 'Este personagem já está no combate.');
        $nome = trim((string) ($d['nome'] ?? $p?->nome ?? ''));
        abort_if($nome === '', 422, 'Dê um nome ao participante.');
        $item = $this->novoItem($nome, $p?->cor ?? ($d['cor'] ?? null), $p?->id, $d['objeto_id'] ?? null, $d['disposicao'] ?? ($p && $p->jogadores->isNotEmpty() ? 'jogadores' : 'inimigo'));
        $item['iniciativa'] = $d['iniciativa'] ?? null;
        $c['itens'][] = $item;

        return $c['fase'] === 'em_curso' && $item['iniciativa'] !== null ? $this->ordenar($c) : $c;
    }

    /**
     * Adiciona de uma vez os personagens informados (ids), pulando os que já estão no combate. Cada um liga ao token dele
     * (da página informada, ou de qualquer uma). Quem tem jogador entra como `jogadores`; os demais, como `inimigo`.
     */
    private function adicionarVarios(Mesa $mesa, array $c, array $d): array
    {
        $ids = array_values(array_unique(array_map('intval', $d['personagem_ids'] ?? [])));
        $ja = array_column($c['itens'], 'personagem_id');
        $personagens = Personagem::query()->where('mesa_id', $mesa->id)->whereIn('id', $ids)->with('jogadores')->orderBy('nome')->get();
        abort_if($personagens->isEmpty(), 422, 'Escolha ao menos um personagem.');
        $tokens = Objeto::query()->where('tipo', 'token')->whereIn('personagem_id', $personagens->pluck('id'))
            ->whereHas('pagina', fn ($q) => $q->where('mesa_id', $mesa->id))
            ->orderByRaw('pagina_id = ? desc', [$d['pagina_id'] ?? 0])->orderBy('id')->get()->unique('personagem_id')->keyBy('personagem_id');
        foreach ($personagens as $p) {
            if (in_array($p->id, $ja, true)) {
                continue;
            }
            $c['itens'][] = $this->novoItem($p->nome, $p->cor, $p->id, $tokens->get($p->id)?->id, $p->jogadores->isNotEmpty() ? 'jogadores' : 'inimigo');
        }

        return $c;
    }

    private function remover(array $c, string $itemId): array
    {
        $this->item($c, $itemId);
        $era = $c['atual'] === $itemId;
        $c['itens'] = array_values(array_filter($c['itens'], fn ($i) => $i['id'] !== $itemId));
        if ($era) {
            $c['atual'] = $c['fase'] === 'em_curso' ? ($c['itens'][0]['id'] ?? null) : null;
        }

        return $c;
    }

    /** A nova ordem dos turnos (todos os ids, sem repetir). O turno atual continua com quem estava. */
    private function reordenar(array $c, array $ids): array
    {
        $atuais = array_column($c['itens'], 'id');
        abort_unless(count($ids) === count($atuais) && count(array_diff($atuais, $ids)) === 0 && count(array_unique($ids)) === count($ids), 422, 'A ordem precisa ter todos os participantes, uma vez cada.');
        $porId = array_column($c['itens'], null, 'id');
        $c['itens'] = array_map(fn ($id) => $porId[$id], $ids);

        return $c;
    }

    /** Maior iniciativa primeiro, sem valor por último; empates mantêm a ordem em que estavam. */
    private function ordenar(array $c): array
    {
        $indexados = array_map(null, $c['itens'], array_keys($c['itens']));
        usort($indexados, fn ($a, $b) => (($b[0]['iniciativa'] ?? -INF) <=> ($a[0]['iniciativa'] ?? -INF)) ?: $a[1] <=> $b[1]);
        $c['itens'] = array_column($indexados, 0);

        return $c;
    }

    /** Muda um item; depois de começar, a mudança de iniciativa reordena. */
    private function alterarItem(array $c, string $itemId, callable $fn, bool $reordenar = false): array
    {
        $this->item($c, $itemId);
        $c['itens'] = array_map(fn ($i) => $i['id'] === $itemId ? $fn($i) : $i, $c['itens']);

        return $reordenar && $c['fase'] === 'em_curso' ? $this->ordenar($c) : $c;
    }

    private function item(array $c, string $id): array
    {
        foreach ($c['itens'] as $i) {
            if ($i['id'] === $id) {
                return $i;
            }
        }
        throw ValidationException::withMessages(['item_id' => 'Participante desconhecido.']);
    }
}
