<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Raridades à venda (comum, incomum, raro, mercado negro...); nulo = todas.
        Schema::table('lojas_abertas', function (Blueprint $table) {
            $table->json('raridades')->nullable()->after('categorias');
        });
    }

    public function down(): void
    {
        Schema::table('lojas_abertas', function (Blueprint $table) {
            $table->dropColumn('raridades');
        });
    }
};
