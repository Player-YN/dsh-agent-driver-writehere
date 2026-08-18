# @deepseek-ai/dsh-agent-drivers

[English](README.md) | 中文

宿主平面的 Agent 构造器注册表。`AgentDrivers` 提供 `ctx.agentDrivers`。`AgentLoop.prepare` 通过 `ctx.get('agentDrivers')` 读取并构造解析到的类；服务缺失或 `resolve` 返回 `undefined` 时，构造 `ReactLoopAgent`。

宿主插件（bundle，而不是 agent preset）注入 `agentDrivers`，并在任何会话创建之前注册构造器、绑定 preset id：

- `ctx.agentDrivers.register(id, ctor)` 记录匹配 `(loopCtx, id, options, session)` 的构造器。同一 id 的第二次仍存活注册会抛错。返回的 disposer——或卸载注册该条目的插件——会移除该 id。
- `ctx.agentDrivers.bindPreset(presetId, driverId)` 将 `session.header.agentPreset` 映射到 driver id。构造器可以稍后注册；在 bind 与构造器都存活之前，`resolve` 保持 `undefined`。同一 preset id 的第二次仍存活绑定会抛错。卸载会撤销该绑定。
- `ctx.agentDrivers.resolve(session)` 沿 `header.agentPreset` → bind → 构造器查找。缺少 header、未绑定的 preset、或缺少构造器时返回 `undefined`。

`register` 与 `bindPreset` 必须在无 scope 的宿主上下文上调用。agent 或 preset scope 会被拒绝：preset 插件在 `new Agent` 之后才 mount，因此无法选择本会话的构造器。

## 模型体验

通过 AgentLoop 用来选择构造器的会话头间接影响；模型可见请求由被选中的驱动器与请求组装负责。

#### KV Cache 影响

构造器选择发生在第一次请求组装之前，不写入任何请求 token。本注册表不会使已建立的前缀失效；不同的驱动器可以随后发出属于它自己的不同前缀。

## 已知限制与暂缓事项

- **仅宿主平面** — `register` 与 `bindPreset` 属于宿主上下文（bundle）。它们不能放进 agent preset：preset 在构造之后才 mount。
- **Preset 在构造之后才 mount** — `resolve` 读取会话创建时写入的 `session.header.agentPreset`。构造器运行时，preset 的插件尚未加载。
