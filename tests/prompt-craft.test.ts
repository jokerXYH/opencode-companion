import assert from "node:assert/strict"
import { test } from "node:test"
import { buildRewritePrompt, cleanRewrite, REWRITE_VERSION } from "../plugins/prompt-craft/rewrite.ts"

test("REWRITE_VERSION is a positive integer", () => {
  assert.equal(Number.isInteger(REWRITE_VERSION), true)
  assert.ok(REWRITE_VERSION > 0)
})

test("buildRewritePrompt wraps the original text", () => {
  const prompt = buildRewritePrompt("加个存档")
  assert.match(prompt, /提示词编译器/)
  assert.match(prompt, /<原文>\n加个存档\n<\/原文>/)
})

test("cleanRewrite strips code fences and preambles", () => {
  assert.equal(cleanRewrite("```text\n目标：能存档\n```", "加个存档"), "目标：能存档")
  assert.equal(cleanRewrite("改写后：目标：能存档", "加个存档"), "目标：能存档")
  assert.equal(cleanRewrite("Here is the rewritten prompt: 目标：能存档", "加个存档"), "目标：能存档")
})

test("cleanRewrite rejects empty or unchanged output", () => {
  assert.equal(cleanRewrite("", "加个存档"), undefined)
  assert.equal(cleanRewrite("  加个存档  ", "加个存档"), undefined)
})

test("cleanRewrite rejects runaway output", () => {
  const original = "加个存档"
  assert.equal(cleanRewrite("a".repeat(3000), original), undefined)
})
