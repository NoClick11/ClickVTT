<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('mesas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('nome');
            $table->string('slug')->unique();
            $table->string('sistema');
            $table->text('descricao')->nullable();
            $table->string('capa')->nullable();
            $table->string('tema_entrada')->default('padrao');
            $table->dateTime('proxima_sessao')->nullable();
            $table->boolean('favorita')->default(false);
            $table->boolean('travada')->default(false);
            $table->string('convite_token', 40)->unique();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('mesas');
    }
};
