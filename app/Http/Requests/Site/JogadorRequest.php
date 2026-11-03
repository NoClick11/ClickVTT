<?php

namespace App\Http\Requests\Site;

use App\Models\Jogador;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class JogadorRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->route('mesa')->user_id === $this->user()->id;
    }

    public function rules(): array
    {
        $mesa = $this->route('mesa');
        $jogador = $this->route('jogador');

        return [
            'nome' => [
                'required', 'string', 'max:60',
                Rule::unique('jogadores', 'nome')->where('mesa_id', $mesa->id)->ignore($jogador?->id),
            ],
            'papel' => ['required', Rule::in(Jogador::PAPEIS)],
            'cor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'senha' => ['nullable', 'string', 'min:4', 'max:100'],
            'remover_senha' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'nome.unique' => 'Já existe um jogador com esse nome nesta mesa.',
            'cor.regex' => 'Cor inválida.',
            'senha.min' => 'A senha precisa ter ao menos 4 caracteres.',
        ];
    }
}
