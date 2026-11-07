<?php

namespace App\Console\Commands;

use App\Models\Mesa;
use App\Models\Sistema;
use App\Models\User;
use App\Sistemas\OnePiece\FichaOnePiece;
use Illuminate\Console\Command;

/**
 * Mesa FIXA dos testes de ponta a ponta (Playwright): "E2E Quick Draw (não apagar)". Cada execução a deixa exatamente no mesmo estado, sem apagar
 * a mesa: ficha do Atirador de nível 20 (tests/e2e/ficha-atirador.json), tokens, combate em curso e chat vazio. Imprime o token do convite.
 *
 *   php artisan e2e:preparar-mesa        (veja tests/e2e/quick-draw.mjs)
 */
class PrepararMesaE2E extends Command
{
    protected $signature = 'e2e:preparar-mesa';

    protected $description = 'Cria ou restaura a mesa fixa de testes de ponta a ponta (Quick Draw do Atirador)';

    public const NOME = 'E2E Quick Draw (não apagar)';

    public function handle(): int
    {
        $dono = User::query()->first() ?? User::factory()->create(['email' => 'e2e@example.test']);
        $mesa = Mesa::query()->where('nome', self::NOME)->first() ?? $dono->mesas()->create([
            'nome' => self::NOME, 'slug' => 'e2e-quick-draw', 'sistema_id' => Sistema::where('slug', 'one-piece')->value('id'), 'tema_entrada' => 'padrao',
        ]);

        // estado limpo: sem personagens (e tokens), itens, mensagens e eventos; a mesa e os jogadores ficam
        $mesa->forceFill(['fogo_amigo' => false])->save();
        $mesa->personagens()->each(fn ($p) => $p->delete());
        $mesa->mensagens()->delete();
        $mesa->eventosDeCombate()->delete();
        $pagina = $mesa->paginas()->first() ?? $mesa->paginas()->create(['nome' => 'Arena', 'ordem' => 1]);
        $pagina->objetos()->delete();

        $jogador = fn (string $nome, string $papel, string $cor) => $mesa->jogadores()->firstOrCreate(['nome' => $nome], ['papel' => $papel, 'cor' => $cor]);
        $mestre = $jogador('MestreE2E', 'mestre', '#d4a843');
        $ana = $jogador('JogadorE2E', 'jogador', '#2563eb');
        $bia = $jogador('OutroE2E', 'jogador', '#16a34a');
        foreach ([$mestre, $ana, $bia] as $j) {
            $j->pagina_id = $pagina->id;
            $j->save();
        }

        $dados = json_decode(file_get_contents(base_path('tests/e2e/ficha-atirador.json')), true);
        $ficha = FichaOnePiece::padrao();
        foreach ($dados['campos'] as $caminho => $valor) {
            data_set($ficha, $caminho, $valor);
        }
        $ficha['nivel'] = $dados['nivel'];
        $ficha['pp'] = ['atual' => 80, 'porNivel' => 4];
        // o Atirador empunha um Mosquete do catálogo (alcance 18/24 m): limita as áreas "Arma, Cone/Linha" a 24 m
        $mosquete = $mesa->itens()->updateOrCreate(['catalogo_id' => 'mosquete'], [
            'nome' => 'Mosquete', 'peso' => 4, 'equipavel' => true,
            'dados' => ['arma' => ['dano' => '1d12', 'atributo' => 'des', 'tipoDano' => 'Perfurante', 'proficiente' => true, 'distancia' => true], 'catalogo' => ['id' => 'mosquete']],
        ]);
        $ficha['inventario'] = [['secao' => 'Equipamento', 'itens' => [['item_id' => $mosquete->id, 'qtd' => 1, 'equipado' => true, 'sintonizado' => false]]]];

        $personagem = function (string $nome, ?object $dono, array $ficha) use ($mesa) {
            $p = $mesa->personagens()->create(['nome' => $nome, 'cor' => '#0ea5e9']);
            $dono && $p->jogadores()->attach($dono);
            $p->ficha = $ficha;
            $p->save();

            return $p;
        };
        $inimigo = fn (int $ca = -20) => (function () use ($ca) {
            $f = FichaOnePiece::padrao();
            $f['pv'] = ['max' => 400, 'atual' => 400, 'temp' => 0];
            $f['ajustes']['ca'] = $ca; // CA baixíssima: só o 1 natural erra
            return $f;
        })();

        $atirador = $personagem('AtiradorE2E', $ana, $ficha);
        $amigo = $personagem('AmigoE2E', $bia, FichaOnePiece::padrao());   // PC de outro jogador, ao alcance: sem fogo amigo
        $perto = $personagem('PertoE2E', null, $inimigo());               // NPC inimigo ao alcance (15 m)
        $oculto = $personagem('OcultoE2E', null, $inimigo());             // NPC inimigo ao alcance, mas na camada do Mestre
        $longe = $personagem('LongeE2E', null, $inimigo());               // NPC inimigo fora do alcance (45 m)
        $aliado = $personagem('AliadoE2E', null, $inimigo());             // NPC ao alcance que o roteiro marca como aliado dos jogadores

        // 70 px = 1,5 m: o Atirador em (1000, 1000)
        $token = fn ($p, string $camada, float $dx) => $pagina->objetos()->create([
            'camada' => $camada, 'tipo' => 'token', 'personagem_id' => $p->id, 'nome' => $p->nome, 'x' => 1000 + $dx, 'y' => 1000, 'largura' => 70, 'altura' => 70, 'z' => 1,
        ]);
        $objetos = [
            'a' => $token($atirador, 'jogadores', 0),
            'b' => $token($perto, 'jogadores', 70 * 6),     // 9 m
            'c' => $token($oculto, 'mestre', 70 * 7),       // 10,5 m (escondido)
            'd' => $token($amigo, 'jogadores', 70 * 8),     // 12 m (aliado)
            'e' => $token($longe, 'jogadores', 70 * 30),    // 45 m
            'f' => $token($aliado, 'jogadores', 70 * 5),    // 7,5 m
        ];
        $item = fn (string $id, $p, int $ini, string $disp) => [
            'id' => $id, 'nome' => $p->nome, 'cor' => '#0ea5e9', 'personagem_id' => $p->id, 'objeto_id' => $objetos[$id]->id,
            'disposicao' => $disp, 'iniciativa' => $ini, 'acoes' => [], 'movimento' => ['usado' => 0.0, 'bonus' => 0.0],
        ];
        $mesa->combate = ['ativo' => true, 'fase' => 'em_curso', 'rodada' => 1, 'atual' => 'a', 'ativas' => [], 'itens' => [
            $item('a', $atirador, 30, 'jogadores'), $item('b', $perto, 25, 'inimigo'), $item('c', $oculto, 20, 'inimigo'),
            $item('f', $aliado, 18, 'inimigo'), $item('d', $amigo, 15, 'jogadores'), $item('e', $longe, 10, 'inimigo'),
        ]];
        $mesa->save();

        $this->line(json_encode([
            'token' => $mesa->convite_token, 'mesa' => $mesa->id, 'slug' => $mesa->slug,
            'atirador' => $atirador->id, 'perto' => $perto->id, 'oculto' => $oculto->id, 'amigo' => $amigo->id, 'longe' => $longe->id, 'aliado' => $aliado->id,
        ]));

        return self::SUCCESS;
    }
}
