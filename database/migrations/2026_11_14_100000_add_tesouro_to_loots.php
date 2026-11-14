<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Baú do tesouro: um loot que sorteia o conteúdo (d100) e pode ficar travado para um só jogador (além do mestre).
        Schema::table('loots', function (Blueprint $table) {
            $table->boolean('tesouro')->default(false);
            $table->foreignId('jogador_id')->nullable()->constrained('jogadores')->nullOnDelete();
            $table->json('sorteio')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('loots', function (Blueprint $table) {
            $table->dropConstrainedForeignId('jogador_id');
            $table->dropColumn(['tesouro', 'sorteio']);
        });
    }
};
