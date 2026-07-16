import type { MeetupBriefing } from '@/api/schemas'

/**
 * Mock-Briefings der Daten-Naht (ADR-016/018). Die drei Texte folgen den Wetterlagen des
 * Wetter-Mocks (`meetupId % 3`: ruhig / kräftig / gewittrig) und halten sich — wie die echte
 * System-Instruktion — an die Regel: Daten beschreiben, keine Flugempfehlung aussprechen.
 */
const TEXTS = [
  'Am Startplatz weht ein leichter Südwestwind um 9 km/h mit Böen bis 14 km/h. Der Himmel bleibt weitgehend klar bei rund 21 Grad, Regen ist keiner gemeldet.',
  'Der Wind frischt im Tagesverlauf auf rund 24 km/h auf, die Böen erreichen etwa 34 km/h aus Südwest. Bei bedecktem Himmel bleibt es mit gut 20 Grad mild und trocken.',
  'Die Modelle zeigen Gewitterneigung mit hoher CAPE und einer Regenwahrscheinlichkeit um 70 Prozent. Der Bodenwind liegt bei etwa 16 km/h, in Böen um 29 km/h, bei dichter Bewölkung.',
]

export const briefingTable = {
  forMeetup(meetupId: number, startsAt: string): MeetupBriefing {
    if (new Date(startsAt).getTime() < Date.now() - 2 * 3600_000) {
      return { available: false, reason: 'past', text: null, generated_at: null }
    }

    return {
      available: true,
      reason: null,
      text: TEXTS[meetupId % TEXTS.length],
      generated_at: new Date().toISOString(),
    }
  },
}
