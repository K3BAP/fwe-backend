<?php

namespace App\Filters;

use App\Models\AdminTokenModel;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Prüft den Bearer-Token gegen admin_tokens und legt den Admin in den AuthState.
 */
class AdminAuthFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $token = $this->bearerToken($request);

        if ($token === null) {
            return $this->unauthorized('Kein Token übergeben.');
        }

        $admin = (new AdminTokenModel())->resolveAdmin($token);

        if ($admin === null) {
            return $this->unauthorized('Ungültiger oder abgelaufener Token.');
        }

        service('authState')->admin = $admin;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
    }

    private function bearerToken(RequestInterface $request): ?string
    {
        $header = $request->getHeaderLine('Authorization');

        if (preg_match('/^Bearer\s+(.+)$/i', $header, $m) === 1) {
            return trim($m[1]);
        }

        return null;
    }

    private function unauthorized(string $message): ResponseInterface
    {
        return service('response')
            ->setStatusCode(401)
            ->setJSON(['error' => $message]);
    }
}
