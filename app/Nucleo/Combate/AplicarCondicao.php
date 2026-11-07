<?php

namespace App\Nucleo\Combate;

use App\Models\Personagem;
use App\Nucleo\Sistemas\FichaCampos;
use App\Nucleo\Sistemas\Sistema;

/**
 * Aplica uma condição com duração a um personagem (as Técnicas aplicam sozinhas a quem falha na Salvaguarda). Respeita a imunidade.
 * `aplicar` roda DENTRO de uma transação (quem chama a abre); o aviso às fichas (`Duracoes::transmitir`) vem depois dela.
 */
final class AplicarCondicao
{
    public function __construct(private readonly FichaCampos $fichas) {}

    /**
     * @return array{p: Personagem, situacao: 'aplicada'|'imune'|'desconhecida', campos: array, nome: string}
     */
    public function aplicar(int $personagemId, Sistema $sistema, string $condicao, ?int $turnos = null, bool $aoDano = false): array
    {
        $catalogo = collect(method_exists($sistema, 'condicoes') ? $sistema->condicoes() : [])->keyBy('id');
        $p = Personagem::query()->whereKey($personagemId)->lockForUpdate()->firstOrFail();
        if (! $catalogo->has($condicao)) {
            return ['p' => $p, 'situacao' => 'desconhecida', 'campos' => [], 'nome' => $condicao];
        }
        $nome = $catalogo[$condicao]['nome'];
        $ficha = $p->fichaCompleta($sistema);
        if (Dano::contem($ficha['imunidades'] ?? [], $nome) || Dano::contem($ficha['imunidades'] ?? [], $condicao)) {
            return ['p' => $p, 'situacao' => 'imune', 'campos' => [], 'nome' => $nome];
        }
        $condicoes = array_values(array_unique([...($ficha['condicoes'] ?? []), $condicao]));
        $duracoes = $ficha['duracoes'] ?? [];
        unset($duracoes[$condicao]);
        if ($turnos !== null || $aoDano) {
            $duracoes[$condicao] = ['turnos' => $turnos ?? 99, 'aoDano' => $aoDano];
        }
        $campos = ['condicoes' => $condicoes];
        if (array_key_exists('duracoes', $ficha)) {
            $campos['duracoes'] = $duracoes;
        }
        $p->ficha = $this->fichas->aplicar($sistema, $p->ficha, $campos);
        $p->save();

        return ['p' => $p, 'situacao' => 'aplicada', 'campos' => $campos, 'nome' => $nome];
    }
}
