import { Plugin } from "@opencode/plugin"
import { buildRewritePrompt, cleanRewrite, REWRITE_VERSION } from "./rewrite"

/**
 * prompt-craft
 *
 * 在消息进入会话之前，用当前模型把随手写的一句话补成结构化提示词
 * （目标 / 上下文 / 约束 / 验收 / 不做），再交给 agent 执行。
 *
 * 配置（opencode.json 的 plugins 项）：
 *   { "package": "./plugins/prompt-craft", "options": { ... } }
 *
 * 可选项：
 *   enabled    默认 true，false 则完全不介入
 *   model      改写用的模型，形如 "provider/model"；不填则跟随当前会话模型
 *   minChars   短于这个长度不处理，默认 4
 *   maxChars   长于这个长度不处理，默认 4000
 *   timeoutMs  超时后放弃改写、按原文发送，默认 15000
 *   cooldownMs 改写失败后暂停多久，避免每条消息都卡一次，默认 60000
 *   debug      打印跳过/失败原因，默认 false
 */

type ModelRef = { providerID: string; id: string; variant?: string }

interface Settings {
  enabled: boolean
  model?: string
  minChars: number
  maxChars: number
  timeoutMs: number
  cooldownMs: number
  debug: boolean
}

const CACHE_LIMIT = 50

/** 寒暄、确认、菜单选择这类消息改写只会帮倒忙 */
const FAST_PATH =
  /^(继续|接着|往下|go on|continue|ok(ay)?|好(的|吧|啊)?|行|可以|嗯+|对|是的?|不是|不用|算了|停|谢谢|thanks|thx|yes|no|y|n|\d{1,2}[.、)]?|[?？!！.。~…]+)$/i

/** 已经是结构化提示词，不再二次加工 */
const ALREADY_STRUCTURED =
  /^(目标|goal|上下文|context|约束|constraints?|验收|acceptance|不做|out of scope)[：:]/im

function toNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback
}

function readSettings(options: Record<string, any>): Settings {
  return {
    enabled: options.enabled !== false,
    model: typeof options.model === "string" && options.model.includes("/") ? options.model : undefined,
    minChars: toNumber(options.minChars, 4),
    maxChars: toNumber(options.maxChars, 4000),
    timeoutMs: toNumber(options.timeoutMs, 15_000),
    cooldownMs: toNumber(options.cooldownMs, 60_000),
    debug: options.debug === true,
  }
}

function shouldSkip(text: string, settings: Settings): string | undefined {
  const trimmed = text.trim()
  if (!trimmed) return "empty"
  if (trimmed.length < settings.minChars) return "too-short"
  if (trimmed.length > settings.maxChars) return "too-long"
  if (trimmed.startsWith("/") || trimmed.startsWith("!")) return "command"
  if (FAST_PATH.test(trimmed)) return "fast-path"
  if (ALREADY_STRUCTURED.test(trimmed)) return "already-structured"
  return undefined
}

/** 简易字符串哈希，只用来做内存缓存键 */
function hash(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0
  return `${input.length}:${h}`
}

/** 从 "provider/model" 解析出 Model.Ref */
function parseModel(value: string | undefined): ModelRef | undefined {
  if (!value) return undefined
  const index = value.indexOf("/")
  if (index <= 0) return undefined
  const providerID = value.slice(0, index)
  const id = value.slice(index + 1)
  return providerID && id ? { providerID, id } : undefined
}

export default Plugin.define({
  id: "prompt-craft",
  async setup(ctx) {
    const settings = readSettings(ctx.options ?? {})
    const log = (...args: unknown[]) => {
      if (settings.debug) console.log("[prompt-craft]", ...args)
    }
    if (!settings.enabled) {
      log("disabled by options")
      return
    }

    const cache = new Map<string, string>()
    const children = new Map<string, boolean>()
    /** 改写服务挂掉时暂停一阵，别让每条消息都白等一次超时 */
    let cooldownUntil = 0

    const remember = (key: string, value: string) => {
      if (cache.size >= CACHE_LIMIT) {
        const oldest = cache.keys().next()
        if (!oldest.done) cache.delete(oldest.value)
      }
      cache.set(key, value)
    }

    /** 子会话（subagent）的提示词是程序拼出来的，不要动 */
    const isChildSession = async (sessionID: string): Promise<boolean> => {
      const cached = children.get(sessionID)
      if (cached !== undefined) return cached
      try {
        const info = await ctx.session.get({ sessionID })
        const child = Boolean((info as { parentID?: string } | undefined)?.parentID)
        children.set(sessionID, child)
        return child
      } catch {
        return false
      }
    }

    /** 配置了 model 就优先用；否则跟随会话当前模型，再不然交给服务端默认 */
    const resolveModel = async (sessionID: string): Promise<ModelRef | undefined> => {
      const configured = parseModel(settings.model)
      if (configured) return configured
      try {
        const info = await ctx.session.get({ sessionID })
        const model = (info as { model?: ModelRef } | undefined)?.model
        if (model?.providerID && model?.id) return { providerID: model.providerID, id: model.id }
      } catch {}
      try {
        const fallback = await ctx.model.default()
        const providerID = (fallback as any)?.providerID
        const id = (fallback as any)?.modelID ?? (fallback as any)?.id
        if (typeof providerID === "string" && typeof id === "string") return { providerID, id }
      } catch {}
      return undefined
    }

    const rewrite = async (text: string, sessionID: string): Promise<string | undefined> => {
      const model = await resolveModel(sessionID)
      const key = hash(`${model?.providerID ?? ""}/${model?.id ?? ""}|${text}`)
      const cached = cache.get(key)
      if (cached !== undefined) return cached

      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), settings.timeoutMs)
      try {
        const result = await ctx.experimental.generate.text(
          { prompt: buildRewritePrompt(text), ...(model ? { model } : {}) },
          { signal: controller.signal },
        )
        const cleaned = cleanRewrite(result?.text ?? "", text)
        if (cleaned) remember(key, cleaned)
        else log("rewrite discarded", text.slice(0, 40))
        return cleaned
      } catch (error) {
        cooldownUntil = Date.now() + settings.cooldownMs
        log("rewrite failed", String(error))
        return undefined
      } finally {
        clearTimeout(timer)
      }
    }

    /** 改写后原文的 @file 偏移会失效，清掉 mention，附件本身保留 */
    const clearMentions = (prompt: Record<string, any>) => {
      for (const key of ["files", "agents", "skills"]) {
        const list = prompt[key]
        if (!Array.isArray(list)) continue
        for (const item of list) if (item && typeof item === "object") delete item.mention
      }
    }

    const hook = await ctx.session.hook("prompt", async (event) => {
      try {
        const original = event.prompt.text ?? ""
        const metadata = (event.metadata ?? {}) as Record<string, any>
        if (metadata["prompt-craft"]) return

        const skip = shouldSkip(original, settings)
        if (skip) {
          log("skip", skip, original.slice(0, 40))
          return
        }
        if (Date.now() < cooldownUntil) {
          log("skip cooldown")
          return
        }
        if (await isChildSession(event.sessionID)) {
          log("skip subagent session")
          return
        }

        const rewritten = await rewrite(original, event.sessionID)
        if (!rewritten) return

        event.prompt.text = rewritten
        clearMentions(event.prompt as Record<string, any>)
        event.metadata = {
          ...metadata,
          "prompt-craft": { version: REWRITE_VERSION, original },
        }
        log("rewritten", original.length, "->", rewritten.length)
      } catch (error) {
        // 任何异常都放原文通过，绝不挡住用户的消息
        log("hook error", String(error))
      }
    })

    /** 手动入口：/craft <需求>，跳过启发式判断，强制改写 */
    const command = await ctx.command.transform((editor) => {
      editor.add({
        name: "craft",
        description: "把后面的需求改写成结构化提示词，再交给模型执行",
        execute: async ({ sessionID, prompt, delivery }) => {
          const original = (prompt.text ?? "").trim()
          if (!original) throw new Error("用法：/craft <你的原始需求>")
          const rewritten = (await rewrite(original, sessionID)) ?? original
          await ctx.session.prompt({
            ...prompt,
            sessionID,
            text: rewritten,
            delivery,
            metadata: { "prompt-craft": { version: REWRITE_VERSION, original, manual: true } },
          })
        },
      })
    })

    return async () => {
      await hook.dispose()
      await command.dispose()
    }
  },
})
