const { Rpc } = require("@opencode/plugin/rpc")

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

module.exports = { GoUsage }
