<?php

namespace App\Nucleo\Sistemas;

use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

/**
 * Aplica edições campo a campo numa ficha, validando contra as regras do SISTEMA. Não conhece nenhum
 * sistema em particular. A criação guiada usa o mesmo caminho: cada etapa envia vários campos de uma vez,
 * aplicados juntos (tudo ou nada).
 */
class FichaCampos
{
    public const MAX_CAMPOS = 100;

    public const MAX_BYTES = 262144;

    /** Cada segmento é uma chave de objeto (sem índices numéricos: listas são trocadas por inteiro). */
    private const CAMINHO = '/^[A-Za-z][A-Za-z0-9_]*(\.[A-Za-z][A-Za-z0-9_]*)*$/';

    /**
     * @param  array<string, mixed>|null  $ficha  ficha atual (null = ficha padrão do sistema)
     * @param  array<string, mixed>  $campos  caminho => novo valor
     * @return array<string, mixed> a ficha com os campos aplicados
     *
     * @throws ValidationException
     */
    public function aplicar(Sistema $sistema, ?array $ficha, array $campos): array
    {
        if ($campos === [] || count($campos) > self::MAX_CAMPOS) {
            throw ValidationException::withMessages(['campos' => 'Envie de 1 a '.self::MAX_CAMPOS.' campos por vez.']);
        }

        $regras = $sistema->regrasFicha();
        $editaveis = array_flip(array_filter(array_keys($regras), fn (string $k) => ! str_contains($k, '*')));

        $erros = [];
        $parcial = [];
        foreach ($campos as $caminho => $valor) {
            $caminho = (string) $caminho;
            if (! preg_match(self::CAMINHO, $caminho) || ! isset($editaveis[$caminho])) {
                $erros["campos.{$caminho}"] = ['Campo desconhecido neste sistema.'];

                continue;
            }
            Arr::set($parcial, $caminho, $valor);
        }
        if ($erros) {
            throw ValidationException::withMessages($erros);
        }

        // O Laravel pula as regras de um valor "" (só `required` o barra): aqui "" só vale onde o campo é texto.
        foreach (Arr::dot($parcial) as $chave => $valor) {
            if ($valor === '' && ! $this->ehTexto($regras[preg_replace('/(?<=^|\.)\d+(?=\.|$)/', '*', (string) $chave)] ?? [])) {
                $erros["campos.{$chave}"] = ['Valor vazio não é permitido neste campo.'];
            }
        }
        if ($erros) {
            throw ValidationException::withMessages($erros);
        }

        // Só os campos enviados são validados (as regras não exigem presença: campo ausente passa).
        $validador = Validator::make($parcial, $regras);
        if ($validador->fails()) {
            $comPrefixo = [];
            foreach ($validador->errors()->messages() as $chave => $mensagens) {
                $comPrefixo["campos.{$chave}"] = $mensagens;
            }
            throw ValidationException::withMessages($comPrefixo);
        }

        $nova = $ficha ?? $sistema->fichaPadrao();
        foreach ($campos as $caminho => $valor) {
            Arr::set($nova, (string) $caminho, $valor);
        }
        if (strlen((string) json_encode($nova)) > self::MAX_BYTES) {
            throw ValidationException::withMessages(['campos' => 'A ficha ficou grande demais.']);
        }

        return $nova;
    }

    /** @param  mixed  $regra  regra(s) do campo, em array ou string "a|b" */
    private function ehTexto(mixed $regra): bool
    {
        $lista = is_string($regra) ? explode('|', $regra) : Arr::wrap($regra);

        return in_array('string', $lista, true);
    }
}
