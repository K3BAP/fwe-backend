<?php

namespace App\Libraries;

/**
 * Hält die im aktuellen Request authentifizierte Identität.
 * Wird von den Auth-Filtern befüllt und von Controllern gelesen.
 */
class AuthState
{
    /** @var array<string,mixed>|null */
    public ?array $admin = null;

    /** @var array<string,mixed>|null */
    public ?array $participant = null;

    public function adminId(): ?int
    {
        return isset($this->admin['id']) ? (int) $this->admin['id'] : null;
    }

    public function participantId(): ?int
    {
        return isset($this->participant['id']) ? (int) $this->participant['id'] : null;
    }
}
