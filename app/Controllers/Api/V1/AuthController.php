<?php

namespace App\Controllers\Api\V1;

use App\Controllers\Api\BaseApiController;
use App\Exceptions\ApiException;
use App\Models\ProfileModel;
use App\Services\AuthService;
use App\Services\ProfilePresenter;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\HTTP\ResponseInterface;

/**
 * Auth-Endpunkte (API.md §2): register/login/logout/me + CSRF-Token. Dünner Controller — Validierung
 * (spiegelt Zod) hier, Geschäftslogik im {@see AuthService}, Projektion im {@see ProfilePresenter}.
 */
class AuthController extends BaseApiController
{
    /**
     * GET /auth/csrf — CSRF-Token (Double-Submit, ADR-004). Die SPA holt es einmal und sendet es
     * danach als `X-CSRF-TOKEN`-Header bei jedem schreibenden Request.
     */
    public function csrf(): ResponseInterface
    {
        helper('security');

        return $this->respondData(['token' => csrf_hash()]);
    }

    /** POST /auth/register — Konto + Profil anlegen, eingeloggt zurück (201). */
    public function register(): ResponseInterface
    {
        $rules = [
            'email'        => 'required|valid_email|max_length[254]',
            'password'     => 'required|min_length[8]|max_length[255]',
            'display_name' => 'required|min_length[2]|max_length[80]',
            'handle'       => 'required|regex_match[/^[a-z0-9_]{3,30}$/]',
        ];
        $messages = [
            'email'        => ['required' => 'Bitte eine E-Mail angeben.', 'valid_email' => 'Bitte eine gültige E-Mail angeben.'],
            'password'     => ['required' => 'Bitte ein Passwort angeben.', 'min_length' => 'Mindestens 8 Zeichen.'],
            'display_name' => ['required' => 'Bitte einen Anzeigenamen angeben.', 'min_length' => 'Mindestens 2 Zeichen.', 'max_length' => 'Höchstens 80 Zeichen.'],
            'handle'       => ['required' => 'Bitte einen Benutzernamen angeben.', 'regex_match' => 'Nur a–z, 0–9, _ (3–30 Zeichen).'],
        ];

        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, $rules, $messages)) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            $user = $this->authService()->register($this->validator->getValidated());

            return $this->respondSession($user, 201);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }
    }

    /** POST /auth/login — anmelden (200). Rate-Limit via throttle-Filter auf der Route. */
    public function login(): ResponseInterface
    {
        $rules = [
            'email'    => 'required|valid_email',
            'password' => 'required',
        ];
        $messages = [
            'email'    => ['required' => 'Bitte eine E-Mail angeben.', 'valid_email' => 'Bitte eine gültige E-Mail angeben.'],
            'password' => ['required' => 'Bitte ein Passwort angeben.'],
        ];

        $input = $this->request->getJSON(true) ?? [];
        if (! $this->validateData($input, $rules, $messages)) {
            return $this->respondError('validation_error', 'Bitte prüfe deine Eingaben.', 422, $this->validator->getErrors());
        }

        try {
            $user = $this->authService()->login($input['email'], $input['password']);

            return $this->respondSession($user, 200);
        } catch (ApiException $e) {
            return $this->fromException($e);
        }
    }

    /** POST /auth/logout — Session beenden (204). */
    public function logout(): ResponseInterface
    {
        auth()->logout();

        return $this->respondNoContent();
    }

    /** GET /auth/me — aktuelle Session: user + eigenes Profil + Unread-Zähler. */
    public function me(): ResponseInterface
    {
        $user    = auth()->user();
        $profile = model(ProfileModel::class)->find($user->id);
        $present = new ProfilePresenter();

        return $this->respondData([
            'user'     => $present->publicUser($user, $profile),
            'profile'  => $present->ownProfile($user, $profile),
            'is_admin' => $user->inGroup('admin'), // Plattform-Admin (Shield-Gruppe), nur Anzeige (ADR-012/D4)
            // Chat/Notifications existieren erst ab M5 → Platzhalter; UI-Badges bleiben bis dahin Mock.
            'unread'  => ['messages' => 0, 'notifications' => 0],
        ]);
    }

    private function respondSession(User $user, int $status): ResponseInterface
    {
        $profile = model(ProfileModel::class)->find($user->id);
        $present = new ProfilePresenter();

        return $this->respondData([
            'user'     => $present->publicUser($user, $profile),
            'profile'  => $present->ownProfile($user, $profile),
            'is_admin' => $user->inGroup('admin'),
        ], $status);
    }

    private function authService(): AuthService
    {
        return new AuthService(model(ProfileModel::class));
    }
}
