<?php

namespace App\Nucleo\Loot;

use RuntimeException;

/** O que o jogador tentou pegar já não está (alguém levou antes) ou não tem a quantidade pedida. A mensagem é para ele. */
final class LootIndisponivel extends RuntimeException {}
