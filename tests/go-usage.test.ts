import assert from "node:assert/strict"
import { test } from "node:test"
import {
  DEFAULT_SETTINGS,
  fmtReset,
  hm,
  millions,
  paceLine,
  parseClock,
  parsePeakWindows,
  pctHit,
  peakStatus,
  readSettings,
} from "../plugins/go-usage/lib.ts"

/** 2026-11-02 is a Monday. */
function utcForLocal(year: number, month: number, day: number, hour: number, minute = 0): number {
  return Date.UTC(year, month - 1, day, hour - 8, minute)
}

test("hm formats minutes as HH:MM", () => {
  assert.equal(hm(0), "00:00")
  assert.equal(hm(9 * 60 + 5), "09:05")
  assert.equal(hm(23 * 60 + 59), "23:59")
})

test("parseClock accepts H:MM and HH:MM", () => {
  assert.equal(parseClock("09:30"), 570)
  assert.equal(parseClock("9:05"), 545)
  assert.equal(parseClock("24:00"), undefined)
  assert.equal(parseClock("09:60"), undefined)
  assert.equal(parseClock("noon"), undefined)
})

test("parsePeakWindows validates, sorts, and falls back", () => {
  assert.deepEqual(parsePeakWindows(["14:00-18:00", "09:00-12:00"]), [
    { start: 540, end: 720 },
    { start: 840, end: 1080 },
  ])
  assert.deepEqual(parsePeakWindows(["18:00-09:00", "bad"]), DEFAULT_SETTINGS.peakWindows)
  assert.deepEqual(parsePeakWindows(undefined), DEFAULT_SETTINGS.peakWindows)
})

test("readSettings applies safe defaults", () => {
  assert.deepEqual(readSettings(), DEFAULT_SETTINGS)
  assert.equal(readSettings({ timezoneOffsetMinutes: 9999 }).timezoneOffsetMinutes, 480)
  assert.equal(readSettings({ warnings: false }).warnings, false)
  assert.deepEqual(readSettings({ workdays: [1, 2, 2, 3] }).workdays, [1, 2, 3])
})

test("peakStatus reports an active peak window", () => {
  const mondayMorning = utcForLocal(2026, 11, 2, 10, 0)
  assert.deepEqual(peakStatus(mondayMorning), { peak: true, detail: "12:00 结束" })
})

test("peakStatus finds the next window today", () => {
  const mondayLunch = utcForLocal(2026, 11, 2, 13, 0)
  assert.deepEqual(peakStatus(mondayLunch), { peak: false, detail: "今天 14:00 进入高峰" })
})

test("peakStatus skips the weekend", () => {
  const fridayEvening = utcForLocal(2026, 11, 6, 19, 0)
  assert.deepEqual(peakStatus(fridayEvening), { peak: false, detail: "下个工作日 09:00 进入高峰" })

  const saturdayMorning = utcForLocal(2026, 11, 7, 10, 0)
  assert.deepEqual(peakStatus(saturdayMorning), { peak: false, detail: "下个工作日 09:00 进入高峰" })
})

test("peakStatus respects a custom timezone", () => {
  const settings = readSettings({ timezoneOffsetMinutes: 0, peakWindows: ["09:00-12:00"] })
  const utcMorning = Date.UTC(2026, 10, 2, 9, 30)
  assert.deepEqual(peakStatus(utcMorning, settings), { peak: true, detail: "12:00 结束" })
})

test("fmtReset renders the configured timezone", () => {
  assert.equal(fmtReset("2026-11-04T00:00:00Z"), "11-04 08:00")
  assert.equal(fmtReset("not-a-date"), "not-a-date")
})

test("pctHit and millions format numbers", () => {
  assert.equal(pctHit(90, 10), "90.0%")
  assert.equal(pctHit(0, 0), "-")
  assert.equal(millions(1_234_567), "1.23M")
})

test("paceLine describes a safe and an unsafe pace", () => {
  const now = Date.UTC(2026, 10, 4)
  const resetsAt = new Date(now + 15 * 86_400_000).toISOString()
  assert.match(paceLine(20, resetsAt, now), /安全/)
  assert.match(paceLine(80, resetsAt, now), /天后用尽/)
  assert.equal(paceLine(100, resetsAt, now), "本月额度已用尽")
  assert.equal(paceLine(20, undefined, now), "")
})
