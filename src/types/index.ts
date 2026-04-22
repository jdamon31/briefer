export type ItemType = 'task' | 'event'
export type ItemStatus = 'inbox' | 'active' | 'done' | 'cancelled'
export type ItemSource = 'manual' | 'siri' | 'api' | 'share_sheet'
export type ItemTag = 'work' | 'personal' | 'errand' | 'family' | 'health' | 'home' | 'social'

export const ALL_TAGS: ItemTag[] = ['work', 'personal', 'errand', 'family', 'health', 'home', 'social']

export const TAG_COLORS: Record<ItemTag, string> = {
  work: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  personal: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  errand: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  family: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
  health: 'bg-green-500/10 text-green-400 border-green-500/20',
  home: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  social: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
}

export interface Item {
  id: string
  user_id: string
  type: ItemType
  title: string
  notes: string | null
  due_at: string | null
  end_at: string | null
  duration_minutes: number | null
  status: ItemStatus
  tags: ItemTag[]
  location: string | null
  raw_input: string | null
  classifier_confidence: number | null
  needs_review: boolean
  source: ItemSource
  google_event_id: string | null
  google_etag: string | null
  sync_pending: boolean
  created_at: string
  updated_at: string
  completed_at: string | null
}

export interface ClassifierResult {
  type: ItemType | 'unclear'
  title: string
  datetime: string | null
  datetime_confidence: 'explicit' | 'inferred' | 'none'
  duration_minutes: number | null
  tags: ItemTag[]
  location: string | null
  notes: string | null
  classifier_confidence: number
  needs_review: boolean
}

export interface UserSettings {
  id: string
  user_id: string
  morning_brief_enabled: boolean
  morning_brief_time: string
  reminders_enabled: boolean
  reminder_times: string[]
  default_event_duration_minutes: number
}

export interface Integration {
  id: string
  user_id: string
  provider: 'google_calendar'
  calendar_id: string | null
  connected_at: string | null
  last_synced_at: string | null
  broken: boolean
}

export interface User {
  id: string
  display_name: string | null
  timezone: string
  email?: string
}
