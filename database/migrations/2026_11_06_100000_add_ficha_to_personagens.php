<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('personagens', function (Blueprint $table) {
            // Dados da ficha: o formato é definido pelo módulo do sistema da mesa. null = ficha padrão do sistema.
            $table->json('ficha')->nullable()->after('cor');
            // Criação guiada em andamento: {etapa, concluida}. null = sem criação guiada (edição livre).
            $table->json('criacao')->nullable()->after('ficha');
        });
    }

    public function down(): void
    {
        Schema::table('personagens', function (Blueprint $table) {
            $table->dropColumn(['ficha', 'criacao']);
        });
    }
};
