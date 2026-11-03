import { Plugin } from "@opencode/plugin"
import { Database } from "bun:sqlite"
import { homedir } from "node:os"
import { join } from "node:path"
import { GoUsage } from "./rpc.cjs"

const TZ_MS = 8 * 60 * 60 * 1000
const PEAK_WINDOWS: [number, number][] = [
  [9 * 60, 12 * 60],
  [14 * 60, 18 * 60],
]

function hm(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`
}

function peakStatus(now: number) {
  const d = new Date(now + TZ_MS)
  const weekday = d.getUTCDay()
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes()
  const workday = weekday >= 1 && weekday <= 5
  const current = workday ? PEAK_WINDOWS.find(([a, b]) => minutes >= a && minutes < b) : undefined
  if (current) return { peak: true, detail: `${hm(current[1])} 结束` }

  for (let offset = 0; offset <= 7; offset++) {
    const wd = (weekday + offset) % 7
    if (wd === 0 || wd === 6) continue
    for (const [start] of PEAK_WINDOWS) {
      if (offset === 0 && start <= minutes) continue
      const when = offset === 0 ? "今天" : offset === 1 ? "明天" : "下个工作日"
      return { peak: false, detail: `${when} ${hm(start)} 进入高峰` }
    }
  }
  return { peak: false, detail: "" }
}

function dbPath(): string {
  return join(homedir(), ".local", "share", "opencode", "opencode.db")
}

function withDb<T>(fn: (db: Database) => T): T {
  const db = new Database(dbPath(), { readonly: true })
  try {
    return fn(db)
  } finally {
    db.close()
  }
}

function activeToken(): { token: string; email: string } {
  return withDb((db) => {
    const row = db
      .query("select value from credential where integration_id = 'opencode' and active = 1")
      .get() as { value: string } | null
    if (!row) throw new Error("没有已激活的 OpenCode 账号")
    const parsed = JSON.parse(row.value) as { access?: string; metadata?: { email?: string } }
    if (!parsed.access) throw new Error("凭据里没有 access token")
    return { token: parsed.access, email: parsed.metadata?.email ?? "未知账号" }
  })
}

async function fetchUsage(token: string): Promise<any> {
  const res = await fetch("https://opencode.ai/inference/go/v1/usage", {
    headers: { Authorization: `Bearer ${token}`, "User-Agent": "opencode-go-usage/1.2" },
  })
  if (!res.ok) throw new Error(`额度接口返回 ${res.status}`)
  return (await res.json()).usage
}

function fmtReset(iso: string): string {
  const t = new Date(iso)
  if (Number.isNaN(t.getTime())) return iso
  const d = new Date(t.getTime() + TZ_MS)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`
}

function pctHit(cache: number, fresh: number): string {
  const total = cache + fresh
  return total === 0 ? "-" : `${((cache / total) * 100).toFixed(1)}%`
}

function millions(n: number): string {
  return `${(n / 1_000_000).toFixed(2)}M`
}

function sessionStats(sessionID: string) {
  return withDb((db) => {
    const row = db
      .query(
        `select cost, tokens_input, tokens_output, tokens_reasoning, tokens_cache_read
         from session_v2 where id = ?`,
      )
      .get(sessionID) as {
      cost: number | null
      tokens_input: number | null
      tokens_output: number | null
      tokens_reasoning: number | null
      tokens_cache_read: number | null
    } | null
    if (!row) return undefined
    return {
      cost: row.cost ?? 0,
      fresh: row.tokens_input ?? 0,
      cache: row.tokens_cache_read ?? 0,
      output: (row.tokens_output ?? 0) + (row.tokens_reasoning ?? 0),
    }
  })
}

async function collect(sessionID?: string) {
  const now = Date.now()
  const peak = peakStatus(now)
  const { token, email } = activeToken()
  const usage = await fetchUsage(token)
  const monthly = usage?.monthly?.percent ?? 0
  const rolling = usage?.rolling?.percent ?? 0
  const weekly = usage?.weekly?.percent ?? 0

  const session = sessionID ? sessionStats(sessionID) : undefined
  const hit = session ? pctHit(session.cache, session.fresh) : "-"
  const cost = session ? `$${session.cost.toFixed(2)}` : "-"

  const timeLine = `${peak.peak ? "高峰" : "空闲"}${peak.detail ? `（${peak.detail}）` : ""}`
  const sessionLine = session
    ? `本次对话 命中 ${hit} · 费用 ${cost} · 输入 ${millions(session.fresh)} · 缓存读 ${millions(session.cache)} · 输出 ${millions(session.output)}`
    : "本次对话：暂无记录（发一条消息后出现）"

  const tone = monthly >= 90 ? "danger" : peak.peak || monthly >= 70 || rolling >= 70 ? "warning" : "info"

  return {
    label: `${peak.peak ? "🔴 高峰" : "🟢 空闲"} · 本次命中 ${hit} · ${cost}`,
    tone,
    lines: [
      `当前时段：${timeLine}`,
      sessionLine,
      `Go 额度：5小时 ${rolling}% · 每周 ${weekly}% · 每月 ${monthly}%（${usage?.monthly ? fmtReset(usage.monthly.resetsAt) : "-"} 重置）`,
      `账号 ${email}`,
    ],
  }
}

export default Plugin.define({
  id: "go-usage",
  async setup(ctx) {
    const toolRegistration = await ctx.tool.transform((editor) => {
      editor.add({
        name: "go_usage",
        description: "查看 OpenCode Go 套餐额度、当前峰谷时段以及本次对话的命中率与消耗。",
        input: { type: "object", properties: {}, additionalProperties: false },
        execute: async () => {
          const data = await collect()
          return { content: [data.label, ...data.lines].join("\n") }
        },
      })
    })

    const rpcRegistration = await ctx.rpc.register(GoUsage, {
      stats: async (input: { sessionID?: string } | undefined) => collect(input?.sessionID),
    })

    return () => {
      void rpcRegistration.dispose()
      void toolRegistration.dispose()
    }
  },
})
