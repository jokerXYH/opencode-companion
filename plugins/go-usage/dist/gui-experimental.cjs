const { ComposerPill, Plugin } = require("@opencode/plugin/gui")
const { Rpc } = require("@opencode/plugin/rpc")
const { createSignal } = require("solid-js")

// Must match rpc.cjs: the GUI bundle may only require modules the app shares,
// so the contract is repeated here instead of imported from a relative file.
const GoUsage = Rpc.define({
  id: "go-usage",
  methods: {
    stats: {
      input: {
        type: "object",
        properties: { sessionID: { type: "string" } },
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          label: { type: "string" },
          tone: { type: "string" },
          lines: { type: "array", items: { type: "string" } },
        },
        required: ["label", "tone", "lines"],
        additionalProperties: false,
      },
      errors: {},
    },
  },
  events: {},
})

const REFRESH_MS = 5000
const CALL_TIMEOUT_MS = 8000
const EVENT_DEBOUNCE_MS = 800

module.exports = Plugin.define({
  setup(ctx) {
    const [stats, setStats] = createSignal({
      label: "Go … 读取中",
      tone: "info",
      lines: ["正在读取用量"],
    })

    let busy = false
    let disposed = false
    let debounce

    const refresh = async () => {
      if (busy || disposed) return
      const session = ctx.sessions.current()
      if (!session) return
      busy = true
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS)
      try {
        const next = await ctx.client.rpc(GoUsage).stats({ sessionID: session.id }, { signal: controller.signal })
        if (!disposed) setStats(next)
      } catch (error) {
        if (disposed) return
        const detail = String((error && (error.message || error._tag || error.type)) || error)
        setStats({
          label: `Go 用量不可用：${detail.slice(0, 60)}`,
          tone: "warning",
          lines: [detail.slice(0, 300)],
        })
      } finally {
        clearTimeout(timer)
        busy = false
      }
    }

    // 会话用量变化时立刻刷新，而不是干等下一轮轮询
    const schedule = () => {
      if (disposed) return
      clearTimeout(debounce)
      debounce = setTimeout(() => void refresh(), EVENT_DEBOUNCE_MS)
    }

    // 窗口重新获得焦点时立刻刷新：后台窗口的定时器会被浏览器降频
    const onVisible = () => {
      if (typeof document !== "undefined" && document.hidden) return
      void refresh()
    }

    const events = new AbortController()
    const listen = async () => {
      const subscribe = ctx.client.event && ctx.client.event.subscribe
      if (typeof subscribe !== "function") return
      try {
        for await (const _event of ctx.client.event.subscribe({
          types: ["session.usage.updated", "session.execution.succeeded", "session.idle"],
          signal: events.signal,
        })) {
          schedule()
        }
      } catch {
        // 事件流断开后仍靠轮询兜底
      }
    }
    void listen()

    void refresh()
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.hidden) return
      void refresh()
    }, REFRESH_MS)

    if (typeof window !== "undefined") window.addEventListener("focus", onVisible)
    if (typeof document !== "undefined") document.addEventListener("visibilitychange", onVisible)

    ctx.add(ComposerPill, {
      id: "go-usage",
      order: 5,
      show: () => {
        const current = stats()
        const tone = current.tone === "danger" ? "danger" : current.tone === "warning" ? "warning" : undefined
        return {
          // 警告本身用图标表达，文字标签里不再重复 ⚠
          label: tone ? current.label.replace(/^⚠\s*/, "") : current.label,
          // tone 只给图标上色，所以警告必须带 icon 才看得见颜色
          icon: tone ? "warning" : undefined,
          tone,
          title: "OpenCode Go · 本次对话",
          rows: current.lines.map((line, index) => ({ id: String(index), label: line })),
        }
      },
    })

    return () => {
      disposed = true
      clearInterval(timer)
      clearTimeout(debounce)
      events.abort()
      if (typeof window !== "undefined") window.removeEventListener("focus", onVisible)
      if (typeof document !== "undefined") document.removeEventListener("visibilitychange", onVisible)
    }
  },
})
