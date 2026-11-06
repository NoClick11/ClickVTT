<?php

namespace App\Nucleo\Efeitos;

use InvalidArgumentException;

/** Fórmula de efeito malformada ou com variável desconhecida (a mensagem é exibível ao usuário). */
class FormulaInvalida extends InvalidArgumentException {}
