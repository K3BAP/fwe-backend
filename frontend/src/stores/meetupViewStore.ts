import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type MeetupView = 'cards' | 'table' | 'map'

type MeetupViewState = {
  view: MeetupView
  setView: (v: MeetupView) => void
}

/**
 * Ansichts-Wahl der Flugtreffen-Übersicht (Cards/Tabelle/Karte). Reiner Client-State, in
 * `localStorage` persistiert (02-flugtreffen.md §5, Default `cards`). Bewusst **getrennt** vom
 * Filter-/Suchzustand, der in der URL lebt — so überlebt die Ansicht Reloads, ohne die teilbare
 * Filter-URL zu verändern.
 */
export const useMeetupViewStore = create<MeetupViewState>()(
  persist(
    (set) => ({
      view: 'cards',
      setView: (view) => set({ view }),
    }),
    { name: 'flightmeet-meetup-view' },
  ),
)
