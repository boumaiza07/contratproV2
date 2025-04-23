<?php

return [
    'paths' => ['api/*', 'upload-document', 'documents/*'],
    'allowed_origins' => ['*'], // Allow all origins
    'allowed_methods' => ['*'], // Allow all methods
    'allowed_headers' => ['*'], // Allow all headers
    'exposed_headers' => [],
    'max_age' => 86400, // 24 hours
    'supports_credentials' => false, // No need for credentials with token auth
];