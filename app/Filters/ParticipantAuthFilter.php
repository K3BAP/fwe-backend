<?php

namespace App\Filters;

use App\Models\ParticipantModel;
use CodeIgniter\Filters\FilterInterface;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Prüft den Bearer-Token gegen participants und legt den Teilnehmer in den AuthState.
 */
class ParticipantAuthFilter implements FilterInterface
{
    public function before(RequestInterface $request, $arguments = null)
    {
        $header = $request->getHeaderLine('Authorization');

        if (preg_match('/^Bearer\s+(.+)$/i', $header, $m) !== 1) {
            return $this->unauthorized('Kein Token übergeben.');
        }

        $participant = (new ParticipantModel())->where('token', trim($m[1]))->first();

        if ($participant === null) {
            return $this->unauthorized('Sitzung ungültig. Bitte erneut beitreten.');
        }

        service('authState')->participant = $participant;
    }

    public function after(RequestInterface $request, ResponseInterface $response, $arguments = null)
    {
    }

    private function unauthorized(string $message): ResponseInterface
    {
        return service('response')
            ->setStatusCode(401)
            ->setJSON(['error' => $message]);
    }
}
