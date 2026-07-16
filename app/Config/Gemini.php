<?php

namespace Config;

use CodeIgniter\Config\BaseConfig;

/**
 * Gemini-API-Zugang für das KI-Flug-Briefing (ADR-018). Beide Werte werden per `.env`
 * überschrieben (`gemini.apiKey` / `gemini.model`); der Key liegt **nur** in `.env` bzw.
 * `env.prod` (beide gitignored) und verlässt den Server nie Richtung Browser.
 *
 * Kostenlosen Key erstellen: https://aistudio.google.com/apikey
 * Ohne Key bleibt die App voll funktionsfähig — das Briefing meldet dann `not_configured`.
 */
class Gemini extends BaseConfig
{
    /** Leer = Feature nicht eingerichtet (Briefing-Endpunkt antwortet mit `not_configured`). */
    public string $apiKey = '';

    /**
     * Frei-Kontingent und Modell-Zugang variieren je Key (ältere Modelle sind für neue Keys
     * gesperrt) — deshalb konfigurierbar. `gemini-flash-lite-latest` ist Googles Evergreen-Alias
     * auf das jeweils aktuelle Flash-Lite-Modell: funktioniert auch für frische Keys und
     * antwortet für 2–3 Sätze in unter einer Sekunde — die größeren Flash-Modelle „denken"
     * selbst bei Mini-Prompts 12–15 s und rissen unser 15-s-Timeout.
     */
    public string $model = 'gemini-flash-lite-latest';
}
