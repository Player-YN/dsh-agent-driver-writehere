/**
 * Required host hook. Paste into DeepSeek Harness
 * `packages/core/agent-loop` prepare(), where the Agent is constructed.
 *
 * Stock DSH always does `new ReactLoopAgent(...)`. Without this lookup the
 * WriteHERE bundle can load and still never run — the editor stays ReAct.
 *
 * This checkout of deepseek-harness already contains the hook.
 */

import type { Agent } from '@deepseek-ai/dsh-agent'
import type { Session } from '@deepseek-ai/dsh-session'

type AgentDriverCtor = new (...args: never[]) => Agent

declare const ReactLoopAgent: AgentDriverCtor
declare const session: Session
declare const loopCtx: unknown
declare const id: unknown
declare const options: unknown
declare const thisRuntime: { ctx: { get(name: 'agentDrivers'): { resolve(s: Session): AgentDriverCtor | undefined } | undefined } }

const drivers = thisRuntime.ctx.get('agentDrivers')
const resolved = drivers?.resolve(session)
const preset = session.header.agentPreset
if ((preset === 'article-editor' || preset === 'xieka') && resolved === undefined) {
  throw new Error(`preset "${preset}" requires WriteHereAgent; ReactLoop is not a fallback`)
}
const Ctor = resolved ?? ReactLoopAgent
const agent = new Ctor(loopCtx as never, id as never, options as never, session)
void agent
