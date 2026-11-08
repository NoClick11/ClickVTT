<?php

namespace App\Sistemas\OnePiece;

use App\Nucleo\Combate\SistemaDeCombate;
use App\Nucleo\Efeitos\Formula;
use App\Nucleo\Rolagem\Rolador;
use App\Nucleo\Sistemas\Sistema;
use App\Nucleo\Sistemas\SistemaComLoja;

/** Módulo de One Piece: parte das regras do D&D 5e, com atributos, perícias, técnicas e pontos de poder próprios. */
class OnePiece implements Sistema, SistemaComLoja, SistemaDeCombate
{
    public function catalogoDeLoja(): array
    {
        $c = Itens::catalogo();

        return ['categorias' => $c['categorias'], 'raridades' => array_column($c['raridades'], 'id'), 'itens' => $c['itens']];
    }

    public function moedaDaLoja(): array
    {
        return ['campo' => 'belly', 'simbolo' => '฿'];
    }

    public function itemDaLoja(array $entrada): array
    {
        return Itens::paraAMesa($entrada);
    }

    /** Ao concluir a criação: o inventário inicial (profissão e estilo) e os Bellys entram na ficha (ver `ItensIniciais`). @param array<string, mixed> $ficha */
    public function entregarItensIniciais(\App\Models\Mesa $mesa, array $ficha, ?array $criacao = null): array
    {
        return ItensIniciais::entregar($mesa, $this, $ficha, $criacao);
    }

    public function entregarNoInventario(array $ficha, int $itemId, int $qtd): array
    {
        foreach ($ficha['inventario'] ?? [] as $s => $secao) {
            foreach ($secao['itens'] ?? [] as $i => $ref) {
                if ((int) ($ref['item_id'] ?? 0) === $itemId) {
                    $ficha['inventario'][$s]['itens'][$i]['qtd'] = min(100000, (int) $ref['qtd'] + $qtd);

                    return $ficha;
                }
            }
        }
        $nova = ['item_id' => $itemId, 'qtd' => $qtd, 'equipado' => false, 'sintonizado' => false];
        $inventario = $ficha['inventario'] ?? [];
        $destino = null;
        foreach ($inventario as $s => $secao) {
            if (($secao['secao'] ?? '') === 'Equipamento') {
                $destino = $s;
                break;
            }
        }
        $destino ??= $inventario ? array_key_first($inventario) : null;
        if ($destino === null) {
            $inventario[] = ['secao' => 'Equipamento', 'itens' => [$nova]];
        } else {
            $inventario[$destino]['itens'][] = $nova;
        }
        $ficha['inventario'] = $inventario;

        return $ficha;
    }

    public static function slug(): string
    {
        return 'one-piece';
    }

    public function fichaPadrao(): array
    {
        return FichaOnePiece::padrao();
    }

    public function regrasFicha(): array
    {
        return FichaOnePiece::regras();
    }

    public function variaveisDeRolagem(array $ficha, array $itens = []): array
    {
        return Regras::calcular($ficha, $itens);
    }

    public function metadadosDaRolagem(array $termos, array $variaveis, array $itens = [], array $ficha = [], array $contexto = []): array
    {
        return Regras::metadadosDaRolagem($termos, $variaveis, $itens, $ficha, $contexto['municao'] ?? null, (int) ($contexto['rodada'] ?? 1));
    }

    public function itensReferenciados(array $ficha): array
    {
        $ids = [];
        foreach ($ficha['inventario'] ?? [] as $secao) {
            foreach ($secao['itens'] ?? [] as $ref) {
                if (isset($ref['item_id'])) {
                    $ids[(int) $ref['item_id']] = true;
                }
            }
        }

        return array_keys($ids);
    }

    public function semItem(array $ficha, int $itemId): array
    {
        foreach ($ficha['inventario'] ?? [] as $s => $secao) {
            $ficha['inventario'][$s]['itens'] = array_values(array_filter($secao['itens'] ?? [], fn ($ref) => (int) ($ref['item_id'] ?? 0) !== $itemId));
        }

        return $ficha;
    }

    /**
     * Ação padrão, poderosa, bônus e livre: só rótulos/contadores informativos, sem travas (a mesa gere as ações). A REAÇÃO é a exceção: 1 por
     * rodada (anotada no combate; volta na rodada nova), para o jogo não oferecer reação a quem já reagiu. A outra trava real é mover o token fora do turno.
     */
    public function categoriasDeAcao(): array
    {
        return [
            ['id' => 'padrao', 'nome' => 'Ação', 'porTurno' => null, 'porRodada' => null, 'soNoTurno' => false],
            ['id' => 'poderosa', 'nome' => 'Ação poderosa', 'porTurno' => null, 'porRodada' => null, 'soNoTurno' => false],
            ['id' => 'bonus', 'nome' => 'Ação bônus', 'porTurno' => null, 'porRodada' => null, 'soNoTurno' => false],
            ['id' => 'livre', 'nome' => 'Ação livre', 'porTurno' => null, 'porRodada' => null, 'soNoTurno' => false],
            ['id' => 'reacao', 'nome' => 'Reação', 'porTurno' => null, 'porRodada' => 1, 'soNoTurno' => false],
        ];
    }

    public function iniciativa(array $ficha): string
    {
        return '1d20+@iniciativa';
    }

    public function deslocamentoDoTurno(array $ficha, array $variaveis): float
    {
        return ((float) ($variaveis['movimento.normal'] ?? ($ficha['movimento']['normal'] ?? 9) * 10)) / 10;
    }

    /**
     * Reações vêm da ficha: técnicas (e da Akuma) e características com `reacao: {gatilho, alcance, defesa?, cura?}`. Técnica
     * custa PP (sem PP não é oferecida); característica com usos gasta um.
     */
    public function ofertasDeReacao(string $gatilho, array $contexto, array $ficha, array $variaveis): array
    {
        $ofertas = [];
        $nivel = (int) ($ficha['nivel'] ?? 1);
        $monta = function (string $id, array $dados, array $custo) use ($gatilho, &$ofertas, $variaveis) {
            $r = $dados['reacao'] ?? null;
            if (! is_array($r) || ($r['gatilho'] ?? null) !== $gatilho) {
                return;
            }
            $ofertas[] = [
                // `categoria`: a reação gasta a categoria `reacao` (a do turno); algumas (Aparar Aprimorado) gastam outra, como `livre`
                'id' => $id, 'rotulo' => $dados['nome'] ?? 'Reação', 'descricao' => $dados['descricao'] ?? '', 'categoria' => $r['categoria'] ?? 'reacao',
                'alcance' => $r['alcance'] ?? 'si', 'cura' => $r['cura'] ?? null, 'custo' => $custo, 'reducao' => $r['reducao'] ?? null, 'pvTemporarios' => $r['pvTemporarios'] ?? null,
                // `defesa` é um número ou uma fórmula da ficha de quem reage (ex.: `@prof-floor(@prof/2)`)
                'efeitos' => isset($r['defesa']) ? [['alvo' => 'defesa', 'modo' => 'soma', 'valor' => is_numeric($r['defesa']) ? (int) $r['defesa'] : (int) Formula::avaliar((string) $r['defesa'], $variaveis)]] : [],
            ];
        };
        foreach (['t' => $ficha['tecnicas']['lista'] ?? [], 'a' => $ficha['akuma']['lista'] ?? []] as $tipo => $lista) {
            foreach ($lista as $i => $t) {
                if ((int) ($t['custo'] ?? 0) <= (int) ($ficha['pp']['atual'] ?? 0)) {
                    $monta("{$tipo}:{$i}", $t, ['pp' => (int) ($t['custo'] ?? 0)]);
                    // Yamantaka: com a reserva já armada, 1 PP soma mais dados a ela (até o máximo)
                    $mais = $t['reacao']['reducao'] ?? null;
                    if (is_array($mais) && isset($mais['mais']) && (int) ($ficha['reducao']['reserva'] ?? 0) > 0
                        && (int) ($ficha['reducao']['dados'] ?? 0) < (int) ($mais['maximo'] ?? 0) && (int) ($ficha['pp']['atual'] ?? 0) >= 1) {
                        $ofertas[] = [
                            'id' => "{$tipo}:{$i}:mais", 'rotulo' => ($t['nome'] ?? 'Reação').': +'.$mais['mais'], 'descricao' => 'Gaste 1 PP para somar '.$mais['mais'].' à reserva de redução de dano.',
                            'categoria' => 'livre', 'alcance' => 'si', 'cura' => null, 'custo' => ['pp' => 1], 'efeitos' => [], 'reducao' => ['mais' => $mais['mais'], 'maximo' => (int) ($mais['maximo'] ?? 0)],
                        ];
                    }
                }
            }
        }
        foreach ($ficha['caracteristicas'] ?? [] as $i => $c) {
            if (! Regras::ativaNoNivel($c, $nivel) || Regras::hakiDesligado($c, $ficha)) {
                continue;
            }
            $red = $c['reacao']['reducao'] ?? null;
            // Virada Heroica: só com menos da metade dos PV máximos
            if (is_array($red) && ! empty($red['pvAbaixoDaMetade'])) {
                $pvMax = (int) ($variaveis['pv.max'] ?? ($ficha['pv']['max'] ?? 0));
                if (! ($pvMax > 0 && (int) ($ficha['pv']['atual'] ?? 0) * 2 < $pvMax)) {
                    continue;
                }
            }
            // Gasta usos de outra característica (os Dados Heroicos): só se ela tem o bastante
            if (is_array($red) && isset($red['gasta'])) {
                if ($this->indiceDaCaracteristica($ficha, (string) $red['gasta']['de'], (int) $red['gasta']['qtd']) === null) {
                    continue;
                }
                $monta("c:{$i}", $c, ['dados' => (int) $red['gasta']['qtd']]);

                continue;
            }
            if (! isset($c['usos']) || (int) $c['usos']['atual'] > 0) {
                // Corpo de Criatura (`reducao.zerar`): o uso só é gasto quando o dano é de fato zerado (`absorverDano`)
                $monta("c:{$i}", $c, isset($c['usos']) && ! ($c['reacao']['reducao']['zerar'] ?? false) ? ['uso' => 1] : []);
            }
        }

        return $ofertas;
    }

    public function pagarReacao(array $ficha, array $oferta): array
    {
        [$tipo, $i] = explode(':', (string) $oferta['id']);
        // Reserva que gasta Dados Heroicos (Escudo do Deus da Arma): paga ao armar. No `zerar` (Virada Heroica) paga ao zerar o dano.
        $gasta = $oferta['reducao']['gasta'] ?? null;
        if ($tipo === 'c' && is_array($gasta) && empty($oferta['reducao']['zerar'])) {
            $lista = $ficha['caracteristicas'] ?? [];
            $k = $this->indiceDaCaracteristica($ficha, (string) $gasta['de'], (int) $gasta['qtd']);
            if ($k !== null) {
                $lista[$k]['usos']['atual'] = max(0, (int) $lista[$k]['usos']['atual'] - (int) $gasta['qtd']);
            }

            return ['caracteristicas' => $lista, ...$this->armarReducao($ficha, $oferta['reducao'] ?? null)];
        }
        if ($tipo === 'c') {
            $lista = $ficha['caracteristicas'] ?? [];
            if (isset($lista[(int) $i]['usos']) && ! empty($oferta['custo']['uso'])) {
                $lista[(int) $i]['usos']['atual'] = max(0, (int) $lista[(int) $i]['usos']['atual'] - 1);
                $campos = ['caracteristicas' => $lista];
            } else {
                $campos = [];
            }
        } else {
            $campos = ($oferta['custo']['pp'] ?? 0) > 0 ? ['pp.atual' => max(0, (int) ($ficha['pp']['atual'] ?? 0) - (int) $oferta['custo']['pp'])] : [];
        }

        return [...$campos, ...$this->armarReducao($ficha, $oferta['reducao'] ?? null), ...$this->darPvTemporarios($ficha, $oferta['pvTemporarios'] ?? null)];
    }

    /**
     * Reação que dá PV temporários (Costura Interna de Emergência): rola os dados, fica com o maior entre o que já tinha e o novo, anota o valor para o
     * início do próximo turno do dono tirá-lo e encerra o Sangramento, se houver.
     *
     * @return array<string, mixed>
     */
    private function darPvTemporarios(array $ficha, ?string $dados): array
    {
        if (! $dados) {
            return [];
        }
        $total = (int) app(Rolador::class)->rolar($dados)['total'];
        $campos = ['pv.temp' => max((int) ($ficha['pv']['temp'] ?? 0), $total), 'reducao.pvTemp' => $total];
        if (in_array('sangramento', $ficha['condicoes'] ?? [], true)) {
            $campos['condicoes'] = array_values(array_diff($ficha['condicoes'], ['sangramento']));
            $campos['duracoes'] = array_diff_key($ficha['duracoes'] ?? [], ['sangramento' => 1]);
        }

        return $campos;
    }

    /** O índice da característica (pelo nome) que ainda tem `$qtd` usos, ou null. */
    private function indiceDaCaracteristica(array $ficha, string $nome, int $qtd): ?int
    {
        foreach ($ficha['caracteristicas'] ?? [] as $k => $c) {
            if (($c['nome'] ?? '') === $nome && (int) ($c['usos']['atual'] ?? 0) >= $qtd) {
                return $k;
            }
        }

        return null;
    }

    /**
     * Reações defensivas: arma a redução do dano que o personagem sofrer depois. `reserva` (Yamantaka) rola os dados da reserva; `mais` soma dados a ela
     * (até `maximo` dados); `zerar` (Corpo de Criatura) zera o próximo dano. `turnos`: quantos fins de turno do dono ela dura (o núcleo informa).
     *
     * @return array<string, mixed>
     */
    private function armarReducao(array $ficha, ?array $reducao): array
    {
        if (! $reducao) {
            return [];
        }
        $turnos = (int) ($reducao['turnos'] ?? 1);
        $atual = $ficha['reducao'] ?? [];
        $rolar = fn (string $d): array => [(int) app(Rolador::class)->rolar($d)['total'], (int) explode('d', $d)[0]];
        if (isset($reducao['reserva'])) {
            [$total, $dados] = $rolar($reducao['reserva']);

            // `unica` (Parry Shot): a reserva vale só para o próximo dano que o personagem sofrer
            return ['reducao.reserva' => $total, 'reducao.dados' => $dados, 'reducao.turnos' => $turnos, 'reducao.unica' => ! empty($reducao['unica'])];
        }
        if (isset($reducao['mais'])) {
            $n = (int) explode('d', $reducao['mais'])[0];
            $cabe = max(0, (int) ($reducao['maximo'] ?? 0) - (int) ($atual['dados'] ?? 0));
            $dados = min($n, $cabe);
            if ($dados === 0) {
                return [];
            }
            $total = (int) app(Rolador::class)->rolar($dados.'d'.explode('d', $reducao['mais'])[1])['total'];

            return ['reducao.reserva' => (int) ($atual['reserva'] ?? 0) + $total, 'reducao.dados' => (int) ($atual['dados'] ?? 0) + $dados];
        }
        if (! empty($reducao['zerar'])) {
            return ['reducao.zerar' => true, 'reducao.turnos' => $turnos];
        }

        return [];
    }

    /**
     * O dano que o personagem vai sofrer (já depois de imunidade/resistência) passa pelas reduções armadas: `zerar` (Corpo de Criatura, gasta 1 uso da
     * característica) e a reserva de dano (Yamantaka). Devolve o dano final, os campos da ficha a salvar e um aviso para o chat.
     *
     * `contexto`: `origem` (`ataque` comum, `tecnica`, `salvaguarda`), `atributo` e `passou` da salvaguarda, `usados` (chaves de 1 vez por rodada já gastas).
     *
     * @return array{final: int, campos: array<string, mixed>, aviso: ?string, marcar: list<string>}
     */
    public function absorverDano(array $ficha, int $dano, array $contexto = []): array
    {
        $r = $ficha['reducao'] ?? [];
        $campos = [];
        $avisos = [];
        $marcar = [];
        $nivel = (int) ($ficha['nivel'] ?? 1);
        $tem = fn (string $nome): bool => Regras::temCaracteristica($ficha, $nome);
        $origem = $contexto['origem'] ?? null;
        $atributo = $contexto['atributo'] ?? null;
        // Características passivas do estilo que mudam o dano que o personagem sofre
        // Plot Armor (Herói, ligada): nenhum tipo de dano, nem Verdadeiro, durante o efeito
        if ($dano > 0 && $tem('Plot Armor')) {
            $avisos[] = 'Plot Armor: nenhum dano';
            $dano = 0;
        }
        if ($dano > 0 && $origem === 'salvaguarda' && in_array($atributo, ['for', 'des'], true) && $tem('Controle do Ambiente')) {
            $avisos[] = 'Controle do Ambiente: nenhum dano de Salvaguarda de Força ou Destreza';
            $dano = 0;
        }
        if ($dano > 0 && $origem === 'salvaguarda' && $atributo === 'des' && $tem('Esquiva Fugaz')) {
            $dano = ! empty($contexto['passou']) ? 0 : intdiv($dano, 2);
            $avisos[] = 'Esquiva Fugaz: '.(! empty($contexto['passou']) ? 'passou na Salvaguarda de Destreza, sem dano' : 'falhou, só metade do dano');
        }
        if ($dano > 0 && $origem === 'ataque' && $tem('Rompante Defensivo') && ! in_array('rompante', $contexto['usados'] ?? [], true)) {
            $dano = intdiv($dano, 2);
            $marcar[] = 'rompante';
            $avisos[] = 'Rompante Defensivo: o dano do ataque cai pela metade (1ª vez nesta rodada)';
        }
        if ($dano > 0 && ! empty($r['zerar'])) {
            $lista = $ficha['caracteristicas'] ?? [];
            foreach ($lista as $i => $c) {
                $gasta = $c['reacao']['reducao']['gasta'] ?? null;
                if (! ($c['reacao']['reducao']['zerar'] ?? false)) {
                    continue;
                }
                if (is_array($gasta)) {
                    // Virada Heroica: gasta os Dados Heroicos (de outra característica) ao zerar o dano
                    $k = $this->indiceDaCaracteristica(['caracteristicas' => $lista], (string) $gasta['de'], (int) $gasta['qtd']);
                    if ($k === null) {
                        continue;
                    }
                    $lista[$k]['usos']['atual'] = (int) $lista[$k]['usos']['atual'] - (int) $gasta['qtd'];
                } elseif ((int) ($c['usos']['atual'] ?? 0) > 0) {
                    $lista[$i]['usos']['atual'] = (int) $c['usos']['atual'] - 1;
                } else {
                    continue;
                }
                $campos['caracteristicas'] = $lista;
                $avisos[] = ($c['nome'] ?? 'Corpo de Criatura').' reduz o dano a 0';
                $dano = 0;
                break;
            }
            $campos['reducao.zerar'] = false;
        }
        $reserva = (int) ($r['reserva'] ?? 0);
        if ($dano > 0 && $reserva > 0) {
            $abs = min($dano, $reserva);
            $dano -= $abs;
            $unica = ! empty($r['unica']);
            $campos['reducao.reserva'] = $unica ? 0 : $reserva - $abs;
            if ($unica || $reserva - $abs === 0) {
                $campos['reducao.dados'] = 0;
                $campos['reducao.unica'] = false;
            }
            $avisos[] = "a reserva de redução absorve {$abs}".($unica ? '' : ' (restam '.($reserva - $abs).')');
        }

        return ['final' => $dano, 'campos' => $campos, 'aviso' => $avisos ? ucfirst(implode('; ', $avisos)).'.' : null, 'marcar' => $marcar];
    }

    /**
     * Os Pontos de Escudo resistem a este tipo de dano? Cortante, Perfurante e Contundente sempre (Endurecimento Defensivo);
     * com "Corpo Armadurado" na Forma Dominada ativo, a todos exceto Verdadeiro.
     */
    public function escudoResiste(array $ficha, ?string $tipo): bool
    {
        $tipo = \App\Nucleo\Combate\Dano::normalizar($tipo);
        if ($tipo === 'verdadeiro') {
            return false;
        }
        if (in_array($tipo, ['cortante', 'perfurante', 'contundente'], true)) {
            return true;
        }
        $formas = array_column($ficha['haki']['talentos'] ?? [], 'formas', 'id')['corpo-armadurado'] ?? 0;
        $ativo = collect($ficha['caracteristicas'] ?? [])->contains(fn ($c) => str_starts_with((string) ($c['nome'] ?? ''), 'Corpo Armadurado') && ($c['ativa'] ?? false) === true);

        return $formas >= 2 && $ativo;
    }

    /**
     * Treinamentos: o jogador só faz e cancela PEDIDOS (o mestre conclui). `extras` e `aprendidos` não mudam por ele; um pedido
     * novo precisa caber nos PT livres e nos requisitos; os dias de um pedido existente são do mestre.
     */
    private function conferirTreinamentos(array $antes, array $depois): void
    {
        $a = array_replace(Treinamentos::padrao(), $antes['treinamento'] ?? []);
        $d = array_replace(Treinamentos::padrao(), $depois['treinamento'] ?? []);
        if ($a['extras'] !== $d['extras'] || $a['aprendidos'] !== $d['aprendidos']) {
            abort(403, 'Só o mestre muda os PT e conclui treinamentos.');
        }
        $chave = fn (array $p) => $p['id'].'|'.($p['opcao'] ?? '');
        $antigos = [];
        foreach ($a['pedidos'] as $p) {
            $antigos[$chave($p)] = (int) $p['dias'];
        }
        $corrente = $antes;
        foreach ($d['pedidos'] as $p) {
            if (array_key_exists($chave($p), $antigos)) {
                if ($antigos[$chave($p)] !== (int) $p['dias']) {
                    abort(403, 'Só o mestre marca os dias de treino.');
                }
                continue;
            }
            if ((int) $p['dias'] !== 0) {
                abort(403, 'Um pedido novo começa com 0 dia.');
            }
            $problemas = Treinamentos::problemasDoPedido($corrente, $p['id'], $p['opcao'] ?? null);
            if ($problemas) {
                throw \Illuminate\Validation\ValidationException::withMessages(['campos.treinamento.pedidos' => $problemas[0]]);
            }
            $corrente['treinamento'] = [...$a, 'pedidos' => [...($corrente['treinamento']['pedidos'] ?? []), $p]];
        }
    }

    /** Fim do combate: os Pontos de Escudo renovam (10 minutos fora de combate). Devolve os campos a salvar, se houver. */
    public function aoEncerrarCombate(array $ficha): array
    {
        $max = (int) (Regras::calcular($ficha, [])['escudo.max'] ?? 0);

        return $max > 0 && (int) ($ficha['pv']['escudo'] ?? 0) < $max ? ['pv.escudo' => $max] : [];
    }

    /**
     * Campos que só o mestre grava e compras a conferir (chamado pelo `FichaController` antes de salvar). Haki: liberar o
     * Haki e o Haki do Rei, o despertar prematuro e os PA dados (gerais e restritos) são do mestre; o jogador só compra
     * talentos (sem devolver) e escolhe Haki Principal e afinidade, e a compra tem de caber no saldo e nos requisitos.
     */
    /** @param  array{subir_nivel?: bool}  $liberacoes  o que o mestre liberou na mesa */
    public function conferirFicha(array $antes, array $depois, bool $mestre, array $liberacoes = []): void
    {
        if ($mestre) {
            return;
        }
        // XP: o jogador só o vê; quem dá é o mestre (distribuição de XP).
        if ((int) ($antes['xp']['atual'] ?? 0) !== (int) ($depois['xp']['atual'] ?? 0)) {
            abort(403, 'O XP só muda pela distribuição do mestre.');
        }
        // Subir de nível: um nível por vez, com o XP no máximo do nível atual e o mestre tendo liberado.
        $nivelAntes = (int) ($antes['nivel'] ?? 1);
        $nivelDepois = (int) ($depois['nivel'] ?? $nivelAntes);
        if ($nivelDepois !== $nivelAntes) {
            $proximo = Regras::XP_PROXIMO[min(max($nivelAntes, 1), 20)];
            if ($nivelDepois !== $nivelAntes + 1 || empty($liberacoes['subir_nivel']) || (int) ($antes['xp']['atual'] ?? 0) < $proximo) {
                abort(403, 'Subir de nível exige o XP do nível e a liberação do mestre.');
            }
        }
        if (($antes['itensIniciais'] ?? []) !== ($depois['itensIniciais'] ?? []) || (int) ($antes['dinheiroInicial'] ?? 0) !== (int) ($depois['dinheiroInicial'] ?? 0)) {
            abort(403, 'Os itens iniciais são entregues pela criação da ficha.');
        }
        if ((bool) ($antes['aliado'] ?? false) !== (bool) ($depois['aliado'] ?? false)) {
            abort(403, 'Só o mestre marca um NPC como aliado.');
        }
        if (($antes['npc'] ?? null) != ($depois['npc'] ?? null)) {
            abort(403, 'Só o mestre edita a ficha de um NPC.');
        }
        $this->conferirTreinamentos($antes, $depois);
        Profissoes::conferir($antes, $depois);
        if (empty($antes['akuma']['despertada']) && ! empty($depois['akuma']['despertada'])) {
            abort(403, 'Só o mestre desperta a Akuma no Mi.');
        }
        // Pontos de Forja: o jogador nunca os altera à mão (a forja gasta e conta as lâminas no servidor; o mestre dá os PF).
        if (($antes['forja'] ?? Ferreiro::padrao()) != ($depois['forja'] ?? Ferreiro::padrao())) {
            abort(403, 'Só o mestre ou a própria forja alteram os Pontos de Forja.');
        }
        Akuma::conferir($antes, $depois);
        Individualidades::conferir($antes, $depois);
        Criador::conferirGenialidades($depois);
        Criador::conferir($antes, $depois);
        $a = array_replace_recursive(Haki::padrao(), $antes['haki'] ?? []);
        $d = array_replace_recursive(Haki::padrao(), $depois['haki'] ?? []);
        foreach (['liberado', 'rei', 'prematuroNivel', 'extras', 'restritos'] as $campo) {
            if ($a[$campo] !== $d[$campo]) {
                abort(403, 'Só o mestre muda isso no Haki.');
            }
        }
        if ($a['talentos'] === $d['talentos']) {
            return;
        }
        $formasAntes = array_column($a['talentos'], 'formas', 'id');
        $formasDepois = array_column($d['talentos'], 'formas', 'id');
        foreach ($formasAntes as $id => $formas) {
            if (($formasDepois[$id] ?? 0) < $formas) {
                abort(403, 'Só o mestre devolve talentos do Haki.');
            }
        }
        $problemas = Haki::problemas($depois);
        if ($problemas) {
            throw \Illuminate\Validation\ValidationException::withMessages(['campos.haki.talentos' => $problemas[0]]);
        }
    }

    /**
     * Superioridade Absoluta: depois do cálculo do dano, se os PV que sobram no alvo forem iguais ou menores que o nível do
     * atacante (mais o bônus acumulado), o alvo cai a 0 e o atacante ganha +5 de bônus (máximo +15) até o fim do encontro.
     * Devolve os campos a salvar no atacante, ou null se a característica não age.
     *
     * @return array{campos: array<string, mixed>}|null
     */
    public function execucao(array $fichaAtacante, int $pvDepois): ?array
    {
        $nivel = (int) ($fichaAtacante['nivel'] ?? 1);
        $tem = collect($fichaAtacante['caracteristicas'] ?? [])->contains(fn ($c) => ($c['hb'] ?? null) === 'superioridade-absoluta' && Regras::ativaNoNivel($c, $nivel));
        $bonus = (int) ($fichaAtacante['bonusExecucao'] ?? 0);
        if (! $tem || $pvDepois <= 0 || $pvDepois > $nivel + $bonus) {
            return null;
        }

        return ['campos' => ['bonusExecucao' => min(15, $bonus + 5)]];
    }

    public function categoriaDaDisparada(): ?string
    {
        return 'padrao';
    }

    public function defesa(array $variaveis): int
    {
        return (int) ($variaveis['ca'] ?? 10);
    }

    /** Catálogo de condições do sistema (id, nome, descrição, efeitos): usado ao aplicar condições a um alvo. */
    public function condicoes(): array
    {
        return Condicoes::catalogo();
    }

    public function regrasItem(): array
    {
        return FichaOnePiece::regrasItem();
    }

    public function alvosDeEfeito(): array
    {
        return FichaOnePiece::alvosDeEfeito();
    }
}
