<?php

namespace App\Nucleo\Combate;

use App\Models\Mesa;
use App\Models\Objeto;
use App\Models\Personagem;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Sistemas\RegistroSistemas;
use App\Support\AcessoMesa;
use Illuminate\Support\Facades\DB;

/**
 * Zonas do mapa (objeto `zona`): uma área persistente (esfera, cone, linha ou retângulo) que o mestre desenha ou que uma Técnica lança, com
 * dano opcional e terreno difícil só desenhado. Uma zona oculta fica na camada `mestre` (o jogador nunca a recebe).
 *
 * O objeto guarda a origem no CENTRO da caixa (`x + largura/2`) e, em `dados`: `forma`, `metros` (raio ou comprimento), `largura_m`
 * (retângulo), `rotacao` (graus, a mesma do objeto), `dano_dados` e `dano_tipo`. Só o dano é automático (escopo do projeto): no início do turno de quem está
 * dentro e quando um token ENTRA nela, durante o combate. Sem duração: o mestre apaga a zona. Espelha `nucleo/combate/area.ts`.
 */
final class Zonas
{
    /** Largura da linha (m), como em `LARGURA_DA_LINHA`. */
    private const LARGURA_DA_LINHA = 1.5;

    /** Metros por pixel da página (o `distancia_quadrado` da unidade a cada `tamanho_quadrado` px). */
    public static function metrosPorPx(Objeto $zona): float
    {
        $p = $zona->pagina;

        return (float) $p->distancia_quadrado * Movimento::fatorParaMetros($p->unidade) / max(1, (float) $p->tamanho_quadrado);
    }

    /**
     * O ponto (centro e raio em px) está dentro da zona? `$ponto = [x, y, raio]`. Mesma conta de `tokensNaArea` (TS): o token conta se
     * qualquer parte dele toca a forma.
     *
     * @param  array{0: float, 1: float, 2: float}  $ponto
     */
    public static function contem(Objeto $zona, array $ponto): bool
    {
        $d = $zona->dados ?? [];
        $mpp = self::metrosPorPx($zona);
        $dx = ($ponto[0] - ($zona->x + $zona->largura / 2)) * $mpp;
        $dy = ($ponto[1] - ($zona->y + $zona->altura / 2)) * $mpp;
        $raio = $ponto[2] * $mpp;
        $metros = (float) ($d['metros'] ?? 0);
        $angulo = deg2rad((float) ($d['rotacao'] ?? 0));
        $distancia = hypot($dx, $dy);
        $forma = $d['forma'] ?? 'esfera';
        if ($forma === 'esfera') {
            return $distancia <= $metros + $raio;
        }
        $c = cos($angulo);
        $s = sin($angulo);
        $along = $dx * $c + $dy * $s;
        $across = abs(-$dx * $s + $dy * $c);
        if ($forma === 'retangulo') {
            return abs($along) <= $metros / 2 + $raio && $across <= ((float) ($d['largura_m'] ?? $metros)) / 2 + $raio;
        }
        if ($forma === 'linha') {
            return $along >= -$raio && $along <= $metros + $raio && $across <= self::LARGURA_DA_LINHA / 2 + $raio;
        }
        $meioAngulo = atan(0.5);

        return $along >= -$raio && $distancia <= $metros + $raio && $across <= max(0, $along) * tan($meioAngulo) + $raio / cos($meioAngulo);
    }

    /** O centro e o raio do token em px (o mesmo que o mapa usa). @return array{0: float, 1: float, 2: float} */
    public static function pontoDoToken(Objeto $token, ?array $de = null): array
    {
        $x = $de['x'] ?? $token->x;
        $y = $de['y'] ?? $token->y;

        return [$x + $token->largura / 2, $y + $token->altura / 2, min($token->largura, $token->altura) / 2];
    }

    /**
     * Os pontos do caminho reto do token (do lugar de onde saiu até onde parou), de meio em meio raio do token: uma zona fina (a linha de um
     * fio) fere quem a ATRAVESSA, mesmo sem parar nela. Sem o primeiro ponto (a saída).
     *
     * @param  array{x: float, y: float}  $de
     * @return list<array{0: float, 1: float, 2: float}>
     */
    private static function caminho(Objeto $token, array $de): array
    {
        $fim = self::pontoDoToken($token);
        $ini = self::pontoDoToken($token, $de);
        $passo = max(4.0, $fim[2] / 2);
        $n = min(400, max(1, (int) ceil(hypot($fim[0] - $ini[0], $fim[1] - $ini[1]) / $passo)));
        $pontos = [];
        for ($i = 1; $i <= $n; $i++) {
            $t = $i / $n;
            $pontos[] = [$ini[0] + ($fim[0] - $ini[0]) * $t, $ini[1] + ($fim[1] - $ini[1]) * $t, $fim[2]];
        }

        return $pontos;
    }

    /** As zonas da página que causam dano. @return list<Objeto> */
    private static function zonasComDano(int $paginaId): array
    {
        return Objeto::query()->with('pagina')->where('pagina_id', $paginaId)->where('tipo', 'zona')->get()
            ->filter(fn (Objeto $z) => filled($z->dados['dano_dados'] ?? null))->values()->all();
    }

    /**
     * Um token terminou de se mover: cada zona com dano que ele ENTROU ou ATRAVESSOU (estava fora e o caminho passou por dentro) o fere uma vez.
     *
     * @param  array{x: float, y: float}  $de  de onde ele saiu
     */
    public static function aoMover(Mesa $mesa, AcessoMesa $acesso, Objeto $token, array $de): void
    {
        if ($token->tipo !== 'token' || ! $token->personagem_id || ! CombateService::emCurso($mesa)) {
            return;
        }
        foreach (self::zonasComDano((int) $token->pagina_id) as $zona) {
            if (self::contem($zona, self::pontoDoToken($token, $de))) {
                continue; // já estava dentro: andar lá dentro não fere de novo
            }
            $entrou = self::contem($zona, self::pontoDoToken($token));
            $passou = $entrou || collect(self::caminho($token, $de))->contains(fn (array $p) => self::contem($zona, $p));
            if ($passou) {
                self::ferir($mesa, $acesso, (int) $token->personagem_id, $zona, $entrou ? 'entrou na' : 'atravessou a');
            }
        }
    }

    /**
     * Passou o turno: quem começa o turno dentro de uma zona com dano é ferido por ela.
     *
     * @param  array<string, mixed>  $antes
     * @param  array<string, mixed>  $depois
     */
    public static function aoMudarOTurno(Mesa $mesa, AcessoMesa $acesso, array $antes, array $depois): void
    {
        $atual = $depois['atual'] ?? null;
        if (! $atual || $atual === ($antes['atual'] ?? null) || ($depois['fase'] ?? null) !== 'em_curso') {
            return;
        }
        $personagemId = collect($depois['itens'] ?? [])->firstWhere('id', $atual)['personagem_id'] ?? null;
        if (! $personagemId) {
            return;
        }
        $tokens = Objeto::query()->where('tipo', 'token')->where('personagem_id', $personagemId)
            ->whereIn('pagina_id', $mesa->paginas()->pluck('id'))->get();
        foreach ($tokens as $token) {
            foreach (self::zonasComDano((int) $token->pagina_id) as $zona) {
                if (self::contem($zona, self::pontoDoToken($token))) {
                    self::ferir($mesa, $acesso, (int) $personagemId, $zona, 'começou o turno na');
                }
            }
        }
    }

    /** Rola o dano da zona, aplica com as defesas do alvo e avisa no chat. */
    private static function ferir(Mesa $mesa, AcessoMesa $acesso, int $personagemId, Objeto $zona, string $quando): void
    {
        $sistema = app(RegistroSistemas::class)->resolver($mesa->sistema->slug);
        $alvo = Personagem::query()->where('mesa_id', $mesa->id)->find($personagemId);
        if (! $sistema || ! $alvo || (($alvo->ficha['npc'] ?? false) && (int) ($alvo->ficha['pv']['atual'] ?? 1) <= 0)) {
            return;
        }
        $rolagem = app(Rolador::class)->rolar((string) $zona->dados['dano_dados']);
        $tipo = filled($zona->dados['dano_tipo'] ?? null) ? (string) $zona->dados['dano_tipo'] : null;
        $aplicar = app(AplicarDano::class);
        $r = DB::transaction(fn () => $aplicar->aplicar($mesa, $personagemId, $sistema, (int) $rolagem['total'], $tipo, [], null, ['origem' => 'zona']));
        $nome = $zona->nome ?: 'Zona sem nome';
        $aplicar->avisar($mesa, $acesso, 'todos', [...$r, 'aviso' => trim(($r['aviso'] ?? '')." {$alvo->nome} {$quando} zona ({$rolagem['expressao']} = {$rolagem['total']}).")], origem: $nome);
    }
}
