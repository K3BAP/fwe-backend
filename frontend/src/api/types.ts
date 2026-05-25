export type TaskType =
  | 'multiple_choice'
  | 'exact_text'
  | 'numeric_estimate'
  | 'free_text'
  | 'photo_upload'
  | 'gps_checkin'
  | 'onsite_time'
  | 'onsite_points'

export type SubmissionStatus = 'pending' | 'correct' | 'incorrect' | 'evaluated'
export type RallyeStatus = 'draft' | 'active' | 'finished'

export interface Rallye {
  id: number
  title: string
  description: string | null
  theme: string | null
  join_code: string
  status: RallyeStatus
  teams_enabled: boolean
  max_team_size: number | null
  preset_team_count: number | null
}

export interface Participant {
  id: number
  rallye_id: number
  team_id: number | null
  display_name: string
}

export interface Team {
  id: number
  name: string
  is_solo?: number
  member_count?: number
}

export interface TaskSubmission {
  status: SubmissionStatus
  points: number | null
  answer_text: string | null
  answer_number: string | null
  answer_choice: number | null
  has_photo: boolean
  submitted_at: string
}

export interface ParticipantTask {
  id: number
  type: TaskType
  title: string
  prompt: string | null
  position: number
  max_points: number
  options: string[] | null
  submission: TaskSubmission | null
}

export interface LeaderboardRow {
  rank: number
  team_id: number
  name: string
  total: number
}

// --- Admin-Seite ---
export interface TaskConfig {
  choices?: string[]
  correct_index?: number
  accepted?: string[]
  sample_solutions?: string[]
  target?: number
  tolerance?: number
  lat?: number
  lng?: number
  radius_m?: number
}

export interface AdminTask {
  id: number
  rallye_id: number
  type: TaskType
  title: string
  prompt: string | null
  position: number
  max_points: number
  config: TaskConfig
}

export interface PendingSubmission {
  id: number
  task_id: number
  team_id: number
  task_title: string
  task_type: TaskType
  task_max_points: number
  team_name: string
  answer_text: string | null
  photo_url: string | null
  submitted_at: string
}

export interface AdminLeaderboardTask {
  id: number
  title: string
  type: TaskType
  max_points: number
}

export interface TaskScore {
  status: SubmissionStatus
  points: number | null
}

export interface AdminLeaderboard {
  leaderboard: LeaderboardRow[]
  tasks: AdminLeaderboardTask[]
  breakdowns: Record<number, Record<number, TaskScore>>
}

export interface AdminUser {
  id: number
  username: string
  created_at: string
}

export interface AdminParticipant {
  id: number
  display_name: string
  team_id: number | null
  team_name: string | null
  created_at: string
}
