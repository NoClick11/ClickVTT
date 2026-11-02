<?php

return [
    'testing' => [
        // As páginas vivem em resources/js/{site,app}/pages (resolver em resources/js/app.ts),
        // então a verificação padrão de arquivo em resources/js/pages não se aplica.
        'ensure_pages_exist' => false,
    ],
];
