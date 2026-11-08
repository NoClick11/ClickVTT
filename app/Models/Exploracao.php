<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** O que um jogador já viu numa página (imagem PNG pequena, branco = explorado). Só dele; o mestre não tem névoa. */
class Exploracao extends Model
{
    protected $table = 'exploracoes';

    protected $fillable = ['mesa_id', 'pagina_id', 'jogador_id', 'imagem'];
}
