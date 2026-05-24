<?php

namespace App\Controllers\Api;

use App\Models\RallyeModel;

class RallyeController extends ApiController
{
    /** Öffentliche Beitritts-Info zu einem join_code (für den Beitritts-Screen). */
    public function showByCode(string $code)
    {
        $rallye = (new RallyeModel())->findByCode($code);

        if ($rallye === null) {
            return $this->failNotFound('Rallye nicht gefunden.');
        }

        return $this->respond(['rallye' => RallyeModel::publicView($rallye)]);
    }
}
