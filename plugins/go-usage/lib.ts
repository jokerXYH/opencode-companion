/**
 * Pure helpers for the go-usage plugin.
 *
 * Everything in this file is independent of OpenCode and the local database, so
 * it can be unit tested without a running OpenCode instance.
 */

export interface PeakWindow {
  /** Minutes since local midnight, inclusive. */
  start: number
  /** Minutes since local midnight, exclusive. */
  end: number
}

export interface GoUsageSettings {
  /** Offset from UTC in minutes. Defaults to UTC+8 (480). */
  timezoneOffsetMinutes: number
  /** Daily peak windows in local time. */
  peakWindows: PeakWindow[]
  /** ISO weekday numbers (0 = Sunday) that count as workdays. */
  workdays: number[]
  /** Show session-level discipline warnings. */
  warnings: boolean
}

export interface PeakStatus {
  peak: boolean
  detail: string
}

export const DEFAULT_PEAK_WINDOWS = ["09:00-12:00", "14:00-18:00"] as const
export const DEFAULT_WORKDAYS = [1, 2, 3, 4, 5] as const
export const DEFAULT_TIMEZONE_OFFSET_MINUTES = 8 * 60

export const DEFAULT_SETTINGS: GoUsageSettings = {
  timezoneOffsetMinutes: DEFAULT_TIMEZONE_OFFSET_MINUTES,
  peakWindows: [
    { start: 9 * 60, end: 12 * 60 },
    { start: 14 * 60, end: 18 * 60 },
  ],
  workdays: [...DEFAULT_WORKDAYS],
  warnings: true,
}

export function hm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

/** Parse "HH:MM" or "H:MM" into minutes since midnight. */
export function parseClock(value: string): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim())
  if (!match) return undefined
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour > 23 || minute > 59) return undefined
  return hour * 60 + minute
}

/** Parse ["09:00-12:00", ...] into sorted peak windows, falling back to defaults. */
export function parsePeakWindows(values: unknown): PeakWindow[] {
  if (!Array.isArray(values)) return DEFAULT_SETTINGS.peakWindows.map((window) => ({ ...window }))

  const windows: PeakWindow[] = []
  for (const value of values) {
    if (typeof value !== "string") continue
    const [rawStart, rawEnd] = value.split("-")
    if (!rawStart || !rawEnd) continue
    const start = parseClock(rawStart)
    const end = parseClock(rawEnd)
    if (start === undefined || end === undefined || end <= start) continue
    windows.push({ start, end })
  }

  if (windows.length === 0) return DEFAULT_SETTINGS.peakWindows.map((window) => ({ ...window }))
  return windows.sort((a, b) => a.start - b.start)
}

function numberInRange(value: unknown, fallback: number, min: number, max: number): number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max ? value : fallback
}

/** Normalize plugin options into settings. Unknown or invalid values fall back safely. */
export function readSettings(options: Record<string, unknown> = {}): GoUsageSettings {
  const timezoneOffsetMinutes = numberInRange(
    options.timezoneOffsetMinutes,
    DEFAULT_TIMEZONE_OFFSET_MINUTES,
    -12 * 60,
    14 * 60,
  )

  const workdays = Array.isArray(options.workdays)
    ? [...new Set(options.workdays.filter((day): day is number => Number.isInteger(day) && day >= 0 && day <= 6))]
    : [...DEFAULT_WORKDAYS]

  return {
    timezoneOffsetMinutes,
    peakWindows: parsePeakWindows(options.peakWindows),
    workdays: workdays.length > 0 ? workdays.sort((a, b) => a - b) : [...DEFAULT_WORKDAYS],
    warnings: options.warnings !== false,
  }
}

function localParts(now: number, settings: GoUsageSettings) {
  const date = new Date(now + settings.timezoneOffsetMinutes * 60_000)
  return {
    weekday: date.getUTCDay(),
    minutes: date.getUTCHours() * 60 + date.getUTCMinutes(),
  }
}

/** Describe the current peak/off-peak state and the next transition. */
export function peakStatus(now: number, settings: GoUsageSettings = DEFAULT_SETTINGS): PeakStatus {
  const { weekday, minutes } = localParts(now, settings)

  if (settings.workdays.includes(weekday)) {
    const current = settings.peakWindows.find(({ start, end }) => start <= minutes && minutes < end)
    if (current) return { peak: true, detail: `${hm(current.end)} 结束` }
  }

  for (let offset = 0; offset <= 7; offset++) {
    const candidate = (weekday + offset) % 7
    if (!settings.workdays.includes(candidate)) continue
    for (const { start } of settings.peakWindows) {
      if (offset === 0 && start <= minutes) continue
      const when = offset === 0 ? "今天" : offset === 1 ? "明天" : "下个工作日"
      return { peak: false, detail: `${when} ${hm(start)} 进入高峰` }
    }
  }

  return { peak: false, detail: "" }
}

/** Format an ISO timestamp in the configured timezone. */
export function fmtReset(iso: string, settings: GoUsageSettings = DEFAULT_SETTINGS): string {
  const time = new Date(iso)
  if (Number.isNaN(time.getTime())) return iso
  const date = new Date(time.getTime() + settings.timezoneOffsetMinutes * 60_000)
  const pad = (value: number) => String(value).padStart(2, "0")
  return `${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

/** Cache hit rate as a percentage string, or "-" when there is no data. */
export function pctHit(cache: number, fresh: number): string {
  const total = cache + fresh
  return total === 0 ? "-" : `${((cache / total) * 100).toFixed(1)}%`
}

export function millions(value: number): string {
  return `${(value / 1_000_000).toFixed(2)}M`
}

/** Project month-end usage from the current pace. */
export function paceLine(percent: number, resetsAt: string | undefined, now: number): string {
  if (!resetsAt) return ""
  const end = new Date(resetsAt).getTime()
  if (Number.isNaN(end)) return ""

  const period = 30 * 86_400_000
  const start = end - period
  const elapsed = Math.max(0, now - start)
  const elapsedPct = Math.min(100, (elapsed / period) * 100)
  if (elapsedPct < 1) return ""

  const ratio = percent / elapsedPct
  if (percent >= 100) return "本月额度已用尽"
  if (ratio >= 1) {
    const daysLeft = (100 - percent) / (percent / Math.max(elapsed, 1)) / 86_400_000
    return `按当前速度约 ${Math.max(1, Math.round(daysLeft))} 天后用尽，建议放慢`
  }

  return `按当前速度本月约用到 ${Math.round(ratio * 100)}%，安全`
}
