---
name: game-design
description: Design and review 2D/pixel games — core loop, game feel, juice, level pacing, progression, and scope control for solo developers. Use when planning a game, designing mechanics or levels, tuning controls and feedback, or reviewing whether a game idea is achievable.
license: Local skill, no warranty.
---

# Game Design (2D / Pixel)

Design decisions come before art and code. A pixel game that feels good with placeholder squares will feel good with art; one that feels bad will not be saved by art.

## Start from the core loop

Write the loop in one sentence, then check it survives repetition:

```
action → feedback → reward → escalation → action
```

- **Action** must be readable in under a second. If the player needs to think about the input, the loop is too complex.
- **Feedback** must be immediate: within 1–3 frames for input acknowledgment, under 100 ms for consequences.
- **Reward** must be variable but fair. Fixed rewards get boring; random rewards without skill influence feel arbitrary.
- **Escalation** must change the *decision*, not just the numbers. Faster enemies change decisions; +10% HP does not.

If the loop is not fun with rectangles and no sound, stop and fix the loop.

## Game feel (the part most projects skip)

Every player action should produce at least three simultaneous responses:

1. **Visual** — squash/stretch, flash, particle, screen shake (small: 1–3 px, 60–120 ms)
2. **Audio** — a distinct sound per outcome, pitch-shifted randomly ±5% to avoid fatigue
3. **Temporal** — hitstop (freeze 30–80 ms on impact), input buffering (accept the next press 100–150 ms early)

Non-negotiable defaults:

- **Coyote time**: allow jumping 80–120 ms after leaving a ledge
- **Jump buffering**: queue a jump pressed up to 120 ms before landing
- **Variable jump height**: release early to jump lower
- **Acceleration curves**: no instant max speed on the ground; instant direction change in the air feels better than momentum in most pixel platformers
- **Screen shake with a decay curve**, never linear

## Difficulty and pacing

- Introduce each mechanic in a **safe room** with no fail state, then test it with a cost, then combine it.
- Follow a **teach → test → twist → combine** pattern per level, not per game.
- Difficulty comes from **execution pressure**, **information scarcity**, or **resource scarcity** — pick one per level. Stacking all three feels unfair.
- First death should teach something. If the player cannot say why they died, the design failed, not the player.

## Scope control for a solo developer

Cut in this order when time runs short:

1. Cut content (levels, enemies), never the core loop polish
2. Cut systems (crafting, skill trees) before cutting feedback
3. Cut art before cutting audio feedback
4. Never cut save/checkpoint quality — it is the difference between "hard" and "hostile"

A finished 20-minute game beats an unfinished 4-hour one. Vertical slice first: one level, fully polished, all systems present, then expand.

## Pixel-specific rules

- Design at the **native resolution** and integer-scale up. Never scale by non-integers; it destroys pixel clarity.
- Choose a **restricted palette** (16–32 colors) and enforce it. Constraint creates identity.
- **1-pixel outlines** read better than soft shadows at low resolution.
- Animation timing matters more than frame count: 4 frames with good timing beat 12 with bad timing.
- Text: use a bitmap font at the native grid. System fonts at small sizes look muddy.

## Review checklist

When evaluating an existing design or build:

- Can a new player understand the goal within 15 seconds, without text?
- Does every input have visible feedback within 3 frames?
- Is there a moment in the first 2 minutes where the player feels clever?
- Can the player recover from a mistake, or is one error fatal with no read?
- Does difficulty increase by changing decisions, or only numbers?
- Is the game's identity visible in a single screenshot?

Answer "no" to any of these and fix that before adding content.

## Working with this project

When asked to design or review, produce:

1. The core loop sentence
2. The three-response feedback table for the main action
3. The teach → test → twist → combine plan for the next level
4. A scope cut list ranked by what to drop first

Keep the answer concrete and tied to the actual game, not general theory.
