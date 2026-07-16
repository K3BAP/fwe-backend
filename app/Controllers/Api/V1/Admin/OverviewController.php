<?php

namespace App\Controllers\Api\V1\Admin;

use App\Controllers\Api\BaseApiController;
use App\Services\Admin\AdminPresenter;
use App\Services\Admin\StatsService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Kennzahlen der Admin-Übersicht (ADR-019). Bewusst ohne ETag/`304` ({@see respondData} statt
 * `respondMaybeCached`): hier pollt nichts, ein Conditional-GET wäre nur Zeremonie.
 */
final class OverviewController extends BaseApiController
{
    /** GET /admin/stats */
    public function index(): ResponseInterface
    {
        return $this->respondData((new AdminPresenter())->stats((new StatsService())->overview()));
    }
}
