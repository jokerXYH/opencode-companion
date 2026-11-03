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

module.exports = Plugin.define({
  setup(ctx) {
    const [stats, setStats] = createSignal({
      label: "Go … 读取中",
      tone: "info",
      lines: ["正在读取用量"],
    })

    let busy = false

    const refresh = async () => {
      if (busy) return
      const session = ctx.sessions.current()
      if (!session) return
      busy = true
      try {
        const next = await ctx.client.rpc(GoUsage).stats({ sessionID: session.id })
        setStats(next)
      } catch (error) {
        const detail = String((error && (error.message || error._tag || error.type)) || error)
        setStats({
          label: `Go 用量不可用：${detail.slice(0, 60)}`,
          tone: "warning",
          lines: [detail.slice(0, 300)],
        })
      } finally {
        busy = false
      }
    }

    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)

    ctx.add(ComposerPill, {
      id: "go-usage",
      order: 5,
      show: () => {
        const current = stats()
        return {
          label: current.label,
          tone: current.tone === "danger" ? "danger" : current.tone === "warning" ? "warning" : undefined,
          title: "OpenCode Go · 本次对话",
          rows: current.lines.map((line, index) => ({ id: String(index), label: line })),
        }
      },
    })

    return () => clearInterval(timer)
  },
})
