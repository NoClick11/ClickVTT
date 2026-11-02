<?php

namespace App\Http\Requests\Site;

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
        $mesa = $this->route('mesa');
        $personagem = $this->route('personagem');

        return [
            'nome' => [
                'required', 'string', 'max:60',
                Rule::unique('personagens', 'nome')->where('mesa_id', $mesa->id)->ignore($personagem?->id),
            ],
            'papel' => ['required', Rule::in(Personagem::PAPEIS)],
            'cor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'senha' => ['nullable', 'string', 'min:4', 'max:100'],
            'remover_senha' => ['nullable', 'boolean'],
        ];
    }

    public function messages(): array
    {
        return [
            'nome.unique' => 'Já existe um personagem com esse nome nesta mesa.',
            'cor.regex' => 'Cor inválida.',
            'senha.min' => 'A senha precisa ter ao menos 4 caracteres.',
        ];
    }
}
