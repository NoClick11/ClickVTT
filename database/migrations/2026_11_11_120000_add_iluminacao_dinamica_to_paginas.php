<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('paginas', function (Blueprint $table) {
            // Iluminação dinâmica (visão dos tokens, luzes e sombras das paredes), calculada no navegador de cada jogador.
            $table->boolean('iluminacao_ativa')->default(false);
            $table->unsignedTinyInteger('luz_ambiente')->default(0); // 0 = escuridão total, 100 = pleno dia
            $table->unsignedSmallInteger('visao_padrao')->default(6); // quadrados que um token enxerga no escuro
        });
    }

    public function down(): void
    {
        Schema::table('paginas', function (Blueprint $table) {
            $table->dropColumn(['iluminacao_ativa', 'luz_ambiente', 'visao_padrao']);
        });
    }
};
