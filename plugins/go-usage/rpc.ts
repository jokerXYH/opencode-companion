import { Rpc } from "@opencode/plugin/rpc"

/**
 * Typed contract shared by the server part, the desktop GUI part, and external
 * clients. Keep `dist/gui-experimental.cjs` in sync when this changes.
 */
export const GoUsage = Rpc.define({
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
