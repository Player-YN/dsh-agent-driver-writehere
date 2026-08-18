import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'
import * as WriteHereInvariant from '../src/invariant.ts'

describe('writehere invariant companion', () => {
  it('registers the empty invariant companion', async () => {
    const ctx = new Context()
    await ctx.plugin(InvariantRegistry)
    await expect(ctx.plugin(WriteHereInvariant).then(() => undefined)).resolves.toBeUndefined()
  })
})
