<?php

namespace App\Services;

use App\Exceptions\ApiException;
use CodeIgniter\HTTP\Files\UploadedFile;
use GdImage;

/**
 * Avatar-Verarbeitung (06-backend §7, 01-auth-profil §9). Härtet den Upload: echtes MIME-Sniffing
 * (finfo, **nicht** der Client-Header), Größenlimit, GD-Dekodierung (verwirft Nicht-Bilder/Schadcode),
 * quadratischer Center-Crop auf 512×512 (+128×128-Thumbnail) als **WebP** re-enkodiert (strippt EXIF),
 * randomisierter Dateiname ohne Nutzeranteil. Liefert den relativen `avatar_path` zurück.
 */
final class UploadService
{
    private const MAX_BYTES = 5 * 1024 * 1024; // 5 MB (API.md §3.4)
    private const MAIN_SIZE  = 512;
    private const THUMB_SIZE  = 128;

    /** MIME → Endung (Allowlist; Reihenfolge egal). */
    private const ALLOWED = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];

    private string $dir;

    public function __construct()
    {
        $this->dir = FCPATH . 'media/uploads/avatars/';
    }

    /**
     * Validiert, normalisiert und speichert das Avatar-Bild.
     *
     * @return string relativer Pfad (z.B. `/media/uploads/avatars/ab12….webp`)
     *
     * @throws ApiException validation_error | file_too_large | unsupported_media_type
     */
    public function storeAvatar(?UploadedFile $file): string
    {
        if ($file === null || ! $file->isValid()) {
            throw ApiException::validation(['file' => 'Bitte eine Bilddatei auswählen.'], 'Es wurde keine gültige Datei hochgeladen.');
        }
        if ($file->getSize() > self::MAX_BYTES) {
            throw new ApiException('file_too_large', 'Das Bild ist zu groß (max. 5 MB).', 400);
        }
        // getMimeType() nutzt finfo auf der echten Datei — kein vertrauenswürdiger Client-Header.
        if (! isset(self::ALLOWED[$file->getMimeType()])) {
            throw new ApiException('unsupported_media_type', 'Nur JPEG, PNG oder WebP sind erlaubt.', 415);
        }

        $source = @imagecreatefromstring((string) file_get_contents($file->getTempName()));
        if ($source === false) {
            throw new ApiException('unsupported_media_type', 'Die Datei ist kein lesbares Bild.', 415);
        }

        $this->ensureHardenedDir();

        $name = bin2hex(random_bytes(16));
        $this->writeSquareWebp($source, self::MAIN_SIZE, $this->dir . $name . '.webp');
        $this->writeSquareWebp($source, self::THUMB_SIZE, $this->dir . $name . '_thumb.webp');
        imagedestroy($source);

        return '/media/uploads/avatars/' . $name . '.webp';
    }

    /** Entfernt Haupt- und Thumbnail-Datei zu einem `avatar_path` (idempotent). */
    public function deleteAvatar(?string $avatarPath): void
    {
        if ($avatarPath === null || ! str_starts_with($avatarPath, '/media/uploads/avatars/')) {
            return;
        }
        $main = FCPATH . ltrim($avatarPath, '/');
        foreach ([$main, preg_replace('/\.webp$/', '_thumb.webp', $main)] as $path) {
            if (is_file($path)) {
                @unlink($path);
            }
        }
    }

    /**
     * Upload-Verzeichnis anlegen und gegen PHP-Ausführung härten (06-backend §7). Das `.htaccess` wird
     * im Code gehalten (nicht im Repo), weil `public/` Build-/Laufzeit-Output ist (`public/.gitignore = *`)
     * — so existiert die Härtung garantiert in jeder Umgebung, sobald hochgeladen wird.
     */
    private function ensureHardenedDir(): void
    {
        if (! is_dir($this->dir)) {
            mkdir($this->dir, 0775, true);
        }
        $htaccess = $this->dir . '.htaccess';
        if (! is_file($htaccess)) {
            file_put_contents(
                $htaccess,
                "# Nutzer-Uploads: nur statische Auslieferung, niemals PHP ausführen.\n"
                . "php_flag engine off\n"
                . "RemoveHandler .php .phtml .php3 .php4 .php5 .php7 .php8 .phps\n"
                . "RemoveType .php .phtml .php3 .php4 .php5 .php7 .php8 .phps\n"
            );
        }
    }

    /** Quadratischer Center-Crop des Quellbilds, auf $size skaliert, als WebP geschrieben. */
    private function writeSquareWebp(GdImage $source, int $size, string $path): void
    {
        $w   = imagesx($source);
        $h   = imagesy($source);
        $min = min($w, $h);
        $sx  = (int) (($w - $min) / 2);
        $sy  = (int) (($h - $min) / 2);

        $canvas = imagecreatetruecolor($size, $size);
        imagecopyresampled($canvas, $source, 0, 0, $sx, $sy, $size, $size, $min, $min);
        imagewebp($canvas, $path, 82);
        imagedestroy($canvas);
    }
}
