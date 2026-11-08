<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mesas', function (Blueprint $table) {
            // O mestre libera (liga) quando os jogadores podem descansar e subir de nível. Desligados por padrão.
            $table->boolean('descanso_curto')->default(false);
            $table->boolean('descanso_longo')->default(false);
            $table->boolean('subir_nivel')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('mesas', function (Blueprint $table) {
            $table->dropColumn(['descanso_curto', 'descanso_longo', 'subir_nivel']);
        });
    }
};
