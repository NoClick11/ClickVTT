<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Separa JOGADOR (quem entra pelo convite) de PERSONAGEM (ficha). N:N pelo pivô `jogador_personagem`.
 * Expandir -> preencher -> contrair. Os ids dos personagens de jogador são preservados
 * (tokens e turnos continuam apontando para o mesmo personagem).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('jogadores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('mesa_id')->constrained()->cascadeOnDelete();
            $table->string('nome');
            $table->string('papel')->default('jogador'); // jogador | mestre
            $table->string('cor', 7)->default('#d4a843');
            $table->string('senha')->nullable(); // hash; null = entra sem senha
            $table->foreignId('pagina_id')->nullable()->constrained('paginas')->nullOnDelete();
            $table->timestamps();

            $table->unique(['mesa_id', 'nome']);
        });

        Schema::create('jogador_personagem', function (Blueprint $table) {
            $table->id();
            $table->foreignId('jogador_id')->constrained('jogadores')->cascadeOnDelete();
            $table->foreignId('personagem_id')->constrained('personagens')->cascadeOnDelete();

            $table->unique(['jogador_id', 'personagem_id']);
        });

        Schema::table('mensagens', function (Blueprint $table) {
            $table->foreignId('jogador_id')->nullable()->after('mesa_id')->constrained('jogadores')->nullOnDelete();
        });
        Schema::table('objetos', function (Blueprint $table) {
            $table->foreignId('jogador_id')->nullable()->after('pagina_id')->constrained('jogadores')->nullOnDelete();
        });

        $this->preencher();

        // Contrair: tira de `personagens` o que era identidade. No SQLite (testes) o ALTER reconstrói a
        // tabela e o ON DELETE dispara em cascata sobre pivô/tokens/mensagens, então lá as colunas
        // legadas (papel, senha, pagina_id) ficam, sem uso. No Postgres é um ALTER simples.
        if (DB::getDriverName() === 'pgsql') {
            Schema::table('personagens', function (Blueprint $table) {
                $table->dropConstrainedForeignId('pagina_id');
                $table->dropColumn(['senha', 'papel']);
            });
        }
    }

    /** Cada personagem antigo vira um jogador; o personagem de jogador continua existindo, ligado a ele. */
    private function preencher(): void
    {
        $agora = now();
        $mestres = [];

        foreach (DB::table('personagens')->orderBy('id')->get() as $p) {
            $jogadorId = DB::table('jogadores')->insertGetId([
                'mesa_id' => $p->mesa_id, 'nome' => $p->nome, 'papel' => $p->papel, 'cor' => $p->cor,
                'senha' => $p->senha, 'pagina_id' => $p->pagina_id, 'created_at' => $agora, 'updated_at' => $agora,
            ]);

            DB::table('mensagens')->where('personagem_id', $p->id)->update(['jogador_id' => $jogadorId]);
            // Traços e textos eram "do personagem" por engano: passam a ser do jogador.
            DB::table('objetos')->where('personagem_id', $p->id)->whereIn('tipo', ['traco', 'texto'])
                ->update(['jogador_id' => $jogadorId, 'personagem_id' => null]);

            if ($p->papel === 'mestre') {
                $mestres[] = $p->id;
            } else {
                DB::table('jogador_personagem')->insert(['jogador_id' => $jogadorId, 'personagem_id' => $p->id]);
            }
        }

        // O "personagem" do mestre era só o login dele: sai (mensagens e tokens ficam sem personagem).
        if ($mestres) {
            DB::table('mensagens')->whereIn('personagem_id', $mestres)->update(['personagem_id' => null]);
            DB::table('objetos')->whereIn('personagem_id', $mestres)->update(['personagem_id' => null]);
            DB::table('personagens')->whereIn('id', $mestres)->delete();
        }
    }

    public function down(): void
    {
        if (! Schema::hasColumn('personagens', 'papel')) {
            Schema::table('personagens', function (Blueprint $table) {
                $table->string('papel')->default('jogador');
                $table->string('senha')->nullable();
                $table->foreignId('pagina_id')->nullable()->constrained('paginas')->nullOnDelete();
            });
        }
        Schema::table('objetos', fn (Blueprint $t) => $t->dropConstrainedForeignId('jogador_id'));
        Schema::table('mensagens', fn (Blueprint $t) => $t->dropConstrainedForeignId('jogador_id'));
        Schema::dropIfExists('jogador_personagem');
        Schema::dropIfExists('jogadores');
    }
};
