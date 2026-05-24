import type { TaskType } from '../api/types'

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  multiple_choice: 'Multiple Choice',
  exact_text: 'Lösungswort / Code',
  numeric_estimate: 'Schätzaufgabe',
  free_text: 'Freitext',
  photo_upload: 'Foto-Upload',
  gps_checkin: 'GPS-Check-in',
  onsite_time: 'Zeitmessung (vor Ort)',
  onsite_points: 'Punkte (vor Ort)',
}

export const TASK_TYPE_HINT: Record<TaskType, string> = {
  multiple_choice: 'Wird automatisch ausgewertet.',
  exact_text: 'Wird automatisch ausgewertet.',
  numeric_estimate: 'Rangbasiert – am nächsten dran gewinnt.',
  free_text: 'Wird von der Spielleitung geprüft.',
  photo_upload: 'Wird von der Spielleitung geprüft.',
  gps_checkin: 'Check-in vor Ort per Standort.',
  onsite_time: 'Zeit wird vor Ort per QR-Scan eingetragen.',
  onsite_points: 'Punkte werden vor Ort per QR-Scan eingetragen.',
}

/** Typen, bei denen der Teilnehmer einen QR-Code für die Aufsicht zeigt. */
export const ONSITE_TYPES: TaskType[] = ['onsite_time', 'onsite_points']
