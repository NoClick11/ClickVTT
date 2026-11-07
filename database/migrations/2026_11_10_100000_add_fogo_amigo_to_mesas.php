<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Fogo amigo da mesa (o mestre liga): sem ele, jogador só acerta NPC e NPC só acerta jogador. */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('mesas', function (Blueprint $table) {
            $table->boolean('fogo_amigo')->default(false);
        });
    }

    public function down(): void
    {
        Schema::table('mesas', function (Blueprint $table) {
            $table->dropColumn('fogo_amigo');
        });
    }
};
