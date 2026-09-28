import { validatePassword } from '@midnight-ntwrk/midnight-js-utils'

const LOWER = 'abcdefghijkmnopqrstuvwxyz'
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const DIGITS = '23456789'
const SPECIAL = '!@#$%^&*-_=+?'

const POOLS = [LOWER, UPPER, DIGITS, SPECIAL]

function randomInt(max: number): number {
  const buf = new Uint32Array(1)
  const limit = Math.floor(0x100000000 / max) * max
  let value = 0
  do {
    crypto.getRandomValues(buf)
    value = buf[0]
  } while (value >= limit)
  return value % max
}

function pick(pool: string): string {
  return pool[randomInt(pool.length)]
}

function shuffle(items: string[]): string[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[items[i], items[j]] = [items[j], items[i]]
  }
  return items
}

/**
 * Generates a password that satisfies the `validatePassword` policy enforced by
 * `levelPrivateStateProvider` (>=16 chars, >=3 character classes, no 3 identical
 * consecutive chars, no 4-char sequential runs). Candidates are checked against
 * the real validator so the generator can never drift from the policy.
 */
export function generatePassword(length = 24): string {
  for (let attempt = 0; attempt < 200; attempt++) {
    const chars: string[] = []
    for (const pool of POOLS) chars.push(pick(pool))
    while (chars.length < length) chars.push(pick(POOLS[randomInt(POOLS.length)]))
    const candidate = shuffle(chars).join('')
    try {
      validatePassword(candidate)
      return candidate
    } catch {
      // rejected by the policy, try again
    }
  }
  throw new Error('unable to generate a policy-compliant password')
}
