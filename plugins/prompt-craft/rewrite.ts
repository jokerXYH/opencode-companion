/**
 * 提示词改写：把用户随手写的一句话补成可执行的五段式提示词。
 * 这里是纯函数 + 一次 generate 调用，不碰会话状态，方便单独调试。
 */

export const REWRITE_VERSION = 1

const INSTRUCTIONS = `你是「提示词编译器」。把用户随手写的一句话，改写成可以直接交给编码 agent 执行的结构化提示词。

规则：
1. 只输出改写后的提示词本身。不要解释、不要前言后语、不要用代码围栏包起来。
2. 用和原文相同的语言输出（原文中文就输出中文）。
3. 原文里的代码块、文件路径、命令、报错信息、版本号、链接必须一字不改地保留。
4. 绝对不许编造原文没有的事实。必须补的缺口写成「假设：…」，放进上下文那一行。
5. 按需使用这五个标签，一行一个，固定这个顺序，没有内容的槽位直接省略：
   目标：成功之后世界是什么状态，要可验证
   上下文：技术栈、涉及的文件、既有约定
   约束：不能改的东西、不能加的依赖、资源限制
   验收：能跑的命令，或一眼能看出来的检查
   不做：明确排除的范围，防止顺手扩张
6. 如果原文已经是清晰、完整、可执行的指令，原样返回，一个字都不要改。
   如果只是寒暄、确认、追问、闲聊、选菜单，原样返回。
7. 如果原文是提问而不是任务，只补上回答它需要的范围和上下文，不要写成任务书。
8. 不要堆形容词。不要写「请」「务必」「高质量」「专业」这类没有信息量的词。
9. 篇幅尽量不超过原文的 3 倍。宁可短，不要注水。`

const PREFIX =
  /^(改写后|优化后|改写版本|优化版本|重写后|以下是[^\n]{0,20}?[:：]|rewritten( prompt)?[:：]|here(?:'s| is)[^\n]{0,30}?[:：])\s*/i

/** 拼出发给改写模型的完整 prompt。 */
export function buildRewritePrompt(text: string): string {
  return `${INSTRUCTIONS}\n\n<原文>\n${text}\n</原文>`
}

/**
 * 清理模型输出：去掉代码围栏、前言、首尾空白。
 * 返回 undefined 表示这次改写不可用，调用方应保留原文。
 */
export function cleanRewrite(raw: string, original: string): string | undefined {
  let text = (raw ?? "").trim()
  if (!text) return undefined

  const fenced = text.match(/^```[^\n]*\n([\s\S]*?)\n?```$/)
  if (fenced) text = fenced[1].trim()

  text = text.replace(PREFIX, "").trim()
  if (!text) return undefined

  // 模型把原文原样吐回来，等于没改写
  if (text === original.trim()) return undefined

  // 明显跑飞了：长到离谱，宁可不用
  if (text.length > Math.max(2000, original.trim().length * 6)) return undefined

  return text
}
