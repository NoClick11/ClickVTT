<?php

namespace App\Nucleo\Combate;

use App\Models\Mensagem;
use App\Models\Mesa;
use App\Models\Objeto;
use App\Models\Personagem;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
use App\Support\Transmitir;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Técnicas com duração (Quick Draw...): ficam no estado do combate (`ativas`) e, a cada rodada, perdem uma rodada de duração; no início do
 * turno de cada criatura ao alcance, o chat pede o ataque de quem as usou (card `gatilho`: o jogador clica para rolar).
 *
 * Entrada de `ativas`: `{id, personagem_id, nome, rodadas, concentracao, alcance (m), dano: {expressao, tipo}, opcoes: [{id, rotulo, efeito}]}`.
 */
final class TecnicasAtivas
{
    /**
     * As ativas depois de um comando: uma rodada a menos por rodada nova; saem as que zeraram e as de quem não está mais no encontro.
     *
     * @param  array<string, mixed>  $antes
     * @param  array<string, mixed>  $depois
     * @return list<array<string, mixed>>
     */
    public static function aposMudanca(array $antes, array $depois): array
    {
        $ativas = $depois['ativas'] ?? $antes['ativas'] ?? [];
        $novas = max(0, (int) ($depois['rodada'] ?? 1) - (int) ($antes['rodada'] ?? 1));
        $presentes = array_filter(array_column($depois['itens'] ?? [], 'personagem_id'));
        $saida = [];
        foreach ($ativas as $a) {
            $a['rodadas'] = (int) $a['rodadas'] - $novas;
            if ($a['rodadas'] > 0 && in_array($a['personagem_id'], $presentes, true) && ($depois['fase'] ?? '') === 'em_curso') {
                $saida[] = $a;
            }
        }

        return $saida;
    }

    /** Distância (m) entre os tokens de dois personagens na mesma página, ou null se não estão juntos num mapa; mais o raio do 2º. */
    public static function distancia(int $deId, int $paraId): ?array
    {
        $de = Objeto::query()->where('tipo', 'token')->where('personagem_id', $deId)->get();
        foreach ($de as $a) {
            $b = Objeto::query()->where('tipo', 'token')->where('personagem_id', $paraId)->where('pagina_id', $a->pagina_id)->first();
            if (! $b) {
                continue;
            }
            $pagina = $a->pagina;
            $dx = ($b->x + $b->largura / 2) - ($a->x + $a->largura / 2);
            $dy = ($b->y + $b->altura / 2) - ($a->y + $a->altura / 2);
            $raio = Movimento::metros(min($b->largura, $b->altura) / 2, 0, $pagina);

            return ['metros' => Movimento::metros($dx, $dy, $pagina), 'raio' => $raio];
        }

        return null;
    }

    /**
     * Quem entrou no turno: para cada Técnica ativa de OUTRO participante cujo alcance chega até ele, posta no chat o card do ataque.
     * Sem os tokens no mesmo mapa não dá para medir o alcance: nada é pedido.
     *
     * @param  array<string, mixed>  $antes
     * @param  array<string, mixed>  $depois
     */
    public static function aoMudarOTurno(Mesa $mesa, AcessoMesa $acesso, array $antes, array $depois): void
    {
        if (($depois['fase'] ?? '') !== 'em_curso' || ($depois['atual'] ?? null) === null || ($depois['atual'] ?? null) === ($antes['atual'] ?? null) || empty($depois['ativas'])) {
            return;
        }
        $item = collect($depois['itens'])->firstWhere('id', $depois['atual']);
        $alvoId = $item['personagem_id'] ?? null;
        if (! $alvoId) {
            return;
        }
        $alvo = Personagem::query()->where('mesa_id', $mesa->id)->find($alvoId);
        foreach ($depois['ativas'] as $a) {
            // a Vigília (Overwatch) dispara quando a criatura age ou se move, não no início do turno
            if (($a['tipo'] ?? '') === 'vigia') {
                continue;
            }
            // sem fogo amigo: a Técnica só pede ataque contra quem o atacante pode atingir
            if (! $alvo || $a['personagem_id'] === $alvoId || ! Equipes::podeAtingir($mesa, $a['personagem_id'], $alvoId)) {
                continue;
            }
            $atacante = Personagem::query()->where('mesa_id', $mesa->id)->find($a['personagem_id']);
            // camadas: quem os jogadores não veem (camada do Mestre) não é "criatura que você veja"; o que um personagem oculto faz só o mestre vê
            $atacanteOculto = Visibilidade::oculto((int) $a['personagem_id']);
            if (! $atacanteOculto && Visibilidade::oculto($alvoId)) {
                continue;
            }
            $d = self::distancia((int) $a['personagem_id'], $alvoId);
            if (! $atacante || ! $d || $d['metros'] > (float) $a['alcance'] + $d['raio'] + Movimento::FOLGA) {
                continue;
            }
            $mensagem = $mesa->mensagens()->create([
                'jogador_id' => $acesso->jogador->id, 'personagem_id' => $atacante->id, 'tipo' => 'gatilho', 'visibilidade' => $atacanteOculto ? 'mestre' : 'todos',
                'texto' => "{$a['nome']}: {$atacante->nome} pode atacar {$alvo->nome}",
                'dados' => [
                    'rotulo' => $a['nome'], 'estado' => 'pendente', 'ativa_id' => $a['id'],
                    'atacante' => ['personagem_id' => $atacante->id, 'nome' => $atacante->nome],
                    'alvo' => ['personagem_id' => $alvo->id, 'nome' => $alvo->nome],
                    'opcoes' => array_map(fn ($o) => ['id' => $o['id'], 'rotulo' => $o['rotulo']], $a['opcoes'] ?? []),
                    'rodadas' => $a['rodadas'],
                ],
            ]);
            EntregarMensagem::para($mesa, $mensagem, $acesso);
        }
    }

    /** Uma entrada nova de `ativas` (id gerado aqui). */
    public static function nova(int $personagemId, string $nome, int $rodadas, bool $concentracao, float $alcance, array $dano, array $opcoes): array
    {
        return [
            'id' => (string) Str::uuid(), 'personagem_id' => $personagemId, 'nome' => $nome, 'rodadas' => $rodadas,
            'concentracao' => $concentracao, 'alcance' => $alcance, 'dano' => $dano, 'opcoes' => array_values($opcoes),
        ];
    }

    // --- Vigília (Overwatch): esfera no mapa; dispara quando uma criatura age ou se move dentro dela ------------------------------

    /** Ações que contam como "realizar uma ação" (a livre e a reação não): disparam a Vigília dos outros e encerram a do próprio atirador. */
    private const ACOES_QUE_CONTAM = ['padrao', 'bonus', 'poderosa'];

    /**
     * Uma Vigília nova. `zona`: `{pagina_id, x, y, raio}` com o centro em pixels do mapa e o raio em metros.
     *
     * @param  array{pagina_id: int, x: float, y: float, raio: float}  $zona
     */
    public static function novaVigia(int $personagemId, string $nome, int $rodadas, bool $concentracao, array $zona): array
    {
        return [
            'id' => (string) Str::uuid(), 'personagem_id' => $personagemId, 'nome' => $nome, 'rodadas' => $rodadas, 'concentracao' => $concentracao,
            'alcance' => 0.0, 'dano' => null, 'opcoes' => [], 'tipo' => 'vigia', 'zona' => $zona,
        ];
    }

    /** A criatura (token do personagem) está dentro da esfera? Mede do centro da esfera ao centro do token, descontando o raio do token. */
    public static function dentroDaZona(array $zona, int $personagemId, ?array $ponto = null): bool
    {
        $token = Objeto::query()->where('tipo', 'token')->where('personagem_id', $personagemId)->where('pagina_id', $zona['pagina_id'])->first();
        if (! $token || ! $token->pagina) {
            return false;
        }
        $cx = $ponto['x'] ?? ($token->x + $token->largura / 2);
        $cy = $ponto['y'] ?? ($token->y + $token->altura / 2);
        $metros = Movimento::metros($cx - (float) $zona['x'], $cy - (float) $zona['y'], $token->pagina);
        $raioToken = Movimento::metros(min($token->largura, $token->altura) / 2, 0, $token->pagina);

        return $metros <= (float) $zona['raio'] + $raioToken + Movimento::FOLGA;
    }

    /**
     * Uma criatura agiu (gastou Ação, Ação bônus ou Ação poderosa): a Vigília dos outros pede o ataque se ela está na esfera; e se foi o próprio
     * atirador, a Vigília dele acaba ("qualquer outra atividade encerra a Técnica").
     */
    public static function aoAgir(Mesa $mesa, AcessoMesa $acesso, int $personagemId, string $categoria, bool $manterVigia = false): void
    {
        if (! in_array($categoria, self::ACOES_QUE_CONTAM, true)) {
            return;
        }
        if (! $manterVigia) {
            self::encerrarVigias($mesa, $acesso, $personagemId, 'agiu');
        }
        self::disparar($mesa, $acesso, $personagemId, 'age', null);
    }

    /** Um token se moveu (do ponto antigo ao novo): a Vigília pede o ataque se ele começou ou terminou dentro da esfera; o atirador que anda a encerra. */
    public static function aoMover(Mesa $mesa, AcessoMesa $acesso, Objeto $token, array $de, array $para): void
    {
        if (! $token->personagem_id || ! CombateService::emCurso($mesa)) {
            return;
        }
        $centro = fn (array $p) => ['x' => $p['x'] + $token->largura / 2, 'y' => $p['y'] + $token->altura / 2];
        self::encerrarVigias($mesa, $acesso, (int) $token->personagem_id, 'se moveu');
        self::disparar($mesa, $acesso, (int) $token->personagem_id, 'se move', [$centro($de), $centro($para)]);
    }

    /** O atirador que age ou anda perde as Vigílias dele (avisa no chat). */
    public static function encerrarVigias(Mesa $mesa, AcessoMesa $acesso, int $personagemId, string $motivo): void
    {
        $encerradas = [];
        $depois = DB::transaction(function () use ($mesa, $personagemId, &$encerradas) {
            $m = Mesa::query()->whereKey($mesa->id)->lockForUpdate()->firstOrFail();
            $c = CombateService::normalizar($m->combate);
            foreach ($c['ativas'] as $a) {
                if (($a['tipo'] ?? '') === 'vigia' && $a['personagem_id'] === $personagemId) {
                    $encerradas[] = $a;
                }
            }
            if (! $encerradas) {
                return null;
            }
            $c['ativas'] = array_values(array_filter($c['ativas'], fn ($a) => ! (($a['tipo'] ?? '') === 'vigia' && $a['personagem_id'] === $personagemId)));
            $m->forceFill(['combate' => $c])->save();

            return $c;
        });
        if (! $depois) {
            return;
        }
        Transmitir::enviar($mesa, 'combate', ['combate' => $depois, 'ator' => 0], ['mesa']);
        foreach ($encerradas as $a) {
            AplicarDano::postar($mesa, $acesso, Visibilidade::mensagem($personagemId), "{$a['nome']} foi encerrada: o atirador {$motivo}.");
        }
    }

    /**
     * Posta o card "pode atacar" de cada Vigília de OUTRO personagem que alcança a criatura (sem fogo amigo, só se ela é visível aos jogadores,
     * um card pendente por Vigília e criatura).
     *
     * @param  list<array{x: float, y: float}>|null  $pontos  movimento: onde começou e onde terminou (basta um dentro da esfera)
     */
    private static function disparar(Mesa $mesa, AcessoMesa $acesso, int $alvoId, string $motivo, ?array $pontos): void
    {
        $c = CombateService::normalizar($mesa->fresh()->combate);
        if ($c['fase'] !== 'em_curso') {
            return;
        }
        $alvo = Personagem::query()->where('mesa_id', $mesa->id)->find($alvoId);
        foreach ($c['ativas'] as $a) {
            if (($a['tipo'] ?? '') !== 'vigia' || ! $alvo || $a['personagem_id'] === $alvoId || ! Equipes::podeAtingir($mesa, $a['personagem_id'], $alvoId)) {
                continue;
            }
            $atacanteOculto = Visibilidade::oculto((int) $a['personagem_id']);
            if (! $atacanteOculto && Visibilidade::oculto($alvoId)) {
                continue; // não é "criatura que você veja"
            }
            $dentro = $pontos === null
                ? self::dentroDaZona($a['zona'], $alvoId)
                : collect($pontos)->contains(fn ($p) => self::dentroDaZona($a['zona'], $alvoId, $p));
            if (! $dentro) {
                continue;
            }
            $pendente = $mesa->mensagens()->where('tipo', 'gatilho')->get()->contains(
                fn ($m) => ($m->dados['estado'] ?? null) === 'pendente' && ($m->dados['ativa_id'] ?? null) === $a['id'] && ($m->dados['alvo']['personagem_id'] ?? null) === $alvoId,
            );
            if ($pendente) {
                continue;
            }
            $atacante = Personagem::query()->where('mesa_id', $mesa->id)->find($a['personagem_id']);
            if (! $atacante) {
                continue;
            }
            $mensagem = $mesa->mensagens()->create([
                'jogador_id' => $acesso->jogador->id, 'personagem_id' => $atacante->id, 'tipo' => 'gatilho', 'visibilidade' => $atacanteOculto ? 'mestre' : 'todos',
                'texto' => "{$a['nome']}: {$alvo->nome} {$motivo} na esfera de {$atacante->nome}",
                'dados' => [
                    'rotulo' => $a['nome'], 'estado' => 'pendente', 'ativa_id' => $a['id'], 'vigia' => true, 'motivo' => $motivo,
                    'atacante' => ['personagem_id' => $atacante->id, 'nome' => $atacante->nome],
                    'alvo' => ['personagem_id' => $alvo->id, 'nome' => $alvo->nome],
                    'opcoes' => [], 'rodadas' => $a['rodadas'],
                ],
            ]);
            EntregarMensagem::para($mesa, $mensagem, $acesso);
        }
    }
}
