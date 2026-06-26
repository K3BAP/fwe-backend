<?php

use CodeIgniter\Exceptions\PageNotFoundException;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * Smoke-Tests des `/api/v1`-Fundaments (M2 Slice 1): Migrations laufen frisch durch (FK-Typen
 * konsistent, sonst schlüge der Refresh fehl), der Erfolgs-Envelope stimmt, das CSRF-Token wird
 * geliefert und geschützte Routen verlangen ohne Session eine `401`-JSON-Antwort.
 *
 * @internal
 */
final class ApiFoundationTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $refresh   = true; // Migrations pro Test frisch (06-backend §16: Migrations = Wahrheit)
    protected $namespace = null; // alle Namespaces migrieren (CodeIgniter\Shield + CodeIgniter\Settings + App)

    public function testHealthReturnsSuccessEnvelope(): void
    {
        $result = $this->get('api/v1/health');

        $result->assertStatus(200);
        $result->assertJSONExact(['data' => ['status' => 'ok']]);
    }

    public function testCsrfEndpointReturnsToken(): void
    {
        $result = $this->get('api/v1/auth/csrf');

        $result->assertStatus(200);
        $body = json_decode($result->getJSON(), true);
        $this->assertArrayHasKey('token', $body['data']);
        $this->assertNotEmpty($body['data']['token']);
    }

    public function testProtectedRouteWithoutSessionReturns401(): void
    {
        $result = $this->get('api/v1/health/secure');

        $result->assertStatus(401);
        $body = json_decode($result->getJSON(), true);
        $this->assertSame('unauthenticated', $body['error']['code']);
    }

    /**
     * Auto-Routing ist aus (nur definierte Routen existieren) → eine unbekannte Route wirft
     * PageNotFoundException. Die JSON-`404`-Envelope-Übersetzung passiert im Exceptions-Handler, den
     * der FeatureTest-Harness umgeht; sie ist gegen den laufenden Server (curl) verifiziert.
     */
    public function testUnknownApiRouteIsNotRouted(): void
    {
        $this->expectException(PageNotFoundException::class);
        $this->get('api/v1/does-not-exist');
    }
}
