<?php

use App\Models\SpotModel;
use CodeIgniter\Test\CIUnitTestCase;
use CodeIgniter\Test\DatabaseTestTrait;
use CodeIgniter\Test\FeatureTestTrait;

/**
 * Feature-Tests der Spot-Domäne (M3 Slice 2, API.md §4): öffentliche, read-only Startplatzliste +
 * Detail, Filter über `q`/`region`/`type`. Kein Schreiben im MVP (ADR-012/A4).
 *
 * @internal
 */
final class SpotTest extends CIUnitTestCase
{
    use DatabaseTestTrait;
    use FeatureTestTrait;

    protected $refresh   = true;
    protected $namespace = null;

    /** @param array<string, mixed> $o */
    private function createSpot(array $o = []): int
    {
        return (int) model(SpotModel::class)->insert(array_merge([
            'name'    => 'Testspot ' . bin2hex(random_bytes(3)),
            'region'  => 'Testregion',
            'country' => 'DE',
            'lat'     => 47.5,
            'lng'     => 11.0,
            'type'    => 'launch',
        ], $o), true);
    }

    public function testListReturnsSpotsPublicly(): void
    {
        $this->createSpot(['name' => 'Wasserkuppe', 'region' => 'Rhön']);

        $body = json_decode($this->get('api/v1/spots')->getJSON(), true)['data'];

        $this->assertCount(1, $body);
        $this->assertSame('Wasserkuppe', $body[0]['name']);
        $this->assertSame('Rhön', $body[0]['region']);
        $this->assertArrayHasKey('country', $body[0]);
        $this->assertArrayHasKey('type', $body[0]);
    }

    public function testListFiltersByType(): void
    {
        $this->createSpot(['name' => 'Startplatz A', 'type' => 'launch']);
        $this->createSpot(['name' => 'Gebiet B', 'type' => 'area']);

        $body = json_decode($this->get('api/v1/spots?type=area')->getJSON(), true)['data'];

        $this->assertCount(1, $body);
        $this->assertSame('Gebiet B', $body[0]['name']);
    }

    public function testListFiltersByQuery(): void
    {
        $this->createSpot(['name' => 'Tegelberg', 'region' => 'Allgäu']);
        $this->createSpot(['name' => 'Wasserkuppe', 'region' => 'Rhön']);

        $body = json_decode($this->get('api/v1/spots?q=tegel')->getJSON(), true)['data'];

        $this->assertCount(1, $body);
        $this->assertSame('Tegelberg', $body[0]['name']);
    }

    public function testShowReturnsSpotWithDescription(): void
    {
        $id = $this->createSpot(['name' => 'Brauneck', 'description' => 'Schöner Hang.']);

        $body = json_decode($this->get("api/v1/spots/{$id}")->getJSON(), true)['data'];

        $this->assertSame('Brauneck', $body['name']);
        $this->assertSame('Schöner Hang.', $body['description']);
    }

    public function testShowReturns404ForUnknownSpot(): void
    {
        $this->get('api/v1/spots/9999')->assertStatus(404);
    }
}
