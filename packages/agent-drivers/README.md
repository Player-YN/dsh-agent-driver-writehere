# @deepseek-ai/dsh-agent-drivers

English | [中文](README.zh.md)

Host-plane registry of Agent constructors. `AgentDrivers` provides `ctx.agentDrivers`. `AgentLoop.prepare` reads it with `ctx.get('agentDrivers')` and constructs the resolved class; when the service is absent or `resolve` returns `undefined`, it constructs `ReactLoopAgent`.

A host plugin (bundle, not an agent preset) injects `agentDrivers` and registers constructors and binds preset ids before any session is created:

- `ctx.agentDrivers.register(id, ctor)` records a constructor matching `(loopCtx, id, options, session)`. A second live registration of the same id throws. The returned disposer — or unloading the registering plugin — removes that id.
- `ctx.agentDrivers.bindPreset(presetId, driverId)` maps `session.header.agentPreset` to a driver id. The constructor may be registered later; `resolve` stays `undefined` until both the bind and the constructor are live. A second live bind of the same preset id throws. Unload unwinds the bind.
- `ctx.agentDrivers.resolve(session)` follows `header.agentPreset` → bind → constructor. Missing header, unbound preset, or missing constructor yields `undefined`.

`register` and `bindPreset` must run on an unscoped host context. An agent or preset scope is refused: preset plugins mount after `new Agent`, so they cannot choose this session's constructor.

## Model Experience

Indirectly, through the session header that AgentLoop uses to pick a constructor; the chosen driver and request assembly own any model-visible request.

#### KV Cache effect

Constructor selection runs before the first request is assembled and writes no request tokens. This registry does not invalidate an established prefix; a different driver may emit a different later prefix of its own.

## Known Limitations and Deferred Work

- **Host-plane only** — `register` and `bindPreset` belong on the host context (bundle). They cannot live in an agent preset: the preset mounts after construct.
- **Preset mount happens after construct** — `resolve` reads `session.header.agentPreset` written at session creation. The preset's plugins are not loaded yet when the constructor runs.
