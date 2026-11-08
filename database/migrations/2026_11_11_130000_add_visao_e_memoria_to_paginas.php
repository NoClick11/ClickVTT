<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('paginas', function (Blueprint $table) {
            $table->boolean('usar_visao')->default(true); // false: sem linha de visão (só luz e escuridão)
            $table->boolean('memoria_ativa')->default(true); // o que o jogador já viu fica no mapa, esmaecido
        });

        // A memória das áreas exploradas: uma imagem pequena (PNG) por jogador e página, guardada no servidor para valer em qualquer aparelho.
        Schema::create('exploracoes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->foreignId('pagina_id')->constrained('paginas')->cascadeOnDelete();
            $table->foreignId('jogador_id')->constrained('jogadores')->cascadeOnDelete();
            $table->longText('imagem'); // data URL image/png
            $table->timestamps();

            $table->unique(['pagina_id', 'jogador_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exploracoes');
        Schema::table('paginas', function (Blueprint $table) {
            $table->dropColumn(['usar_visao', 'memoria_ativa']);
        });
    }
};
