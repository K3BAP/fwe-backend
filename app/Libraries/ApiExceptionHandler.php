<?php

namespace App\Libraries;

use App\Exceptions\ApiException;
use CodeIgniter\Debug\BaseExceptionHandler;
use CodeIgniter\Debug\ExceptionHandlerInterface;
use CodeIgniter\Exceptions\PageNotFoundException;
use CodeIgniter\HTTP\RequestInterface;
use CodeIgniter\HTTP\ResponseInterface;
use CodeIgniter\Security\Exceptions\SecurityException;
use Throwable;

/**
 * Übersetzt jede unter `/api/v1` geworfene Exception in den JSON-Fehler-Envelope (06-backend §3):
 * `{ "error": { "code", "message", "fields? } }` mit korrektem Statuscode. Es wird **nie** ein
 * roher Stacktrace oder HTML an den Client geleakt. Verdrahtet in {@see \Config\Exceptions::handler()}.
 */
class ApiExceptionHandler extends BaseExceptionHandler implements ExceptionHandlerInterface
{
    public function handle(
        Throwable $exception,
        RequestInterface $request,
        ResponseInterface $response,
        int $statusCode,
        int $exitCode,
    ): void {
        [$status, $code, $message, $fields] = $this->map($exception, $statusCode);

        $error = ['code' => $code, 'message' => $message];
        if ($fields !== null) {
            $error['fields'] = $fields;
        }

        $response->setStatusCode($status)->setJSON(['error' => $error])->send();
        exit($exitCode);
    }

    /**
     * @return array{0:int,1:string,2:string,3:array<string,string>|null}
     */
    private function map(Throwable $e, int $fallbackStatus): array
    {
        if ($e instanceof ApiException) {
            return [$e->getStatusCode(), $e->getErrorCode(), $e->getMessage(), $e->getFields()];
        }
        if ($e instanceof PageNotFoundException) {
            return [404, 'not_found', 'Nicht gefunden.', null];
        }
        if ($e instanceof SecurityException) {
            return [403, 'csrf_invalid', 'Sicherheits-Token ungültig oder abgelaufen.', null];
        }

        // Unerwartet: generische 500 ohne Leak. Details nur außerhalb der Produktion zum Debuggen.
        log_message('error', 'Unhandled API exception: ' . $e::class . ': ' . $e->getMessage());
        $message = ENVIRONMENT === 'production' ? 'Interner Serverfehler.' : $e->getMessage();

        return [500, 'internal_error', $message, null];
    }
}
