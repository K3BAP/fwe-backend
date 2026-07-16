<?php

namespace App\Services;

use App\Exceptions\ApiException;
use App\Models\ProfileModel;
use CodeIgniter\Shield\Entities\User;
use CodeIgniter\Shield\Models\UserModel;

/**
 * Auth-Geschäftslogik (ADR-013: dünner Controller → Service). Kapselt Shield-Aufrufe und Transaktionen
 * für Registrierung/Login und übersetzt Konflikte in {@see ApiException} (→ Envelope). Die Validierung
 * der Eingaben passiert im Controller (CI4-Validation, spiegelt Zod).
 */
final class AuthService
{
    public function __construct(private readonly ProfileModel $profiles)
    {
    }

    /**
     * Konto + Profil in **einer** Transaktion anlegen und sofort einloggen (ADR-008: ohne
     * E-Mail-Verifikation direkt aktiv).
     *
     * @param array{email:string,password:string,display_name:string,handle?:string|null} $input
     *
     * @throws ApiException email_taken | handle_taken | internal_error
     */
    public function register(array $input): User
    {
        /** @var UserModel $users */
        $users  = auth()->getProvider();
        $handle = $this->normalizeHandle($input['handle'] ?? null);

        if ($users->findByCredentials(['email' => $input['email']]) !== null) {
            throw ApiException::conflict('email_taken', 'Diese E-Mail-Adresse ist bereits registriert.');
        }
        if ($handle !== null && $this->profiles->where('handle', $handle)->first() !== null) {
            throw ApiException::conflict('handle_taken', 'Dieser Handle ist bereits vergeben.');
        }

        $db = db_connect();
        $db->transBegin();

        try {
            // `active` setzen, sonst wäre der users-Insert leer (E-Mail/Passwort → auth_identities).
            $user = new User(['email' => $input['email'], 'password' => $input['password'], 'active' => true]);
            $users->save($user);
            $user = $users->findById($users->getInsertID());
            $users->addToDefaultGroup($user);

            $this->profiles->insert([
                'user_id'      => $user->id,
                'display_name' => $input['display_name'],
                'handle'       => $handle,
            ]);

            $db->transCommit();
        } catch (\Throwable $e) {
            $db->transRollback();
            log_message('error', 'Registration failed: ' . $e->getMessage());

            throw new ApiException('internal_error', 'Registrierung fehlgeschlagen. Bitte erneut versuchen.', 500);
        }

        auth()->login($user);

        return $user;
    }

    /**
     * Anmeldung über Shields Session-Authenticator. Fehlversuche werden von Shield protokolliert
     * (auth_logins); das Rate-Limit erledigt der throttle-Filter auf der Route.
     *
     * @throws ApiException invalid_credentials | account_suspended
     */
    public function login(string $email, string $password): User
    {
        $result = auth()->attempt(['email' => $email, 'password' => $password]);

        if (! $result->isOK()) {
            throw new ApiException('invalid_credentials', 'E-Mail oder Passwort ist falsch.', 401);
        }

        $user = auth()->user();
        if (! $user->active) {
            auth()->logout();

            throw new ApiException('account_suspended', 'Dieses Konto ist gesperrt.', 403);
        }

        return $user;
    }

    private function normalizeHandle(?string $handle): ?string
    {
        $handle = $handle !== null ? trim($handle) : '';

        return $handle === '' ? null : $handle;
    }
}
