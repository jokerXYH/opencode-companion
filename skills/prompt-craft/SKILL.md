---
name: prompt-craft
description: Rewrite a vague request into a precise, executable prompt for a coding agent. Use when the user asks to improve, optimize, or structure a prompt, when a request keeps producing the wrong result, or when the user wants a reusable prompt template.
license: Local skill, no warranty.
---

# Prompt Craft

A prompt that fails usually fails for one of five reasons: no goal, no constraints, no acceptance criteria, no scope boundary, or no output format. Rewrite by supplying the missing ones — do not add adjectives.

## The five slots

Every executable prompt should answer these, in this order:

1. **Goal** — the outcome, stated as a state of the world, not an action.
   Bad: "优化一下这个页面"
   Good: "让首屏在 1 秒内可交互，且不改变现有视觉风格"
2. **Context** — what the agent cannot infer: stack, versions, file paths, existing conventions, prior decisions.
3. **Constraints** — hard limits: don't touch X, must keep Y, budget, dependencies allowed or forbidden.
4. **Acceptance** — how to verify success, concretely. Ideally a command or a check the agent can run.
5. **Out of scope** — what explicitly must not be done, to prevent scope creep.

Optional sixth: **Output format** — file to edit, or a summary shape, or "show the diff only".

## Rewrite procedure

Given a vague request:

1. Identify which of the five slots is missing. Usually three or more are missing.
2. Ask at most **one** clarifying question, and only if the answer changes the work materially. Otherwise state your assumption inline and proceed.
3. Write the rewritten prompt with the slots as short labelled lines, not prose.
4. Flag any assumption you made so the user can correct it before sending.

## Template

```
目标：<the world state after success>
上下文：<stack, files, versions, conventions>
约束：<must keep / must not touch / allowed dependencies>
验收：<command or check that proves it works>
不做：<explicit exclusions>
```

## Worked example

Original:

> 帮我给游戏加个存档功能

Rewritten:

```
目标：玩家退出后重进，能从上次所在关卡继续，进度不丢失。
上下文：像素惊魂项目，纯前端 Canvas + localStorage，无后端。
约束：不改动现有关卡数据结构；存档体积 < 50KB；不做云同步。
验收：关闭页面重开，角色出现在上次退出时的关卡与坐标；localStorage 中 key 为 save_v1。
不做：多存档槽、自动备份、加密。
```

The rewritten version is roughly the same length but removes the two most likely failure modes: the agent inventing a backend, and the agent changing the level schema.

## Anti-patterns

- **Stacking adjectives** — "高质量、专业、优雅" changes nothing. Replace with a measurable property.
- **Listing technologies instead of outcomes** — "用 React 和 Tailwind 做" is a constraint, not a goal. Say what the user sees.
- **No verification** — if the agent cannot check its own work, it will guess and declare success.
- **Burying the ask** — put the goal in the first line, not after three paragraphs of background.
- **Over-specifying the how** — prescribing implementation steps removes the agent's ability to find a better path. Specify the *what* and the *limits*, let it choose the *how*.

## When the user wants a reusable prompt

Produce the prompt as a copy-paste block with `<placeholders>` for the parts that change per use, and one line explaining what to fill in.
