# @deepseek-ai/dsh-writehere

Host-plane WriteHERE editor driver. The plugin injects `ctx.agentDrivers`, registers `WriteHereAgent` as `writehere`, and binds session header `agentPreset: article-editor` (and `xieka`) to that constructor. On stock DSH it also wraps `AgentLoop.prepare` so those presets construct `WriteHereAgent`. Standard and other unbound presets stay on `ReactLoopAgent`. React is not disabled.

Register and bind must run on the host context (this bundle plugin). They cannot live in the article-editor preset: the preset mounts after `new Agent`.

`WriteHereAgent` keeps the ReactLoop inbox / cancel / followup / steer / inject / idle envelope. Its step is the article-tree scheduler, not the function-call loop. The model answers Update / IsAtomic / TypedPlan / think / write with empty tools. Task cards call `ctx.subagents.startContinuable` with `request.preset = 'standard'` and a lab or retrieval persona; they do not inherit the editor composition.

## Config

None.

## Events

- `agent/driver` `{ id: 'writehere' }` — once per session, so replay can name the constructor.
- `article/get-info` — GetInfo snapshot immediately before each scheduler LLM call.
- `article/update` — selected-node goal rewrite after Update(v*, K).
- `article/tree` — whole-tree snapshot after each engine op (declared by `@deepseek-ai/dsh-article-tree`).

Column memory is injected as plugin `user/message` text (`<article-memory-index>` once, `<article-memory>` hits on planner ticks). It is not a field inside `<article-get-info>`.

GetInfo is also appended as a `user/message`. `completeText` keeps only the latest `<article-get-info>` envelope on the model-visible surface.

## Extension points

- Another host plugin may register a different constructor; a second live bind of `article-editor` throws.
- Unloading this plugin removes the register and the bind. Unbound sessions fall back to `ReactLoopAgent`.

## Model Experience

### GetInfo context

#### What the model sees

Each scheduler tick appends one user-role message. The payload is the GetInfo JSON (node, ancestors, deps, draft; planner ticks add graph) between these tags, then the tick instruction. Ledger, methodology, and column memory stay outside this envelope. Update and decide ticks set `GenerateOptions.responseFormat` through `structuredResponseFormat` (default `{ type: 'json_object' }`; `DSH_JSON_SCHEMA=1` selects `{ type: 'json_schema' }`). Think, write, and compose ticks omit `responseFormat` and use a prose-only instruction. Think and task stay atomic unless the decision sets `atomic:false`. Planner ticks may append a separate `<article-memory>` hit list; a once-per-session `<article-memory-index>` lists paths and concept names only.

##### Verbatim GetInfo envelope

```markdown
<article-get-info>
{"node":…,"ancestors":…,"deps":…,"draft":"…"}
</article-get-info>
```

##### Verbatim update instruction

```markdown
Reply with a JSON object only. Use {"goal":"..."} to refine THIS selected node's goal from GetInfo. Do not return children. Do not change a parent node.
```

##### Verbatim write decision instruction

```markdown
Reply with a JSON object only. Use {"atomic":true} to execute this write node now. Use {"atomic":false,"children":[{"type":"task"|"think"|"write","goal":"...","atomic":true,"length":200}]} to split it. A write parent requires at least one write child. Think and task children default to atomic. To split a think or task child you must set atomic:false on that child. Omitting atomic keeps them atomic. Optional child length is a composition budget for write children only.
```

##### Verbatim memory index envelope

```markdown
<article-memory-index>
Prior column artifacts (titles/paths only). Ask a later tick for a hit snippet; do not assume unread bodies.
- article.md
</article-memory-index>
```

#### Token effect

Conditional: one GetInfo message is visible per model call. Size tracks the selected node, depth-capped ancestors, deps, draft, and (planner only) the structural graph. Tools are omitted (`tools: []`), so there is no tool-schema cost.

#### KV Cache effect

Replacement of earlier GetInfo tokens. `completeText` drops prior `<article-get-info>` user messages so the live K is this tick's projection. The system prompt stays a stable prefix. A new node or draft replaces the previous GetInfo suffix.

### Decision and prose replies

#### What the model sees

The assistant text of the previous tick is on the surface. Update ticks must be `{"goal":"..."}`. Decision ticks must be a JSON object (`{"atomic":true}` or `{"atomic":false,"children":[…]}`). Execute ticks must be result prose, not JSON. The driver never exposes `article_*` tools as the way to pick the next node.

#### Token effect

Data-dependent assistant text, retained until compaction.

#### KV Cache effect

Append-only growth of the same request prefix. Header `tools` stay absent, so a later ReactLoop session that adds tools is a different prefix and is not this driver's request.

## Known Limitations and Deferred Work

- **Task parks after dispatch** — `startContinuable({ preset: 'standard' })` marks the node `running` and ends the turn. A later subagent-report resumes the same tree.
- **No lab is not a successful commit** — if `ctx.subagents.startContinuable` is missing or throws, the task node stays ready and the user sees that lab runtime is unavailable.
- **Settled tree plus a new topic starts a new root** — a follow-up that is not a new topic continues the same tree.
- **Workspace draft is best-effort** — leaf write sections append to `articles/<slug>/article.md` and `article.md` when `session.header.cwd` is set; a filesystem error still commits the tree.
- **json_schema is opt-in** — DeepSeek chat-completions still 400s `response_format.type=json_schema`. Leave `DSH_JSON_SCHEMA` unset unless the adapter documents support.
