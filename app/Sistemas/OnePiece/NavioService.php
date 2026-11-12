<?php

namespace App\Sistemas\OnePiece;

use App\Models\Mesa;
use App\Models\Personagem;
use App\Support\AcessoMesa;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Operações sobre o navio (um `Personagem` com `ficha.navio`): obras, tesouro, carga, tripulação, PV e a passagem dos dias.
 *
 * Tudo roda em transação com a linha do navio travada; quando um personagem também muda (depósito, saque, carga), a ordem das
 * travas é sempre NAVIO e depois PERSONAGEM. Os jogadores não "controlam" o navio (o `PATCH` da ficha os recusa): só mexem por
 * aqui, e é o servidor que debita, move e valida.
 */
class NavioService
{
    private const MAX_REGISTRO = 40;

    private const MAX_BELLY = 1_000_000_000_000;

    /**
     * Cria o navio (só o mestre chama): de um modelo do livro ou em branco.
     *
     * @return array<string, mixed> a ficha do navio
     */
    public function fichaNova(Mesa $mesa, ?string $modelo, string $tamanho, string $madeira): array
    {
        $navio = $modelo ? Navios::doModelo($modelo) : Navios::padrao($tamanho, $madeira);
        if (! $navio) {
            throw ValidationException::withMessages(['modelo' => 'Modelo de navio desconhecido.']);
        }
        $navio['manutencao'] = ['proxima_dia' => $this->dia($mesa) + Navios::dados()['diasDaManutencao'], 'em_dia' => true];
        $pv = Navios::tamanho($navio['tamanho'])['pv'];

        return [...FichaOnePiece::padrao(), 'navio' => $navio, 'pv' => ['atual' => $pv, 'max' => $pv, 'temp' => 0, 'escudo' => 0, 'brutal' => 0], 'inventario' => [['secao' => 'Carga', 'itens' => []]]];
    }

    /**
     * Executa uma ação no navio. Devolve o navio salvo e, se um personagem mudou junto, ele também.
     *
     * @param  array<string, mixed>  $d  corpo da requisição
     * @return array{navio: Personagem, outro: ?Personagem}
     */
    public function operar(Mesa $mesa, AcessoMesa $acesso, int $navioId, string $acao, array $d): array
    {
        return DB::transaction(function () use ($mesa, $acesso, $navioId, $acao, $d) {
            $p = Personagem::query()->where('mesa_id', $mesa->id)->whereKey($navioId)->lockForUpdate()->firstOrFail();
            $ficha = $p->ficha ?? [];
            if (! is_array($ficha['navio'] ?? null)) {
                throw ValidationException::withMessages(['navio' => 'Este personagem não é um navio.']);
            }
            $ficha['navio'] = [...Navios::padrao(), ...$ficha['navio']];
            $ficha['navio']['oficios'] = $this->oficios($mesa, $ficha['navio']['tripulacao']);
            $mestre = $acesso->ehMestre();
            $dia = $this->dia($mesa);
            $outro = null;
            $soMestre = fn () => $mestre ?: abort(403, 'Só o mestre faz isso no navio.');

            switch ($acao) {
                case 'construir':
                    $ficha = $this->construir($ficha, $d, $mestre, $dia, $acesso->jogador->nome);
                    break;
                case 'remover':
                    $ficha = $this->remover($ficha, $d, $dia, $acesso->jogador->nome);
                    break;
                case 'concluir':
                    $soMestre();
                    $ficha['navio'] = $this->concluirObras($ficha['navio'], PHP_INT_MAX, (string) ($d['grupo'] ?? ''), $d['uid'] ?? null);
                    break;
                case 'depositar':
                case 'sacar':
                    [$ficha, $outro] = $this->moverBelly($mesa, $acesso, $ficha, $d, $acao === 'depositar', $dia);
                    break;
                case 'guardar':
                case 'retirar':
                    [$ficha, $outro] = $this->moverItem($mesa, $acesso, $ficha, $d, $acao === 'guardar', $dia);
                    break;
                case 'tripulacao':
                    $ficha['navio']['tripulacao'] = $this->tripulacao($mesa, $d['lista'] ?? null);
                    $ficha['navio']['oficios'] = $this->oficios($mesa, $ficha['navio']['tripulacao']);
                    break;
                case 'pv':
                    $soMestre();
                    $ficha = $this->pv($ficha, $d, $dia);
                    break;
                case 'config':
                    $soMestre();
                    $ficha = $this->config($ficha, $d);
                    break;
                case 'bateria':
                    $n = (int) ($d['gastar'] ?? 0);
                    if ($n < 1 || $n > (int) $ficha['navio']['baterias']) {
                        throw ValidationException::withMessages(['gastar' => 'O navio não tem essas baterias carregadas.']);
                    }
                    $ficha['navio']['baterias'] -= $n;
                    break;
                case 'consertar':
                    $ficha = $this->consertar($ficha, $d, $mestre, $dia, $acesso->jogador->nome);
                    break;
                case 'pagar':
                    $ficha = $this->cobrar($ficha, $dia, 'Manutenção paga');
                    if (! $ficha['navio']['manutencao']['em_dia']) {
                        throw ValidationException::withMessages(['pagar' => 'O tesouro não cobre as despesas da semana.']);
                    }
                    break;
                default:
                    throw ValidationException::withMessages(['acao' => 'Ação desconhecida.']);
            }
            $p->ficha = $ficha;
            $p->save();

            return ['navio' => $p, 'outro' => $outro];
        });
    }

    /**
     * O calendário avançou: obras e consertos que venceram ficam prontos, as despesas semanais são cobradas, o Klabautermann
     * repara e o gerador recarrega. Voltar o dia não desfaz nada. Chamado com a Mesa já travada.
     *
     * @return list<Personagem> navios alterados
     */
    public function aoAvancarTempo(Mesa $mesa, int $antigo, int $novo): array
    {
        if ($novo <= $antigo) {
            return [];
        }
        $alterados = [];
        $navios = Personagem::query()->where('mesa_id', $mesa->id)->navios()->lockForUpdate()->get();
        foreach ($navios as $p) {
            $ficha = $p->ficha;
            if (! is_array($ficha['navio'] ?? null)) {
                continue;
            }
            $antes = $ficha;
            $ficha['navio'] = [...Navios::padrao(), ...$ficha['navio']];
            $ficha['navio']['oficios'] = $this->oficios($mesa, $ficha['navio']['tripulacao']);
            $ficha['navio'] = $this->concluirObras($ficha['navio'], $novo);
            $pvMax = Navios::tamanho($ficha['navio']['tamanho'])['pv'];
            if (($ficha['navio']['conserto']['pronto_dia'] ?? PHP_INT_MAX) <= $novo) {
                $ficha['pv']['atual'] = $pvMax;
                $ficha['navio']['conserto'] = null;
                $ficha = $this->registrar($ficha, $novo, 'Conserto concluído: PV restaurados', 0);
            }
            // despesas semanais: uma cobrança por semana vencida (com teto, para um salto enorme de dias não travar a mesa)
            $semana = Navios::dados()['diasDaManutencao'];
            for ($i = 0; $i < 520 && $novo >= (int) $ficha['navio']['manutencao']['proxima_dia']; $i++) {
                $ficha = $this->cobrar($ficha, (int) $ficha['navio']['manutencao']['proxima_dia'], 'Despesas semanais dos cômodos');
                $ficha['navio']['manutencao']['proxima_dia'] += $semana;
            }
            $calculo = Navios::calcular($ficha['navio'], (int) ($ficha['pv']['atual'] ?? 0));
            if ($calculo['autoReparo'] > 0 && (int) $ficha['pv']['atual'] < $pvMax) {
                $ficha['pv']['atual'] = min($pvMax, (int) $ficha['pv']['atual'] + $calculo['autoReparo'] * ($novo - $antigo));
            }
            $ficha['navio']['baterias'] = $calculo['bateriasMax'];
            if ($ficha != $antes) {
                $p->ficha = $ficha;
                $p->save();
                $alterados[] = $p;
            }
        }

        return $alterados;
    }

    /** Os campos da ficha que as ações do navio mexem (para o evento `ficha`). @return array<string, mixed> */
    public static function campos(Personagem $p): array
    {
        return ['navio' => $p->ficha['navio'] ?? null, 'pv' => $p->ficha['pv'] ?? null, 'belly' => (int) ($p->ficha['belly'] ?? 0), 'inventario' => $p->ficha['inventario'] ?? []];
    }

    private function dia(Mesa $mesa): int
    {
        return max(1, (int) ($mesa->tempo['dia'] ?? 1));
    }

    /** Quem da tripulação tem as profissões que mexem no navio. @return array{carpinteiro: bool, timoneiro: bool, timoneiroNaNavegacao: bool} */
    private function oficios(Mesa $mesa, array $tripulacao): array
    {
        $r = ['carpinteiro' => false, 'timoneiro' => false, 'timoneiroNaNavegacao' => false];
        $ids = array_values(array_filter(array_map(fn ($t) => $t['personagem_id'] ?? null, $tripulacao)));
        if (! $ids) {
            return $r;
        }
        $fichas = Personagem::query()->where('mesa_id', $mesa->id)->whereIn('id', $ids)->pluck('ficha', 'id');
        foreach ($tripulacao as $t) {
            $profissoes = array_column($fichas[$t['personagem_id'] ?? 0]['profissoes']['lista'] ?? [], 'id');
            $r['carpinteiro'] = $r['carpinteiro'] || in_array('carpinteiro', $profissoes, true);
            if (in_array('timoneiro', $profissoes, true)) {
                $r['timoneiro'] = true;
                $r['timoneiroNaNavegacao'] = $r['timoneiroNaNavegacao'] || in_array('navegacao', $t['funcoes'] ?? [], true);
            }
        }

        return $r;
    }

    private function registrar(array $ficha, int $dia, string $texto, int $valor): array
    {
        $ficha['navio']['registro'] = array_slice([['dia' => $dia, 'texto' => mb_substr($texto, 0, 160), 'valor' => $valor], ...($ficha['navio']['registro'] ?? [])], 0, self::MAX_REGISTRO);

        return $ficha;
    }

    private function debitar(array $ficha, int $custo): array
    {
        $saldo = (int) ($ficha['belly'] ?? 0);
        if ($custo > $saldo) {
            throw ValidationException::withMessages(['custo' => 'O tesouro do navio não cobre este custo (฿ '.number_format($custo, 0, ',', '.').').']);
        }
        $ficha['belly'] = $saldo - $custo;

        return $ficha;
    }

    private function construir(array $ficha, array $d, bool $mestre, int $dia, string $quem): array
    {
        $grupo = (string) ($d['grupo'] ?? '');
        $tipo = (string) ($d['tipo'] ?? '');
        $modo = ($d['modo'] ?? 'construir') === 'comprar' ? 'comprar' : 'construir';
        if (! in_array($grupo, [...Navios::GRUPOS_UNICOS, ...Navios::GRUPOS_DE_LISTA], true)) {
            throw ValidationException::withMessages(['grupo' => 'Parte do navio desconhecida.']);
        }
        $obra = Navios::custoDaObra($ficha['navio'], $grupo, $tipo, $modo);
        if (! $obra) {
            throw ValidationException::withMessages(['tipo' => 'Esta peça não existe ou não está à venda (só construindo).']);
        }
        $problema = Navios::problemaDaObra($ficha['navio'], $grupo, $tipo);
        // o mestre pode passar por cima dos limites do livro (navios da Marinha têm mais canhões do que o tamanho comporta)
        if ($problema && ! ($mestre && ! empty($d['ignorar_limites']))) {
            throw ValidationException::withMessages(['tipo' => $problema]);
        }
        // só o mestre troca o valor e o prazo (peça ganha, desconto combinado, obra instantânea)
        $custo = $mestre && isset($d['valor']) ? max(0, min(self::MAX_BELLY, (int) $d['valor'])) : $obra['custo'];
        $dias = $mestre && isset($d['dias']) ? max(0, min(999, (int) $d['dias'])) : $obra['dias'];
        $ficha = $this->debitar($ficha, $custo);
        $pronto = $dias > 0 ? $dia + $dias : null;
        if (in_array($grupo, Navios::GRUPOS_UNICOS, true)) {
            $ficha['navio'][$grupo] = ['tipo' => $tipo, 'pronto_dia' => $pronto, 'antes' => $pronto === null ? null : Navios::tipoEfetivo($ficha['navio'][$grupo] ?? null)];
        } else {
            $ficha['navio'][$grupo][] = ['uid' => Navios::uid(), 'tipo' => $tipo, 'pronto_dia' => $pronto];
        }
        $nome = Navios::nomeDaPeca($grupo, $tipo);

        return $this->registrar($ficha, $dia, "{$quem}: ".($modo === 'comprar' ? 'comprou' : 'construiu')." {$nome}".($pronto ? " (pronto no dia {$pronto})" : ''), -$custo);
    }

    private function remover(array $ficha, array $d, int $dia, string $quem): array
    {
        $grupo = (string) ($d['grupo'] ?? '');
        if (in_array($grupo, ['fortificacao', 'kairoseki'], true)) {
            $parte = $ficha['navio'][$grupo];
            $tipo = (string) ($parte['tipo'] ?? '');
            // em obra: cancela e volta ao que valia; pronta: tira
            $ficha['navio'][$grupo] = ['tipo' => ($parte['pronto_dia'] ?? null) !== null ? ($parte['antes'] ?? null) : null, 'pronto_dia' => null];

            return $tipo === '' ? $ficha : $this->registrar($ficha, $dia, "{$quem}: removeu ".Navios::nomeDaPeca($grupo, $tipo), 0);
        }
        if (in_array($grupo, ['madeira', 'ancora', 'leme'], true)) {
            $parte = $ficha['navio'][$grupo];
            if (($parte['pronto_dia'] ?? null) === null) {
                throw ValidationException::withMessages(['grupo' => 'Esta parte não pode ser removida, só trocada.']);
            }
            $ficha['navio'][$grupo] = ['tipo' => $parte['antes'] ?? null, 'pronto_dia' => null];

            return $this->registrar($ficha, $dia, "{$quem}: cancelou a obra de ".Navios::nomeDaPeca($grupo, (string) $parte['tipo']), 0);
        }
        if (! in_array($grupo, Navios::GRUPOS_DE_LISTA, true)) {
            throw ValidationException::withMessages(['grupo' => 'Parte do navio desconhecida.']);
        }
        $uid = (string) ($d['uid'] ?? '');
        $achada = null;
        foreach ($ficha['navio'][$grupo] as $peca) {
            if (($peca['uid'] ?? null) === $uid) {
                $achada = $peca;
            }
        }
        if (! $achada) {
            throw ValidationException::withMessages(['uid' => 'Esta peça não está mais no navio.']);
        }
        $ficha['navio'][$grupo] = array_values(array_filter($ficha['navio'][$grupo], fn ($x) => ($x['uid'] ?? null) !== $uid));

        return $this->registrar($ficha, $dia, "{$quem}: removeu ".Navios::nomeDaPeca($grupo, (string) $achada['tipo']), 0);
    }

    /** Deixa prontas as obras vencidas até `$dia` (ou só a peça pedida, quando o mestre conclui na hora). */
    private function concluirObras(array $navio, int $dia, string $grupo = '', mixed $uid = null): array
    {
        foreach (Navios::GRUPOS_UNICOS as $g) {
            $venceu = ($navio[$g]['pronto_dia'] ?? null) !== null && $navio[$g]['pronto_dia'] <= $dia;
            if ($venceu && ($grupo === '' || $grupo === $g)) {
                $navio[$g] = ['tipo' => $navio[$g]['tipo'] ?? null, 'pronto_dia' => null];
            }
        }
        foreach (Navios::GRUPOS_DE_LISTA as $g) {
            foreach ($navio[$g] ?? [] as $i => $peca) {
                $venceu = ($peca['pronto_dia'] ?? null) !== null && $peca['pronto_dia'] <= $dia;
                if ($venceu && ($grupo === '' || ($grupo === $g && ($uid === null || $uid === ($peca['uid'] ?? null))))) {
                    $navio[$g][$i]['pronto_dia'] = null;
                }
            }
        }

        return $navio;
    }

    /** O personagem do outro lado de um depósito, saque ou carga: precisa ser de quem pede e não pode ser outro navio. */
    private function personagemDe(Mesa $mesa, AcessoMesa $acesso, array $d): Personagem
    {
        $id = (int) ($d['personagem_id'] ?? 0);
        abort_unless($acesso->podeControlar($id), 403, 'Escolha um personagem seu.');
        $p = Personagem::query()->where('mesa_id', $mesa->id)->whereKey($id)->lockForUpdate()->firstOrFail();
        if (is_array($p->ficha['navio'] ?? null)) {
            throw ValidationException::withMessages(['personagem_id' => 'Escolha um personagem, não um navio.']);
        }

        return $p;
    }

    /** @return array{0: array<string, mixed>, 1: Personagem} */
    private function moverBelly(Mesa $mesa, AcessoMesa $acesso, array $ficha, array $d, bool $depositar, int $dia): array
    {
        $qtd = (int) ($d['qtd'] ?? 0);
        if ($qtd < 1 || $qtd > self::MAX_BELLY) {
            throw ValidationException::withMessages(['qtd' => 'Quantia inválida.']);
        }
        $p = $this->personagemDe($mesa, $acesso, $d);
        $dele = $p->ficha ?? FichaOnePiece::padrao();
        $origem = $depositar ? (int) ($dele['belly'] ?? 0) : (int) ($ficha['belly'] ?? 0);
        if ($qtd > $origem) {
            throw ValidationException::withMessages(['qtd' => $depositar ? "{$p->nome} não tem tudo isso." : 'O tesouro do navio não tem tudo isso.']);
        }
        $sinal = $depositar ? 1 : -1;
        $ficha['belly'] = min(self::MAX_BELLY, (int) ($ficha['belly'] ?? 0) + $sinal * $qtd);
        $dele['belly'] = min(self::MAX_BELLY, (int) ($dele['belly'] ?? 0) - $sinal * $qtd);
        $p->ficha = $dele;
        $p->save();

        return [$this->registrar($ficha, $dia, "{$p->nome}: ".($depositar ? 'depositou no tesouro' : 'sacou do tesouro'), $sinal * $qtd), $p];
    }

    /** @return array{0: array<string, mixed>, 1: Personagem} */
    private function moverItem(Mesa $mesa, AcessoMesa $acesso, array $ficha, array $d, bool $guardar, int $dia): array
    {
        $itemId = (int) ($d['item_id'] ?? 0);
        $qtd = (int) ($d['qtd'] ?? 0);
        $p = $this->personagemDe($mesa, $acesso, $d);
        $item = $mesa->itens()->whereKey($itemId)->first();
        if (! $item || $qtd < 1) {
            throw ValidationException::withMessages(['item_id' => 'Item ou quantidade inválidos.']);
        }
        $dele = $p->ficha ?? FichaOnePiece::padrao();
        if ($guardar) {
            [$dele, $ref] = $this->tirar($dele, $itemId, $qtd, "{$p->nome} não tem tudo isso.");
            $ficha = $this->por($ficha, $ref, $qtd, 'Carga');
        } else {
            [$ficha, $ref] = $this->tirar($ficha, $itemId, $qtd, 'A carga do navio não tem tudo isso.');
            $dele = $this->por($dele, $ref, $qtd, 'Equipamento');
        }
        $p->ficha = $dele;
        $p->save();

        return [$this->registrar($ficha, $dia, "{$p->nome}: ".($guardar ? 'guardou' : 'retirou')." {$qtd}× {$item->nome}", 0), $p];
    }

    /**
     * Tira `$qtd` do item do inventário (some com a linha ao zerar). Devolve a ficha e a linha original, para o destino manter
     * os ajustes da arma.
     *
     * @return array{0: array<string, mixed>, 1: array<string, mixed>}
     */
    private function tirar(array $ficha, int $itemId, int $qtd, string $falta): array
    {
        foreach ($ficha['inventario'] ?? [] as $s => $secao) {
            foreach ($secao['itens'] ?? [] as $i => $ref) {
                if ((int) ($ref['item_id'] ?? 0) !== $itemId) {
                    continue;
                }
                if ($qtd > (int) $ref['qtd']) {
                    break 2;
                }
                if ($qtd === (int) $ref['qtd']) {
                    array_splice($ficha['inventario'][$s]['itens'], $i, 1);
                } else {
                    $ficha['inventario'][$s]['itens'][$i]['qtd'] = (int) $ref['qtd'] - $qtd;
                }

                return [$ficha, $ref];
            }
        }
        throw ValidationException::withMessages(['qtd' => $falta]);
    }

    /** Põe `$qtd` do item no inventário: soma à pilha que já existe ou cria a linha na seção dada (ou na primeira). */
    private function por(array $ficha, array $ref, int $qtd, string $secaoPadrao): array
    {
        $itemId = (int) $ref['item_id'];
        foreach ($ficha['inventario'] ?? [] as $s => $secao) {
            foreach ($secao['itens'] ?? [] as $i => $atual) {
                if ((int) ($atual['item_id'] ?? 0) === $itemId) {
                    $ficha['inventario'][$s]['itens'][$i]['qtd'] = min(100000, (int) $atual['qtd'] + $qtd);

                    return $ficha;
                }
            }
        }
        $nova = [...$ref, 'qtd' => $qtd, 'equipado' => false, 'sintonizado' => false];
        $inventario = $ficha['inventario'] ?? [];
        $destino = null;
        foreach ($inventario as $s => $secao) {
            if (($secao['secao'] ?? '') === $secaoPadrao) {
                $destino = $s;
                break;
            }
        }
        $destino ??= $inventario ? array_key_first($inventario) : null;
        if ($destino === null) {
            $inventario[] = ['secao' => $secaoPadrao, 'itens' => [$nova]];
        } else {
            $inventario[$destino]['itens'][] = $nova;
        }
        $ficha['inventario'] = $inventario;

        return $ficha;
    }

    /** Valida e normaliza a lista de tripulantes. @return list<array<string, mixed>> */
    private function tripulacao(Mesa $mesa, mixed $lista): array
    {
        if (! is_array($lista) || count($lista) > 200) {
            throw ValidationException::withMessages(['lista' => 'Lista de tripulantes inválida.']);
        }
        $limpa = [];
        foreach ($lista as $t) {
            if (! is_array($t)) {
                throw ValidationException::withMessages(['lista' => 'Lista de tripulantes inválida.']);
            }
            $limpa[] = [
                'uid' => is_string($t['uid'] ?? null) && $t['uid'] !== '' ? mb_substr($t['uid'], 0, 20) : Navios::uid(),
                'nome' => mb_substr(trim((string) ($t['nome'] ?? '')), 0, 60),
                'personagem_id' => isset($t['personagem_id']) ? (int) $t['personagem_id'] : null,
                'qtd' => is_int($t['qtd'] ?? null) ? $t['qtd'] : 0,
                'funcoes' => array_values((array) ($t['funcoes'] ?? [])),
            ];
        }
        $problema = Navios::problemaDaTripulacao($limpa);
        if ($problema) {
            throw ValidationException::withMessages(['lista' => $problema]);
        }
        $ids = array_values(array_filter(array_column($limpa, 'personagem_id')));
        if (count($ids) !== count(array_unique($ids))) {
            throw ValidationException::withMessages(['lista' => 'O mesmo personagem aparece duas vezes na tripulação.']);
        }
        $validos = Personagem::query()->where('mesa_id', $mesa->id)->whereIn('id', $ids)->navios(false)->count();
        if ($validos !== count($ids)) {
            throw ValidationException::withMessages(['lista' => 'Algum tripulante aponta para um personagem que não existe nesta mesa.']);
        }

        return $limpa;
    }

    private function pv(array $ficha, array $d, int $dia): array
    {
        $max = Navios::tamanho($ficha['navio']['tamanho'])['pv'];
        $atual = (int) ($ficha['pv']['atual'] ?? 0);
        $temp = (int) ($ficha['pv']['temp'] ?? 0);
        if (isset($d['dano'])) {
            $bruto = max(0, min(1_000_000, (int) $d['dano']));
            $final = ($d['aplicar_br'] ?? true) ? Navios::dano($ficha['navio'], $bruto) : $bruto;
            // os PV paralelos (Reparo Emergencial) são consumidos antes dos PV do navio
            $noTemp = min($temp, $final);
            $temp -= $noTemp;
            $atual = max(0, $atual - ($final - $noTemp));
            $ficha = $this->registrar($ficha, $dia, "Dano: {$bruto}".($final !== $bruto ? " (−BR = {$final})" : ''), 0);
        } elseif (isset($d['reparo'])) {
            $atual = min($max, $atual + max(0, (int) $d['reparo']));
        } else {
            if (isset($d['atual'])) {
                $atual = max(0, min($max, (int) $d['atual']));
            }
            if (isset($d['temp'])) {
                $temp = max(0, min(100000, (int) $d['temp']));
            }
        }
        $ficha['pv'] = [...($ficha['pv'] ?? []), 'atual' => $atual, 'max' => $max, 'temp' => $temp];

        return $ficha;
    }

    private function config(array $ficha, array $d): array
    {
        foreach (['klabautermann', 'feito_por_carpinteiro'] as $campo) {
            if (array_key_exists($campo, $d)) {
                $ficha['navio'][$campo] = (bool) $d[$campo];
            }
        }
        if (array_key_exists('lotacao', $d)) {
            $ficha['navio']['lotacao'] = $d['lotacao'] === null ? null : max(1, min(100000, (int) $d['lotacao']));
        }
        if (array_key_exists('baterias', $d)) {
            $ficha['navio']['baterias'] = max(0, min(Navios::dados()['bateriasDoGerador'], (int) $d['baterias']));
        }
        if (array_key_exists('proxima_dia', $d)) {
            $ficha['navio']['manutencao']['proxima_dia'] = max(1, min(99999, (int) $d['proxima_dia']));
        }
        if (array_key_exists('em_dia', $d)) {
            $ficha['navio']['manutencao']['em_dia'] = (bool) $d['em_dia'];
        }
        if (array_key_exists('belly', $d)) {
            $ficha['belly'] = max(0, min(self::MAX_BELLY, (int) $d['belly']));
        }

        return $ficha;
    }

    private function consertar(array $ficha, array $d, bool $mestre, int $dia, string $quem): array
    {
        $modo = ($d['modo'] ?? '') === 'carpinteiro' ? 'carpinteiro' : 'estaleiro';
        $c = Navios::conserto($ficha['navio'], (int) ($ficha['pv']['atual'] ?? 0), $modo);
        if ($c['motivo']) {
            throw ValidationException::withMessages(['modo' => $c['motivo']]);
        }
        if ($modo === 'carpinteiro') {
            // o custo é o da tabela; os dias, o carpinteiro rola (1d6, 2d6, 4d6) e informa
            $custo = $c['custo'];
            $dias = (int) ($d['dias'] ?? 0);
            if ($dias < 1 || $dias > $c['dias']) {
                throw ValidationException::withMessages(['dias' => "Informe os dias rolados ({$c['dado']}): de 1 a {$c['dias']}."]);
            }
        } else {
            // estaleiro: o valor é combinado na mesa, até o teto da tabela; os dias são fixos
            $custo = (int) ($d['valor'] ?? -1);
            if ($custo < 0 || (! $mestre && $custo > $c['custo'])) {
                throw ValidationException::withMessages(['valor' => 'O conserto custa até ฿ '.number_format($c['custo'], 0, ',', '.').' nesta condição.']);
            }
            $dias = $c['dias'];
        }
        if ($mestre && isset($d['valor'])) {
            $custo = max(0, min(self::MAX_BELLY, (int) $d['valor']));
        }
        $ficha = $this->debitar($ficha, $custo);
        $ficha['navio']['conserto'] = ['pronto_dia' => $dia + $dias];

        return $this->registrar($ficha, $dia, "{$quem}: conserto ".($modo === 'carpinteiro' ? 'pelo carpinteiro' : 'em estaleiro').' (pronto no dia '.($dia + $dias).')', -$custo);
    }

    /** Cobra as despesas semanais dos cômodos prontos; sem dinheiro, nada é debitado e os cômodos ficam sem benefício. */
    private function cobrar(array $ficha, int $dia, string $texto): array
    {
        $despesa = Navios::calcular($ficha['navio'], (int) ($ficha['pv']['atual'] ?? 0))['despesa'];
        if ($despesa <= 0) {
            $ficha['navio']['manutencao']['em_dia'] = true;

            return $ficha;
        }
        if ($despesa > (int) ($ficha['belly'] ?? 0)) {
            $ficha['navio']['manutencao']['em_dia'] = false;

            return $this->registrar($ficha, $dia, 'Sem dinheiro para as despesas: os cômodos ficam sem benefício', 0);
        }
        $ficha['belly'] = (int) $ficha['belly'] - $despesa;
        $ficha['navio']['manutencao']['em_dia'] = true;

        return $this->registrar($ficha, $dia, $texto, -$despesa);
    }
}
