<?php

namespace App\Http\Requests\Site;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class MesaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $mesa = $this->route('mesa');

        return [
            'nome' => ['required', 'string', 'max:80'],
            'slug' => [
                $mesa ? 'prohibited' : 'required', 'string', 'max:80', 'regex:/^[a-z0-9]+(-[a-z0-9]+)*$/',
                Rule::unique('mesas', 'slug'),
            ],
            'sistema_id' => [$mesa ? 'prohibited' : 'required', Rule::exists('sistemas', 'id')->where('ativo', true)],
            'descricao' => ['nullable', 'string', 'max:2000'],
            'capa' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'remover_capa' => ['nullable', 'boolean'],
            'tema_entrada' => ['required', Rule::in(['padrao', 'minimo'])],
        ];
    }

    public function messages(): array
    {
        return [
            'slug.regex' => 'Use apenas letras minúsculas, números e hífens.',
            'slug.unique' => 'Já existe uma mesa com esse identificador.',
            'slug.prohibited' => 'O identificador não pode ser alterado.',
            'sistema_id.prohibited' => 'O sistema não pode ser alterado.',
            'capa.image' => 'O arquivo precisa ser uma imagem.',
            'capa.mimes' => 'Use JPG, PNG ou WebP.',
            'capa.max' => 'A imagem pode ter no máximo 5 MB.',
        ];
    }
}
