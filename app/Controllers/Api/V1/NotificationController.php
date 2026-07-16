<?php

namespace App\Controllers\Api\V1;

use App\Controllers\Api\BaseApiController;
use App\Exceptions\ApiException;
use App\Services\NotificationPresenter;
use App\Services\NotificationService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * In-App-Benachrichtigungen (API.md §11). Alle Routen im Auth-Filter (self). Gepollte GETs nutzen
 * ETag/304; die Read-Mutationen liefern die **ganze** aktualisierte Liste zurück (Frontend ersetzt den
 * Cache ohne Nachladen).
 */
final class NotificationController extends BaseApiController
{
    /** GET /notifications — eigene Benachrichtigungen, neueste zuerst. */
    public function index(): ResponseInterface
    {
        $present = new NotificationPresenter();
        $rows    = (new NotificationService())->list($this->currentUserId());

        return $this->respondMaybeCached(array_map(static fn (array $r): array => $present->present($r), $rows));
    }

    /** GET /notifications/unread-count — Badge-Zähler (bare Zahl). */
    public function unreadCount(): ResponseInterface
    {
        return $this->respondMaybeCached((new NotificationService())->unreadCount($this->currentUserId()));
    }

    /** POST /notifications/{id}/read — einzelne als gelesen markieren → ganze Liste. */
    public function markRead($id): ResponseInterface
    {
        $service = new NotificationService();
        try {
            $service->markRead($this->currentUserId(), (int) $id);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        return $this->respondList($service);
    }

    /** POST /notifications/read-all — alle als gelesen markieren → ganze Liste. */
    public function markAllRead(): ResponseInterface
    {
        $service = new NotificationService();
        $service->markAllRead($this->currentUserId());

        return $this->respondList($service);
    }

    private function respondList(NotificationService $service): ResponseInterface
    {
        $present = new NotificationPresenter();

        return $this->respondData(array_map(
            static fn (array $r): array => $present->present($r),
            $service->list($this->currentUserId()),
        ));
    }
}
