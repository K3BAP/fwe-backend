<?php

namespace App\Models;

use CodeIgniter\Model;

class AdminTokenModel extends Model
{
    protected $table         = 'admin_tokens';
    protected $primaryKey    = 'id';
    protected $returnType    = 'array';
    protected $allowedFields = ['admin_id', 'token', 'expires_at'];
    protected $useTimestamps = false;

    /**
     * Liefert den Admin-Datensatz zu einem gültigen (nicht abgelaufenen) Token.
     *
     * @return array<string,mixed>|null
     */
    public function resolveAdmin(string $token): ?array
    {
        $row = $this->select('admins.id, admins.username, admins.created_at')
            ->join('admins', 'admins.id = admin_tokens.admin_id')
            ->where('admin_tokens.token', $token)
            ->groupStart()
                ->where('admin_tokens.expires_at IS NULL')
                ->orWhere('admin_tokens.expires_at >', date('Y-m-d H:i:s'))
            ->groupEnd()
            ->asArray()
            ->first();

        return $row ?: null;
    }
}
