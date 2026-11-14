<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Loot aberto ou fechado: o que nasce fica fechado (o mestre monta em paz) e só o mestre abre. Os que já existem continuam abertos.
        Schema::table('loots', function (Blueprint $table) {
            $table->boolean('aberto')->default(false);
        });
        DB::table('loots')->update(['aberto' => true]);
    }

    public function down(): void
    {
        Schema::table('loots', function (Blueprint $table) {
            $table->dropColumn('aberto');
        });
    }
};
