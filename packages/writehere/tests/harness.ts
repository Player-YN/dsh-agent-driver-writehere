import { Context } from '@deepseek-ai/cordis'
import AgentDrivers from '@deepseek-ai/dsh-agent-drivers'
import AgentLoop from '@deepseek-ai/dsh-agent-loop'
import { mountAgentLoopTestDependencies } from '@deepseek-ai/dsh-agent-loop-testkit'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { Agent } from '@deepseek-ai/dsh-agent'
import * as WriteHere from '../src/index.ts'
import { MockAdapter } from './mock-adapter.ts'

export async function mountWriteHereHarness(adapter: MockAdapter, options: {
  bind?: boolean
} = {}): Promise<Context> {
  const ctx = new Context()
  await mountAgentLoopTestDependencies(ctx)
  await ctx.plugin(AgentDrivers)
  if (options.bind !== false) await ctx.plugin(WriteHere)
  await ctx.plugin(AgentLoop, { agents: [] })
  ctx.llm.registerAdapter(['mock'], adapter)
  return ctx
}

export function send(agent: Agent, text: string): void {
  agent.followup(createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } }))
}

export function messageBlob(value: unknown): string {
  return JSON.stringify(value)
}
