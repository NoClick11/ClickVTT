<?php

namespace App\Http\Requests\Site;

use App\Models\Mesa;
use App\Models\Personagem;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class PersonagemRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->route('mesa')->user_id === $this->user()->id;
    }

    public function rules(): array
    {
        return self::regrasPara($this->route('mesa'), $this->route('personagem'));
    }

    public function messages(): array
    {
        return self::mensagens();
    }

    /**
     * Regras de nome, cor e jogadores de um personagem; o site (dono da mesa) e o jogo (mestre) usam as mesmas.
     *
     * @return array<string, mixed>
     */
    public static function regrasPara(Mesa $mesa, ?Personagem $personagem = null): array
    {
        return [
            'nome' => [
                'required', 'string', 'max:60',
                Rule::unique('personagens', 'nome')->where('mesa_id', $mesa->id)->ignore($personagem?->id),
            ],
            'cor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            // Jogadores deste personagem (só jogadores da própria mesa; o mestre controla todos por padrão).
            'jogadores' => ['nullable', 'array'],
            'jogadores.*' => ['integer', Rule::exists('jogadores', 'id')->where('mesa_id', $mesa->id)->where('papel', 'jogador')],
        ];
    }

    /** @return array<string, string> */
    public static function mensagens(): array
    {
        return [
            'nome.unique' => 'Já existe um personagem com esse nome nesta mesa.',
            'cor.regex' => 'Cor inválida.',
            'jogadores.*.exists' => 'Jogador inválido para esta mesa.',
        ];
    }
}
