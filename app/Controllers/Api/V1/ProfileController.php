<?php

namespace App\Controllers\Api\V1;

use App\Controllers\Api\BaseApiController;
use App\Exceptions\ApiException;
use App\Models\ProfileModel;
use App\Services\ProfilePresenter;
use App\Services\UploadService;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Profile-Endpunkte (API.md §3). Öffentliche, je Auth-Status reduzierte Profilkarte (`show`), eigenes
 * Profil lesen/ändern (BOLA: immer self via `auth()->id()`), Avatar-Upload/-Löschung und das
 * Piloten-Verzeichnis. Dünner Controller — Projektion im {@see ProfilePresenter}, Bildpipeline im
 * {@see UploadService}.
 */
class ProfileController extends BaseApiController
{
    /** GET /users/{id} — öffentliche Profilkarte, reduziert für Gäste (ADR-012/C2). */
    public function show($id): ResponseInterface
    {
        $profile = model(ProfileModel::class)->find((int) $id);
        if ($profile === null) {
            return $this->respondError('not_found', 'Profil nicht gefunden.', 404);
        }

        return $this->respondData((new ProfilePresenter())->publicProfile($profile, auth()->loggedIn()));
    }

    /** GET /me/profile — eigenes Profil (mit E-Mail). */
    public function me(): ResponseInterface
    {
        return $this->respondOwnProfile(200);
    }

    /** PATCH /me/profile — eigenes Profil ändern (self-only, BOLA). */
    public function updateMe(): ResponseInterface
    {
        $rules = [
            'display_name'     => 'permit_empty|min_length[2]|max_length[80]',
            'handle'           => 'permit_empty|regex_match[/^[a-z0-9_]{3,30}$/]',
            'bio_markdown'     => 'permit_empty|max_length[2000]',
            'experience_level' => 'permit_empty|in_list[beginner,advanced,expert]',
            'license_class'    => 'permit_empty|max_length[60]',
            'glider'           => 'permit_empty|max_length[120]',
            'home_region'      => 'permit_empty|max_length[80]',
            'flight_hours'     => 'permit_empty|is_natural',
        ];
        $messages = [
            'display_name' => ['min_length' => 'Mindestens 2 Zeichen.', 'max_length' => 'Höchstens 80 Zeichen.'],
            'handle'       => ['regex_match' => 'Nur a–z, 0–9, _ (3–30 Zeichen).'],
            'bio_markdown' => ['max_length' => 'Höchstens 2000 Zeichen.'],
            'flight_hours' => ['is_natural' => 'Bitte eine Zahl ≥ 0 angeben.'],
        ];

        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, $rules, $messages)) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        $myId     = $this->currentUserId();
        $profiles = model(ProfileModel::class);
        $handle   = $this->emptyToNull($input['handle'] ?? null);

        if ($handle !== null && $profiles->where('handle', $handle)->where('user_id !=', $myId)->first() !== null) {
            return $this->respondError('handle_taken', 'Dieser Handle ist bereits vergeben.', 409);
        }

        $data = [
            'bio_markdown'     => $this->emptyToNull($input['bio_markdown'] ?? null),
            'experience_level' => $this->emptyToNull($input['experience_level'] ?? null),
            'license_class'    => $this->emptyToNull($input['license_class'] ?? null),
            'glider'           => $this->emptyToNull($input['glider'] ?? null),
            'home_region'      => $this->emptyToNull($input['home_region'] ?? null),
            'flight_hours'     => $this->emptyToNull($input['flight_hours'] ?? null) === null ? null : (int) $input['flight_hours'],
        ];
        // display_name und handle sind NOT NULL — nur überschreiben, wenn mitgeschickt, nie leeren.
        if (($input['display_name'] ?? '') !== '') {
            $data['display_name'] = $input['display_name'];
        }
        if ($handle !== null) {
            $data['handle'] = $handle;
        }

        $profiles->update($myId, $data);

        return $this->respondOwnProfile(200);
    }

    /** POST /me/avatar — Avatar hochladen (multipart `file`), liefert den neuen Pfad. */
    public function uploadAvatar(): ResponseInterface
    {
        try {
            $path = (new UploadService())->storeAvatar($this->request->getFile('file'));
        } catch (ApiException $e) {
            return $this->fromException($e);
        }

        $myId     = $this->currentUserId();
        $profiles = model(ProfileModel::class);
        $current  = $profiles->find($myId);
        if ($current !== null && ! empty($current['avatar_path'])) {
            (new UploadService())->deleteAvatar($current['avatar_path']);
        }
        $profiles->update($myId, ['avatar_path' => $path]);

        return $this->respondData(['avatar_path' => $path]);
    }

    /** DELETE /me/avatar — Avatar entfernen (Fallback auf Default). */
    public function deleteAvatar(): ResponseInterface
    {
        $myId     = $this->currentUserId();
        $profiles = model(ProfileModel::class);
        $current  = $profiles->find($myId);
        if ($current !== null && ! empty($current['avatar_path'])) {
            (new UploadService())->deleteAvatar($current['avatar_path']);
            $profiles->update($myId, ['avatar_path' => null]);
        }

        return $this->respondNoContent();
    }

    /** GET /users — Piloten-Verzeichnis (Suche/Filter, paginierbar). */
    public function index(): ResponseInterface
    {
        $q      = trim((string) $this->request->getGet('q'));
        $level  = $this->request->getGet('experience_level');
        $limit  = min(50, max(1, (int) ($this->request->getGet('limit') ?: 20)));
        $offset = max(0, (int) $this->request->getGet('offset'));

        $profiles = model(ProfileModel::class);
        if ($q !== '') {
            $profiles->groupStart()->like('display_name', $q)->orLike('handle', $q)->groupEnd();
        }
        if (in_array($level, ['beginner', 'advanced', 'expert'], true)) {
            $profiles->where('experience_level', $level);
        }

        $total = $profiles->countAllResults(false); // Bedingungen für die Folgeabfrage behalten
        $rows  = $profiles->orderBy('display_name', 'ASC')->findAll($limit, $offset);

        $present = new ProfilePresenter();
        $cards   = array_map(static fn (array $row): array => $present->publicUserCard($row), $rows);

        return $this->respondData($cards, 200, ['total' => $total, 'limit' => $limit, 'offset' => $offset]);
    }

    private function respondOwnProfile(int $status): ResponseInterface
    {
        $user    = auth()->user();
        $profile = model(ProfileModel::class)->find($user->id);

        return $this->respondData((new ProfilePresenter())->ownProfile($user, $profile), $status);
    }

    private function emptyToNull(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $value = trim((string) $value);

        return $value === '' ? null : $value;
    }
}
