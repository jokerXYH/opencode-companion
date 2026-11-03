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
    const count = db
      .query("select count(*) as n from session_message where session_id = ? and type = 'assistant'")
      .get(sessionID) as { n: number } | null
    return {
      cost: row.cost ?? 0,
      fresh: row.tokens_input ?? 0,
      cache: row.tokens_cache_read ?? 0,
      output: (row.tokens_output ?? 0) + (row.tokens_reasoning ?? 0),
      requests: count?.n ?? 0,
    }
  })
}

function paceLine(percent: number, resetsAt: string | undefined, now: number): string {
  if (!resetsAt) return ""
  const end = new Date(resetsAt).getTime()
  if (Number.isNaN(end)) return ""
  const period = 30 * 86400_000
  const start = end - period
  const elapsed = Math.max(0, now - start)
  const elapsedPct = Math.min(100, (elapsed / period) * 100)
  if (elapsedPct < 1) return ""
  const ratio = percent / elapsedPct
  if (percent >= 100) return "本月额度已用尽"
  if (ratio >= 1) {
    const daysLeft = ((100 - percent) / (percent / Math.max(elapsed, 1))) / 86400_000
    return `按当前速度约 ${Math.max(1, Math.round(daysLeft))} 天后用尽，建议放慢`
  }
  const projected = Math.round((ratio * 100) / 100 * 100)
  return `按当前速度本月约用到 ${projected}%，安全`
}

async function collect(sessionID?: string) {
  const now = Date.now()
  const peak = peakStatus(now)
  const { token, email } = activeToken()
  const usage = await fetchUsage(token)
  const monthly = usage?.monthly?.percent ?? 0
  const rolling = usage?.rolling?.percent ?? 0
  const weekly = usage?.weekly?.percent ?? 0
  const remaining = Math.max(0, 100 - monthly)

  const session = sessionID ? sessionStats(sessionID) : undefined
  const hit = session ? pctHit(session.cache, session.fresh) : "-"
  const cost = session ? `$${session.cost.toFixed(2)}` : "-"

  const warnings: string[] = []
  if (session) {
    const total = session.cache + session.fresh
    const hitPct = total === 0 ? 100 : (session.cache / total) * 100
    const avgContext = session.cache / Math.max(1, session.requests)
    if (session.requests >= 30)
      warnings.push(`本次会话已 ${session.requests} 轮，上下文越长每轮越贵 —— 建议开新会话`)
    if (session.requests > 3 && hitPct < 90)
      warnings.push(`命中率 ${hitPct.toFixed(1)}% 低于 90% —— 检查是否中途换过模型或改过配置`)
    if (avgContext > 150_000)
      warnings.push(`平均上下文 ${Math.round(avgContext / 1000)}K，偏大 —— 建议 /compact 或开新会话`)
  }
  if (peak.peak) warnings.push("高峰时段 2 倍计价 —— 非急事可等空闲再干")
  if (remaining < 20) warnings.push(`本月额度仅剩 ${remaining}% —— 优先用免费模型或等重置`)

  const timeLine = peak.peak
    ? `高峰（${peak.detail}）— 当前 2 倍计价，非急事建议等空闲`
    : `空闲（${peak.detail}）— 当前半价`
  const sessionLine = session
    ? `本次对话 命中 ${hit} · 费用 ${cost} · ${session.requests} 轮 · 输入 ${millions(session.fresh)} · 缓存读 ${millions(session.cache)} · 输出 ${millions(session.output)}`
    : "本次对话：暂无记录（发一条消息后出现）"

  const pace = paceLine(monthly, usage?.monthly?.resetsAt, now)
  const tone = monthly >= 90 || warnings.length >= 2 ? "danger" : warnings.length > 0 || monthly >= 70 || rolling >= 70 ? "warning" : "info"

  return {
    label: `${warnings.length > 0 ? "⚠ " : ""}${peak.peak ? "🔴" : "🟢"} 命中 ${hit} · 本月剩 ${remaining}%`,
    tone,
    lines: [
      ...(warnings.length > 0 ? warnings.map((w) => `⚠ ${w}`) : []),
      `当前时段：${timeLine}`,
      sessionLine,
      `额度：5小时 ${rolling}% · 每周 ${weekly}% · 每月 ${monthly}%（剩 ${remaining}%）`,
      `重置：${usage?.monthly ? fmtReset(usage.monthly.resetsAt) : "-"}${pace ? " · " + pace : ""}`,
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
        execute: async (_input: unknown, context: { sessionID?: string }) => {
          const data = await collect(context?.sessionID)
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
