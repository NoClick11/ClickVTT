<?php

namespace App\Nucleo\Combate;

use App\Models\Mensagem;
use App\Models\Mesa;
use App\Models\Objeto;
use App\Models\Personagem;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Support\AcessoMesa;
use App\Support\EntregarMensagem;
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
            // sem fogo amigo: a Técnica só pede ataque contra quem é do outro lado
            if (! $alvo || $a['personagem_id'] === $alvoId || Equipes::mesmoLado($mesa, $a['personagem_id'], $alvoId)) {
                continue;
            }
            $atacante = Personagem::query()->where('mesa_id', $mesa->id)->find($a['personagem_id']);
            $d = self::distancia((int) $a['personagem_id'], $alvoId);
            if (! $atacante || ! $d || $d['metros'] > (float) $a['alcance'] + $d['raio'] + Movimento::FOLGA) {
                continue;
            }
            $mensagem = $mesa->mensagens()->create([
                'jogador_id' => $acesso->jogador->id, 'personagem_id' => $atacante->id, 'tipo' => 'gatilho', 'visibilidade' => 'todos',
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
}
