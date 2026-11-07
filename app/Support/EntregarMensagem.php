<?php

namespace App\Support;

use App\Models\Jogador;
use App\Models\Mesa;
use App\Models\Mensagem;

/** Distribui uma mensagem de chat: cada canal recebe só o que pode ver (ver `Mensagem::para`). */
final class EntregarMensagem
{
    /** `substitui`: a mensagem já existia (ex.: o ataque ganhou o resultado) e a tela troca a antiga por esta. */
    public static function para(Mesa $mesa, Mensagem $mensagem, AcessoMesa $acesso, bool $substitui = false): void
    {
        $mensagem->load(['personagem', 'jogador']);
        $autor = $acesso->jogador->id;

        switch ($mensagem->visibilidade) {
            case 'todos':
                Transmitir::enviar($mesa, 'mensagem', ['mensagem' => $mensagem->publica(), 'ator' => $autor, ...($substitui ? ['substitui' => true] : [])], ['mesa']);
                break;
            case 'secreto':
                // Aviso sem números para todos; resultado completo só para o mestre.
                Transmitir::enviar($mesa, 'mensagem', ['mensagem' => $mensagem->publica(), 'ator' => $autor], ['mesa']);
                Transmitir::enviar($mesa, 'mensagem', ['mensagem' => $mensagem->para(new Jogador(['papel' => 'mestre'])), 'ator' => $autor, 'substitui' => true], ['mestre']);
                break;
            case 'mestre':
                $canais = $acesso->ehMestre() ? ['mestre'] : ["jogador.{$autor}", 'mestre'];
                Transmitir::enviar($mesa, 'mensagem', ['mensagem' => $mensagem->para($acesso->jogador), 'ator' => $autor, ...($substitui ? ['substitui' => true] : [])], $canais);
                break;
        }
    }
}
