<?php

namespace App\Controllers;

use CodeIgniter\HTTP\ResponseInterface;

/**
 * Liefert hochgeladene Fotos aus. Der zufällige Dateiname dient als
 * nicht-erratbare Zugriffsberechtigung (Capability-URL).
 */
class Media extends BaseController
{
    public function photo(string $name): ResponseInterface
    {
        $name = basename($name); // Path-Traversal verhindern
        $path = WRITEPATH . 'uploads/' . $name;

        if (! is_file($path)) {
            return $this->response->setStatusCode(404)->setBody('Nicht gefunden.');
        }

        $mime = mime_content_type($path) ?: 'application/octet-stream';

        return $this->response
            ->setStatusCode(200)
            ->setHeader('Content-Type', $mime)
            ->setHeader('Cache-Control', 'private, max-age=86400')
            ->setBody(file_get_contents($path));
    }
}
