import { Plugin } from "@opencode/plugin"
import { Database } from "bun:sqlite"
import { existsSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"
import { GoUsage } from "./rpc"
import {
  fmtReset,
  millions,
  paceLine,
  pctHit,
  peakStatus,
  readSettings,
  type GoUsageSettings,
} from "./lib"

const USAGE_URL = "https://opencode.ai/inference/go/v1/usage"
const USER_AGENT = "opencode-companion-go-usage/1.0.1"
const REQUEST_TIMEOUT_MS = 8_000

interface UsageWindow {
  percent?: number
  resetsAt?: string
}

interface UsagePayload {
  rolling?: UsageWindow
  weekly?: UsageWindow
  monthly?: UsageWindow
}

interface SessionStats {
  cost: number
  fresh: number
  cache: number
  output: number
  requests: number
}

interface CollectedUsage {
  label: string
  tone: "info" | "warning" | "danger"
  lines: string[]
}

function dbPath(): string {
  const dataHome = process.env.XDG_DATA_HOME
  const base = dataHome ? join(dataHome, "opencode") : join(homedir(), ".local", "share", "opencode")
  return join(base, "opencode.db")
}

function withDb<T>(fn: (db: Database) => T): T {
  const path = dbPath()
  if (!existsSync(path)) {
    throw new Error(`OpenCode data database not found at ${path}. Start OpenCode once, then retry.`)
  }

  const db = new Database(path, { readonly: true })
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
    if (!row) throw new Error("No active OpenCode Console account. Sign in with /connect or opencode auth login.")

    const parsed = JSON.parse(row.value) as { access?: string; metadata?: { email?: string } }
    if (!parsed.access) throw new Error("The active OpenCode credential has no access token.")

    // The token is only used for this request. It is never logged or persisted.
    return { token: parsed.access, email: parsed.metadata?.email ?? "unknown account" }
  })
}

async function fetchUsage(token: string): Promise<UsagePayload> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(USAGE_URL, {
      headers: {
        Authorization: `Bearer ${token}`,
        "User-Agent": USER_AGENT,
        "Cache-Control": "no-cache",
      },
      cache: "no-store",
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`Usage endpoint returned HTTP ${response.status}.`)

    const body = (await response.json()) as { usage?: UsagePayload }
    if (!body?.usage) throw new Error("Usage endpoint returned an empty payload.")
    return body.usage
  } finally {
    clearTimeout(timer)
  }
}

function sessionStats(sessionID: string): SessionStats | undefined {
  try {
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
  } catch {
    // A schema change should not hide account usage. Show what we can.
    return undefined
  }
}

function percent(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0
}

function warningsFor(session: SessionStats | undefined, peak: boolean, remaining: number): string[] {
  const warnings: string[] = []
  if (session) {
    const total = session.cache + session.fresh
    const hitPct = total === 0 ? 100 : (session.cache / total) * 100
    const avgContext = session.cache / Math.max(1, session.requests)

    if (session.requests >= 30) {
      warnings.push(`本次会话已 ${session.requests} 轮，上下文越长每轮越贵 —— 建议开新会话`)
    }
    if (session.requests > 3 && hitPct < 90) {
      warnings.push(`命中率 ${hitPct.toFixed(1)}% 低于 90% —— 检查是否中途换过模型或改过配置`)
    }
    if (avgContext > 150_000) {
      warnings.push(`平均上下文 ${Math.round(avgContext / 1000)}K，偏大 —— 建议 /compact 或开新会话`)
    }
  }
  if (peak) warnings.push("高峰时段 2 倍计价 —— 非急事可等空闲再干")
  if (remaining < 20) warnings.push(`本月额度仅剩 ${remaining}% —— 优先用免费模型或等重置`)
  return warnings
}

async function collect(sessionID: string | undefined, settings: GoUsageSettings): Promise<CollectedUsage> {
  const now = Date.now()
  const peak = peakStatus(now, settings)
  const { token, email } = activeToken()
  const usage = await fetchUsage(token)

  const monthly = percent(usage.monthly?.percent)
  const rolling = percent(usage.rolling?.percent)
  const weekly = percent(usage.weekly?.percent)
  const remaining = Math.max(0, 100 - monthly)

  const session = sessionID ? sessionStats(sessionID) : undefined
  const hit = session ? pctHit(session.cache, session.fresh) : "-"
  const cost = session ? `$${session.cost.toFixed(2)}` : "-"

  const warnings = settings.warnings ? warningsFor(session, peak.peak, remaining) : []
  const timeLine = peak.peak
    ? `高峰（${peak.detail}）— 当前 2 倍计价，非急事建议等空闲`
    : `空闲（${peak.detail}）— 当前半价`
  const sessionLine = session
    ? `本次对话 命中 ${hit} · 费用 ${cost} · ${session.requests} 轮 · 输入 ${millions(session.fresh)} · 缓存读 ${millions(session.cache)} · 输出 ${millions(session.output)}`
    : "本次对话：暂无记录（发一条消息后出现）"

  const pace = paceLine(monthly, usage.monthly?.resetsAt, now)
  const tone: CollectedUsage["tone"] =
    monthly >= 90 || warnings.length >= 2 ? "danger" : warnings.length > 0 || monthly >= 70 || rolling >= 70 ? "warning" : "info"

  return {
    label: `${warnings.length > 0 ? "⚠ " : ""}${peak.peak ? "🔴" : "🟢"} 命中 ${hit} · 本月剩 ${remaining}%`,
    tone,
    lines: [
      ...(warnings.length > 0 ? warnings.map((warning) => `⚠ ${warning}`) : []),
      `当前时段：${timeLine}`,
      sessionLine,
      `额度：5小时 ${rolling}% · 每周 ${weekly}% · 每月 ${monthly}%（剩 ${remaining}%）`,
      `重置：${usage.monthly ? fmtReset(usage.monthly.resetsAt ?? "", settings) : "-"}${pace ? " · " + pace : ""}`,
      `账号 ${email}`,
    ],
  }
}

export default Plugin.define({
  id: "go-usage",
  async setup(ctx) {
    const settings = readSettings(ctx.options ?? {})

    const toolRegistration = await ctx.tool.transform((editor) => {
      editor.add({
        name: "go_usage",
        description: "查看 OpenCode Go 套餐额度、当前峰谷时段以及本次对话的命中率与消耗。",
        input: { type: "object", properties: {}, additionalProperties: false },
        execute: async (_input: unknown, context: { sessionID?: string }) => {
          const data = await collect(context?.sessionID, settings)
          return { content: [data.label, ...data.lines].join("\n") }
        },
      })
    })

    const rpcRegistration = await ctx.rpc.register(GoUsage, {
      stats: async (input: unknown) => {
        const sessionID = (input as { sessionID?: string } | undefined)?.sessionID
        return collect(sessionID, settings)
      },
    })

    return () => {
      void rpcRegistration.dispose()
      void toolRegistration.dispose()
    }
  },
})
