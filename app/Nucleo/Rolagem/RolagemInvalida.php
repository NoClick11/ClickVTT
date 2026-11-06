<?php

namespace App\Nucleo\Rolagem;

use InvalidArgumentException;

/** Expressão de rolagem malformada ou fora dos limites (a mensagem é exibível ao usuário). */
class RolagemInvalida extends InvalidArgumentException {}
