<?php

namespace App\Models;

use CodeIgniter\Model;

class TaskModel extends Model
{
    public const TYPES = [
        'multiple_choice', 'exact_text', 'numeric_estimate', 'free_text',
        'photo_upload', 'gps_checkin', 'onsite_time', 'onsite_points',
    ];

    /** Typen, die nach der Abgabe sofortiges Feedback liefern. */
    public const AUTO_TYPES = ['multiple_choice', 'exact_text', 'numeric_estimate', 'gps_checkin'];

    /** Typen, deren Punkte rangbasiert über alle Teams berechnet werden. */
    public const RANK_TYPES = ['numeric_estimate', 'onsite_time'];

    /** Typen, die von einer Aufsicht vor Ort per QR-Scan gesetzt werden. */
    public const ONSITE_TYPES = ['onsite_time', 'onsite_points'];

    protected $table         = 'tasks';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $useTimestamps = false;
    protected $allowedFields = ['rallye_id', 'type', 'title', 'prompt', 'position', 'max_points', 'config'];

    protected $validationRules = [
        'rallye_id'  => 'required|is_natural_no_zero',
        'type'       => 'required|in_list[multiple_choice,exact_text,numeric_estimate,free_text,photo_upload,gps_checkin,onsite_time,onsite_points]',
        'title'      => 'required|max_length[150]',
        'max_points' => 'required|is_natural',
    ];
    protected $validationMessages = [
        'title' => ['required' => 'Titel der Aufgabe ist erforderlich.'],
        'type'  => ['in_list' => 'Unbekannter Aufgabentyp.'],
    ];

    public function forRallye(int $rallyeId): array
    {
        return $this->where('rallye_id', $rallyeId)
            ->orderBy('position', 'ASC')
            ->orderBy('id', 'ASC')
            ->findAll();
    }

    /** Decodiert das config-JSON-Feld einer Aufgabe in ein assoziatives Array. */
    public static function decodeConfig(?array $task): array
    {
        if ($task === null || empty($task['config'])) {
            return [];
        }

        $decoded = is_array($task['config']) ? $task['config'] : json_decode((string) $task['config'], true);

        return is_array($decoded) ? $decoded : [];
    }
}
