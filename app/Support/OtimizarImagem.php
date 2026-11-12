<?php

namespace App\Support;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Throwable;

final class OtimizarImagem
{
    /**
     * Salva um arquivo no disco, convertendo para WebP se for imagem estática (PNG/JPG).
     * Vídeos (webm/mp4), GIFs e arquivos que já são WebP são salvos diretamente.
     */
    public static function armazenar(UploadedFile $arquivo, string $pasta, string $disco = 'public', int $qualidade = 85): string
    {
        $ext = strtolower($arquivo->getClientOriginalExtension());
        $mime = strtolower((string) $arquivo->getMimeType());

        // Vídeos e GIFs animados mantêm formato original
        if (in_array($ext, ['webm', 'mp4', 'gif'], true) || str_starts_with($mime, 'video/') || $mime === 'image/gif') {
            return $arquivo->store($pasta, $disco);
        }

        // Se já for WebP, salva diretamente
        if ($ext === 'webp' || $mime === 'image/webp') {
            return $arquivo->store($pasta, $disco);
        }

        // Converte PNG, JPG, BMP para WebP com GD se disponível
        if (function_exists('imagewebp') && function_exists('imagecreatefromstring')) {
            try {
                $caminhoTemp = $arquivo->getRealPath();
                if ($caminhoTemp && file_exists($caminhoTemp)) {
                    $conteudo = file_get_contents($caminhoTemp);
                    if ($conteudo !== false) {
                        $imagem = @imagecreatefromstring($conteudo);
                        if ($imagem !== false) {
                            imagesavealpha($imagem, true);
                            $nome = Str::random(40).'.webp';
                            $caminhoRelativo = trim($pasta, '/').'/'.$nome;

                            ob_start();
                            imagewebp($imagem, null, $qualidade);
                            $webpConteudo = ob_get_clean();
                            imagedestroy($imagem);

                            if ($webpConteudo !== false && strlen($webpConteudo) > 0) {
                                Storage::disk($disco)->put($caminhoRelativo, $webpConteudo);

                                return $caminhoRelativo;
                            }
                        }
                    }
                }
            } catch (Throwable) {
                // Em caso de falha na conversão, recorre ao armazenamento padrão
            }
        }

        return $arquivo->store($pasta, $disco);
    }
}
