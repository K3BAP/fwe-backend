<?php

/**
 * Deutsche Übersetzung der CI4-Validierungsregeln, die die Auth-/Profile-Eingaben spiegeln
 * (06-backend §5; defaultLocale = 'de'). Nur die tatsächlich genutzten Regeln sind überschrieben;
 * fehlende Schlüssel fallen automatisch auf das englische Original zurück. Feldspezifische
 * Meldungen setzen die Controller zusätzlich direkt im Regel-Array.
 */
return [
    'required'         => 'Das Feld {field} ist erforderlich.',
    'min_length'       => 'Das Feld {field} muss mindestens {param} Zeichen lang sein.',
    'max_length'       => 'Das Feld {field} darf höchstens {param} Zeichen lang sein.',
    'valid_email'      => 'Bitte gib eine gültige E-Mail-Adresse an.',
    'is_unique'        => 'Dieser Wert für {field} ist bereits vergeben.',
    'regex_match'      => 'Das Feld {field} hat ein ungültiges Format.',
    'in_list'          => 'Der Wert für {field} ist ungültig.',
    'integer'          => 'Das Feld {field} muss eine ganze Zahl sein.',
    'greater_than_equal_to' => 'Das Feld {field} muss mindestens {param} sein.',
    'permit_empty'     => '',
];
