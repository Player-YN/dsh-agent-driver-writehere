// packages/writehere/src/ids.ts
var WRITEHERE_DRIVER_ID = "writehere";

// packages/writehere/src/agent.ts
import { Inbox, agentEvents, assembleContextFor } from "@deepseek-ai/dsh-agent";
import {
  BlockAssembler,
  LlmError,
  createAssistantMessage as createAssistantMessage2,
  deepFreeze,
  errorChain,
  markAgentLoopRequest
} from "@deepseek-ai/dsh-llm";
import { createScope } from "@deepseek-ai/dsh-scope";
import { canonicalHeader, headerEquals } from "@deepseek-ai/dsh-session";
import { joinContextSections, renderContextSections, renderPrompt } from "@deepseek-ai/dsh-system-prompt";

// packages/writehere/src/runtime-context.ts
import { createUserMessage } from "@deepseek-ai/dsh-llm";
import { isReplacementSurfaceEvent } from "@deepseek-ai/dsh-session";
var SOURCE = "@deepseek-ai/dsh-system-prompt";
var CLEARED = "Current runtime context: none. Earlier runtime-context snapshots no longer apply.";
function isOwned(message) {
  return message.source.kind === "plugin" && message.source.plugin === SOURCE;
}
function textOf(message) {
  const [block] = message.content;
  return message.content.length === 1 && block?.type === "text" ? block.text : void 0;
}
var RuntimeContextProjection = class {
  /** `undefined` means no snapshot ever existed; `null` means none is retained. */
  retained;
  /**
   * Restore projection state once, then follow authoritative session events.
   * @param ctx - agent-scoped event context.
   * @param session - session receiving projected messages.
   */
  constructor(ctx, session) {
    const surface = new Set(session.surface.nodes);
    for (let index = session.events.length - 1; index >= 0; index -= 1) {
      const event = session.events[index];
      if (event?.type !== "user/message" || !isOwned(event.data)) continue;
      this.retained ??= null;
      if (surface.has(event.seq)) {
        this.retained = { seq: event.seq, text: textOf(event.data) };
        break;
      }
    }
    ctx.on("session/event", (subject, event) => {
      if (subject !== session) return;
      if (event.type === "user/message" && isOwned(event.data)) {
        this.retained = { seq: event.seq, text: textOf(event.data) };
      } else if (this.retained && isReplacementSurfaceEvent(event) && event.sourceEventSeqs?.includes(this.retained.seq) === true) {
        this.retained = null;
      }
    });
  }
  /**
   * Create an uncommitted snapshot only when the retained value differs.
   * @param current - fully rendered dynamic context.
   * @param sections - named contributions that formed the current snapshot.
   * @returns a candidate user message, or `undefined` when no update is needed.
   */
  project(current, sections) {
    if (this.retained === void 0 && current.length === 0) return;
    const snapshot = current.length === 0 ? CLEARED : current;
    if (this.retained?.text === snapshot) return;
    return createUserMessage({
      content: [{ type: "text", text: snapshot }],
      source: sections.length === 0 ? { kind: "plugin", plugin: SOURCE } : { kind: "plugin", plugin: SOURCE, form: "snapshot", sections }
    });
  }
};

// packages/writehere/src/prompts.ts
var GET_INFO_OPEN = "<article-get-info>";
var GET_INFO_CLOSE = "</article-get-info>";
var UPDATE_INSTRUCTION = [
  "Reply with a JSON object only.",
  `Use {"goal":"..."} to refine THIS selected node's goal from GetInfo.`,
  "Do not return children. Do not change a parent node."
].join(" ");
var DECIDE_WRITE_INSTRUCTION = [
  "Reply with a JSON object only.",
  'Use {"atomic":true} to execute this write node now.',
  'Use {"atomic":false,"children":[{"type":"task"|"think"|"write","goal":"...","atomic":true,"length":200}]} to split it.',
  "A write parent requires at least one write child. Think and task children default to atomic.",
  "To split a think or task child you must set atomic:false on that child. Omitting atomic keeps them atomic.",
  "Optional child length is a composition budget for write children only."
].join(" ");
var DECIDE_ATOM_INSTRUCTION = [
  "Reply with a JSON object only.",
  "Think and task nodes stay atomic unless you set atomic:false.",
  'Prefer {"atomic":true}.',
  'Use {"atomic":false,"children":[{"type":"task"|"think"|"write","goal":"..."}]} only when this node must split, and set atomic:false on any think or task child that should split later.'
].join(" ");
var DECIDE_INSTRUCTION = DECIDE_WRITE_INSTRUCTION;
var EXECUTE_THINK_INSTRUCTION = "Write the reasoning result for this node. Return only the result prose, not JSON.";
var EXECUTE_WRITE_INSTRUCTION = "Write the reader-facing prose for this node. Return only the committed paragraph(s), not JSON.";
function writeLengthInstruction(length) {
  if (length === void 0) return EXECUTE_WRITE_INSTRUCTION;
  return `${EXECUTE_WRITE_INSTRUCTION} Target about ${length} words.`;
}
var COMPOSE_WRITE_INSTRUCTION = "Compose the parent write from the finished child results in GetInfo. Return only the composed prose, not JSON.";
var LAB_UNAVAILABLE_TEXT = "Lab runtime is unavailable. Search cards stay on the tree until a subagent provider is mounted.";
var LAB_PERSONA = "Execute the single assigned task. Do not adopt an editorial persona. Return evidence only.";
var RETRIEVAL_PERSONA = "You are a retrieval worker. Search and fetch sources. Return a concise evidence summary only. Do not write the reader-facing article.";
var RETRIEVAL_PROMPT_PREFIX = "Retrieve and summarize evidence for this information need. Use web search and fetch. Return only the findings.\n\n";
var RETRIEVAL_GOAL = /search|retrieve|查|搜|检索|资料|证据|公开榜|论文|source|fetch|调研|cite|引用/i;
var PUBLISH_GOAL = /draft\/add|upload-draft|desk\.ps1|排版|推箱|cover\.png|wechat/i;
function isRetrievalGoal(goal) {
  return RETRIEVAL_GOAL.test(goal) && !PUBLISH_GOAL.test(goal);
}
var DECIDE_RETRY_INSTRUCTION = "Previous reply was not a valid decision JSON object. Reply with a JSON object only.";

// packages/writehere/src/memory.ts
import { readFile as readFile2 } from "node:fs/promises";
import { resolve as resolve2 } from "node:path";

// packages/article-tree/src/corpus.ts
import { appendFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// packages/article-tree/src/policy.ts
import { win32 } from "node:path";
var EDITOR_SYSTEM_PROMPT = [
  "You are the article editor. One article, one cognitive change. Topic unit is a contradiction, not a term.",
  'The WriteHere driver chooses the next tree node. First refine THIS node with {"goal":"..."}. Then reply with decision JSON or node prose.',
  "think and task stay atomic unless the decision sets atomic:false.",
  "Do not call tools. Do not run a shell.",
  "Web search belongs on a worker session, not this driver loop."
].join(" ");
var ARTIFACT_REL = [
  /^article\.md$/i,
  /^article\//i,
  /^articles\//i,
  /^ledger\//i,
  /^experiments\//i,
  /^runs\/[^/]+\/(article\.md|articles\/|ledger\/|experiments\/)/i
];
function isBoundedArticlePath(filePath, cwd) {
  const raw = filePath.trim();
  if (!raw || raw.includes("\0") || raw.includes("..")) return false;
  const slash = raw.replace(/\\/g, "/");
  let rel = slash.replace(/^\.\//, "");
  if (cwd) {
    const base = cwd.replace(/\\/g, "/").replace(/\/$/, "");
    const abs = /^([a-zA-Z]:)?\//.test(slash) || win32.isAbsolute(raw);
    if (abs) {
      const lower = slash.toLowerCase();
      const prefix = base.toLowerCase();
      if (lower !== prefix && !lower.startsWith(prefix + "/")) return false;
      rel = slash.slice(base.length).replace(/^\//, "");
    }
  }
  return ARTIFACT_REL.some((re) => re.test(rel));
}

// packages/article-tree/src/corpus.ts
var MAX_CORPUS_HITS = 32;
var MAX_CORPUS_FILE_CHARS = 256e3;
function toPosixRel(rel) {
  return rel.replace(/\\/g, "/");
}
function acceptCorpusRel(cwd, rel) {
  const posix = toPosixRel(rel);
  if (!isBoundedArticlePath(posix, cwd)) return null;
  return resolve(cwd, posix);
}
async function readBoundedFile(abs) {
  try {
    const info = await stat(abs);
    if (!info.isFile()) return null;
    const text = await readFile(abs, "utf8");
    return text.length > MAX_CORPUS_FILE_CHARS ? text.slice(0, MAX_CORPUS_FILE_CHARS) : text;
  } catch {
    return null;
  }
}
async function listDirents(absDir) {
  try {
    return await readdir(absDir, { withFileTypes: true });
  } catch {
    return null;
  }
}
async function isReadableFile(abs) {
  try {
    return (await stat(abs)).isFile();
  } catch {
    return false;
  }
}
async function listCorpusFiles(cwd) {
  const files = [];
  if (await isReadableFile(resolve(cwd, "article.md"))) files.push("article.md");
  const ledgerEntries = await listDirents(resolve(cwd, "ledger"));
  if (ledgerEntries) {
    for (const entry of ledgerEntries) {
      const rel = toPosixRel(`ledger/${entry.name}`);
      if (rel.endsWith(".jsonl") && acceptCorpusRel(cwd, rel)) files.push(rel);
    }
  }
  const stack = ["articles"];
  for (let relDir = stack.pop(); relDir !== void 0; relDir = stack.pop()) {
    const entries = await listDirents(resolve(cwd, relDir));
    if (!entries) continue;
    for (const entry of entries) {
      const rel = toPosixRel(`${relDir}/${entry.name}`);
      if (entry.isDirectory()) {
        if (isBoundedArticlePath(rel, cwd)) stack.push(rel);
        continue;
      }
      if (rel.toLowerCase().endsWith(".md") && acceptCorpusRel(cwd, rel)) files.push(rel);
    }
  }
  return files;
}
async function searchCorpusAny(cwd, keywords) {
  const needles = [...new Set(keywords.map((keyword) => keyword.trim().toLowerCase()).filter(Boolean))];
  if (needles.length === 0) throw new Error("keywords must be non-empty");
  const scored = [];
  for (const rel of await listCorpusFiles(cwd)) {
    const abs = acceptCorpusRel(cwd, rel);
    if (!abs) continue;
    const text = await readBoundedFile(abs);
    if (text === null) continue;
    const lower = text.toLowerCase();
    let firstIndex = -1;
    let firstLength = 0;
    let score = 0;
    for (const needle of needles) {
      const index = lower.indexOf(needle);
      if (index < 0) continue;
      score += 1;
      if (firstIndex < 0 || index < firstIndex) {
        firstIndex = index;
        firstLength = needle.length;
      }
    }
    if (firstIndex < 0) continue;
    const start = Math.max(0, firstIndex - 80);
    const end = Math.min(text.length, firstIndex + firstLength + 80);
    scored.push({ path: toPosixRel(rel), snippet: text.slice(start, end), score });
  }
  scored.sort((a, b) => b.score - a.score);
  return { hits: scored.slice(0, MAX_CORPUS_HITS).map(({ path, snippet }) => ({ path, snippet })) };
}

// packages/writehere/src/memory.ts
var MEMORY_INDEX_OPEN = "<article-memory-index>";
var MEMORY_INDEX_CLOSE = "</article-memory-index>";
var MEMORY_OPEN = "<article-memory>";
var MEMORY_CLOSE = "</article-memory>";
var MAX_INDEX_PATHS = 16;
var MAX_CONCEPTS = 12;
var MAX_HITS = 4;
var MAX_SNIPPET = 160;
var MAX_KEYWORDS = 12;
var MAX_QUERY_CHARS = 200;
var ASCII_SEGMENT = /^[\x20-\x7f]+$/;
function memoryKeywords(query) {
  const segments = query.trim().slice(0, MAX_QUERY_CHARS).split(/[\s\p{P}\p{S}]+/u).filter(Boolean);
  const keywords = [];
  const push = (keyword) => {
    if (keywords.length < MAX_KEYWORDS && !keywords.includes(keyword)) keywords.push(keyword);
  };
  for (const segment of segments) {
    if (keywords.length >= MAX_KEYWORDS) break;
    if (ASCII_SEGMENT.test(segment)) {
      if (segment.length >= 2) push(segment);
      continue;
    }
    if (segment.length <= 4) {
      push(segment);
      continue;
    }
    for (let i = 0; i + 2 <= segment.length && keywords.length < MAX_KEYWORDS; i += 1) {
      push(segment.slice(i, i + 2));
    }
  }
  return keywords;
}
async function conceptNames(cwd) {
  try {
    const text = await readFile2(resolve2(cwd, "ledger", "concepts.jsonl"), "utf8");
    const names = [];
    for (const line of text.split("\n")) {
      if (!line.trim() || names.length >= MAX_CONCEPTS) break;
      try {
        const record = JSON.parse(line);
        if (typeof record.name === "string" && record.name.trim()) names.push(record.name.trim());
      } catch {
        continue;
      }
    }
    return names;
  } catch {
    return [];
  }
}
async function memoryIndexText(cwd) {
  if (!cwd) return "";
  const [files, concepts] = await Promise.all([listCorpusFiles(cwd), conceptNames(cwd)]);
  const paths = files.slice(0, MAX_INDEX_PATHS);
  if (paths.length === 0 && concepts.length === 0) return "";
  const lines = [
    MEMORY_INDEX_OPEN,
    "Prior column artifacts (titles/paths only). Ask a later tick for a hit snippet; do not assume unread bodies.",
    ...paths.map((path) => `- ${path}`),
    ...concepts.map((name2) => `- concept:${name2}`),
    MEMORY_INDEX_CLOSE
  ];
  return lines.join("\n");
}
async function memoryHitsText(cwd, query) {
  if (!cwd) return "";
  const keywords = memoryKeywords(query);
  if (keywords.length === 0) return "";
  try {
    const { hits } = await searchCorpusAny(cwd, keywords);
    if (hits.length === 0) return "";
    const lines = hits.slice(0, MAX_HITS).map((hit) => {
      const snippet = hit.snippet.replace(/\s+/g, " ").trim().slice(0, MAX_SNIPPET);
      return `- ${hit.path}: ${snippet}`;
    });
    return [MEMORY_OPEN, ...lines, MEMORY_CLOSE].join("\n");
  } catch {
    return "";
  }
}

// packages/article-tree/src/engine.ts
function isLabType(type) {
  return type === "task" || type === "search";
}
function createArticleTree(topic) {
  const trimmed = topic.trim();
  if (!trimmed) throw new Error("topic must be non-empty");
  return {
    topic: trimmed,
    nodes: {
      root: {
        id: "root",
        parentId: null,
        type: "write",
        goal: trimmed,
        status: "ready",
        atomic: false,
        result: null,
        children: [],
        dependsOn: []
      }
    },
    order: ["root"],
    lastOp: "create",
    selectedId: "root"
  };
}
function cloneTree(tree) {
  return JSON.parse(JSON.stringify(tree));
}
function pickReadyNode(tree) {
  let best = null;
  let bestDepth = Infinity;
  for (const id of tree.order) {
    const node = tree.nodes[id];
    if (!node || node.status !== "ready" && node.status !== "needs-update") continue;
    const depth = nodeDepth(tree, id);
    if (depth < bestDepth) {
      best = id;
      bestDepth = depth;
    }
  }
  return best;
}
function isAtomicFlag(node, decidedAtomic) {
  return decidedAtomic === true || node.atomic === true;
}
function allChildrenDone(tree, id) {
  const node = tree.nodes[id];
  if (!node || node.children.length === 0) return true;
  return node.children.every((cid) => tree.nodes[cid]?.status === "done");
}
function decomposeNode(tree, nodeId, children) {
  const next = cloneTree(tree);
  const node = next.nodes[nodeId];
  if (!node) throw new Error(`unknown node ${nodeId}`);
  if (node.status === "done") throw new Error(`cannot decompose a done node ${nodeId}`);
  if (node.atomic) throw new Error(`cannot decompose atomic node ${nodeId}`);
  if (children.length < 1) throw new Error("decompose requires at least one child");
  const resolvedIds = children.map((child, index) => child.id?.trim() || `${nodeId}-c${index + 1}`);
  children = children.map((child) => {
    if (child.dependsOn === void 0) return child;
    const dependsOn = child.dependsOn.map((dep) => {
      if (/^\d+$/.test(dep)) {
        const index = Number(dep);
        return resolvedIds[index] ?? dep;
      }
      return dep;
    });
    return { ...child, dependsOn };
  });
  if (node.type === "write") {
    if (!children.some((child) => child.type === "write")) {
      throw new Error("write decompose requires at least one write child");
    }
    const lastWriteIndex = children.reduce((acc, child, index) => child.type === "write" ? index : acc, -1);
    const writeIds = resolvedIds.filter((_, index) => children[index]?.type === "write");
    const lastWriteId = resolvedIds[lastWriteIndex];
    for (const child of children.slice(lastWriteIndex + 1)) {
      if (!isLabType(child.type)) {
        throw new Error("write decompose requires the last child to be write, or a trailing task that depends on a write");
      }
    }
    children = children.map((child, index) => {
      if (index <= lastWriteIndex || !isLabType(child.type)) return child;
      const deps = child.dependsOn ?? [];
      if (deps.some((dep) => writeIds.includes(dep))) return child;
      return { ...child, dependsOn: [...deps, lastWriteId] };
    });
  }
  const ids = resolvedIds;
  children = chainSiblingDependsOn(children, ids, "write");
  children = chainSiblingDependsOn(children, ids, "think");
  const newIds = /* @__PURE__ */ new Set();
  for (const id of ids) {
    if (next.nodes[id] || newIds.has(id)) throw new Error(`node id already exists: ${id}`);
    newIds.add(id);
  }
  children.forEach((child, index) => {
    const id = ids[index];
    const goal = child.goal.trim();
    if (!goal) throw new Error("child goal must be non-empty");
    const dependsOn = (child.dependsOn ? [...child.dependsOn] : []).filter((dep) => {
      if (dep === id) throw new Error(`node ${id} cannot depend on itself`);
      return Boolean(next.nodes[dep] || newIds.has(dep));
    });
    const defaultAtom = child.type === "think" || isLabType(child.type);
    next.nodes[id] = {
      id,
      parentId: nodeId,
      type: child.type,
      goal,
      status: "blocked",
      atomic: child.atomic === true || child.atomic !== false && defaultAtom,
      result: null,
      children: [],
      dependsOn,
      ...child.length !== void 0 ? { length: child.length } : {}
    };
    next.order.push(id);
  });
  node.children = node.children.concat(ids);
  node.status = "waiting";
  recomputeReadiness(next);
  next.lastOp = "decompose";
  next.selectedId = nodeId;
  return next;
}
function commitNode(tree, nodeId, result) {
  const next = cloneTree(tree);
  const node = next.nodes[nodeId];
  if (!node) throw new Error(`unknown node ${nodeId}`);
  if (node.status !== "ready" && node.status !== "running") {
    throw new Error(`node ${nodeId} is ${node.status}, not committable`);
  }
  const text = result.trim();
  if (!text) throw new Error("commit result must be non-empty");
  if (node.type === "write" && !node.atomic && node.children.length > 0 && !allChildrenDone(next, nodeId)) {
    throw new Error("non-atomic write node commits only after children are done");
  }
  node.status = "done";
  node.result = text;
  recomputeReadiness(next);
  next.lastOp = "commit";
  next.selectedId = nodeId;
  return next;
}
function nodeDepth(tree, id) {
  let depth = 0;
  let current = tree.nodes[id];
  const seen = /* @__PURE__ */ new Set();
  while (current?.parentId) {
    if (seen.has(current.id)) break;
    seen.add(current.id);
    depth += 1;
    current = tree.nodes[current.parentId];
  }
  return depth;
}
function dependsOnDone(tree, node) {
  return (node.dependsOn ?? []).every((id) => tree.nodes[id]?.status === "done");
}
function parentAllowsReady(tree, node) {
  if (node.parentId === null) return true;
  return tree.nodes[node.parentId]?.status === "waiting";
}
function recomputeReadiness(tree) {
  for (const id of tree.order) {
    const node = tree.nodes[id];
    if (!node) continue;
    if (node.status === "done" || node.status === "running") continue;
    const canReady = dependsOnDone(tree, node) && parentAllowsReady(tree, node);
    if (node.status === "waiting") {
      if (allChildrenDone(tree, id) && canReady) node.status = "ready";
      continue;
    }
    if (!canReady) {
      node.status = "blocked";
      continue;
    }
    if (node.status === "blocked" && (node.dependsOn ?? []).length > 0) {
      node.status = "needs-update";
      continue;
    }
    if (node.status !== "needs-update") node.status = "ready";
  }
}
function setGoal(tree, nodeId, goal) {
  const next = cloneTree(tree);
  const node = next.nodes[nodeId];
  if (!node) throw new Error(`unknown node ${nodeId}`);
  const text = goal.trim();
  if (!text) throw new Error("updated goal must be non-empty");
  node.goal = text;
  if (node.status === "needs-update") node.status = "ready";
  next.lastOp = "update";
  next.selectedId = nodeId;
  return next;
}
function chainSiblingDependsOn(children, ids, type) {
  let previous = null;
  return children.map((child, index) => {
    if (child.type !== type) return child;
    if (previous && (child.dependsOn === void 0 || child.dependsOn.length === 0)) {
      child = { ...child, dependsOn: [previous] };
    }
    previous = ids[index];
    return child;
  });
}
function markRunning(tree, nodeId) {
  const next = cloneTree(tree);
  const node = next.nodes[nodeId];
  if (!node) throw new Error(`unknown node ${nodeId}`);
  if (node.status !== "ready") throw new Error(`node ${nodeId} is not ready`);
  node.status = "running";
  next.lastOp = "dispatch";
  next.selectedId = nodeId;
  return next;
}

// packages/article-tree/src/getinfo.ts
var MAX_ANCESTOR_DEPTH = 4;
function collectAncestors(tree, node, maxDepth) {
  const ancestors = [];
  const seen = /* @__PURE__ */ new Set();
  let parentId = node.parentId;
  while (parentId && ancestors.length < maxDepth) {
    if (parentId === node.id || seen.has(parentId)) break;
    seen.add(parentId);
    const parent = tree.nodes[parentId];
    if (!parent) break;
    ancestors.push({ id: parent.id, goal: parent.goal, result: parent.result });
    parentId = parent.parentId;
  }
  ancestors.reverse();
  return ancestors;
}
function collectDeps(tree, node) {
  return (node.dependsOn ?? []).map((id) => {
    const dep = tree.nodes[id];
    if (!dep) return { id, goal: "", result: null };
    return { id: dep.id, goal: dep.goal, result: dep.result };
  });
}
function collectGraph(tree) {
  return tree.order.flatMap((id) => {
    const node = tree.nodes[id];
    if (!node) return [];
    return [{
      id: node.id,
      type: node.type,
      goal: node.goal,
      deps: [...node.dependsOn ?? []],
      status: node.status
    }];
  });
}
function getExecuteInfo(tree, nodeId, corpus, ancestorDepth = MAX_ANCESTOR_DEPTH) {
  const node = tree.nodes[nodeId];
  if (!node) throw new Error(`unknown node ${nodeId}`);
  return {
    node,
    ancestors: collectAncestors(tree, node, ancestorDepth),
    deps: collectDeps(tree, node),
    draft: corpus.draft
  };
}
function getPlannerInfo(tree, nodeId, corpus, ancestorDepth = MAX_ANCESTOR_DEPTH) {
  const info = getExecuteInfo(tree, nodeId, corpus, ancestorDepth);
  return { ...info, graph: collectGraph(tree) };
}

// packages/article-tree/src/session.ts
function loadLabChildId(session, nodeId) {
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i];
    if (event?.type === "article/lab" && event.data.nodeId === nodeId) return event.data.childId;
  }
  return null;
}
function saveLabChild(session, nodeId, childId) {
  session.append("article/lab", { nodeId, childId });
}

// packages/writehere/src/scheduler.ts
import { createAssistantMessage, createUserMessage as createUserMessage2 } from "@deepseek-ai/dsh-llm";

// packages/writehere/src/parse.ts
var UPDATE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { goal: { type: "string", minLength: 1 } },
  required: ["goal"]
};
var DECIDE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    atomic: { type: "boolean" },
    children: {
      type: "array",
      minItems: 1,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          type: { type: "string", enum: ["task", "think", "write"] },
          goal: { type: "string", minLength: 1 },
          atomic: { type: "boolean" },
          dependsOn: { type: "array", items: { type: "string" } },
          length: { type: "integer", exclusiveMinimum: 0 }
        },
        required: ["type", "goal"]
      }
    }
  }
};
function structuredResponseFormat(kind) {
  if (process.env.DSH_JSON_SCHEMA !== "1") return { type: "json_object" };
  return {
    type: "json_schema",
    json_schema: {
      name: kind === "update" ? "writehere_update" : "writehere_decide",
      strict: true,
      schema: kind === "update" ? UPDATE_JSON_SCHEMA : DECIDE_JSON_SCHEMA
    }
  };
}
var DECIDE_RESPONSE_FORMAT = structuredResponseFormat("decide");
var UPDATE_RESPONSE_FORMAT = structuredResponseFormat("update");
var NODE_TYPES = /* @__PURE__ */ new Set(["task", "search", "think", "write"]);
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function parseJsonObject(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = (fenced?.[1] ?? text).trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("expected a JSON object");
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    throw new Error("expected a JSON object");
  }
}
function parseChildren(value) {
  if (!Array.isArray(value) || value.length < 1) {
    throw new Error("plan children must be a non-empty array");
  }
  return value.map((entry, index) => {
    if (!isRecord(entry)) throw new Error(`child ${index} must be an object`);
    const keys = Object.keys(entry);
    for (const key of keys) {
      if (key !== "type" && key !== "goal" && key !== "atomic" && key !== "dependsOn" && key !== "id" && key !== "length") {
        throw new Error(`child ${index} has unknown key ${key}`);
      }
    }
    if (typeof entry.type !== "string" || !NODE_TYPES.has(entry.type)) {
      throw new Error(`child ${index} type must be task (or its alias search), think, or write`);
    }
    if (typeof entry.goal !== "string" || entry.goal.trim() === "") {
      throw new Error(`child ${index} goal must be a non-empty string`);
    }
    if (entry.atomic !== void 0 && typeof entry.atomic !== "boolean") {
      throw new Error(`child ${index} atomic must be a boolean`);
    }
    if (entry.dependsOn !== void 0) {
      const raw = Array.isArray(entry.dependsOn) ? entry.dependsOn : [entry.dependsOn];
      const ids = [];
      for (const id of raw) {
        if (typeof id === "string" && id.trim()) ids.push(id.trim());
        else if (typeof id === "number" && Number.isInteger(id)) ids.push(String(id));
        else throw new Error(`child ${index} dependsOn must be a string array`);
      }
      if (ids.length === 0) throw new Error(`child ${index} dependsOn must be a string array`);
      entry.dependsOn = ids;
    }
    if (entry.id !== void 0 && (typeof entry.id !== "string" || entry.id.trim() === "")) {
      throw new Error(`child ${index} id must be a non-empty string`);
    }
    if (entry.length !== void 0 && (typeof entry.length !== "number" || !Number.isInteger(entry.length) || entry.length <= 0)) {
      throw new Error(`child ${index} length must be a positive integer`);
    }
    const child = {
      type: entry.type === "search" ? "task" : entry.type,
      goal: entry.goal,
      ...entry.atomic === void 0 ? {} : { atomic: entry.atomic },
      ...entry.dependsOn === void 0 ? {} : { dependsOn: entry.dependsOn },
      ...entry.id === void 0 ? {} : { id: entry.id },
      ...entry.length === void 0 ? {} : { length: entry.length }
    };
    return child;
  });
}
function parseNodeUpdate(text) {
  const value = parseJsonObject(text);
  if (!isRecord(value)) throw new Error("update must be a JSON object");
  for (const key of Object.keys(value)) {
    if (key !== "goal") throw new Error(`update has unknown key ${key}`);
  }
  if (typeof value.goal !== "string" || value.goal.trim() === "") {
    throw new Error("update goal must be a non-empty string");
  }
  return { goal: value.goal.trim() };
}
function parseNodeDecision(text) {
  const value = parseJsonObject(text);
  if (!isRecord(value)) throw new Error("decision must be a JSON object");
  for (const key of Object.keys(value)) {
    if (key !== "atomic" && key !== "children") {
      throw new Error(`decision has unknown key ${key}`);
    }
  }
  if (value.atomic === true) {
    if (value.children !== void 0) throw new Error("atomic decision cannot include children");
    return { kind: "atomic" };
  }
  if (value.atomic !== void 0 && value.atomic !== false) {
    throw new Error("atomic must be a boolean");
  }
  return { kind: "plan", children: parseChildren(value.children) };
}

// packages/writehere/src/tree.ts
import { mkdir as mkdir2, readFile as readFile3, writeFile } from "node:fs/promises";
import { resolve as resolve3 } from "node:path";
function loadTree(session) {
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i];
    if (event?.type === "article/tree") {
      return event.data.tree;
    }
  }
  return null;
}
function saveTree(session, tree) {
  session.append("article/tree", { tree });
}
function ensureTree(session, topic) {
  const existing = loadTree(session);
  if (existing) return existing;
  return startTree(session, topic);
}
function startTree(session, topic) {
  const tree = createArticleTree(topic);
  saveTree(session, tree);
  return tree;
}
function markAtomic(tree, nodeId) {
  const next = cloneTree(tree);
  const node = next.nodes[nodeId];
  if (!node) throw new Error(`unknown node ${nodeId}`);
  node.atomic = true;
  next.lastOp = "is-atomic";
  next.selectedId = nodeId;
  return next;
}
var MAX_HEADING_CHARS = 64;
function sectionHeading(goal) {
  const flat = goal.trim().replace(/\s+/g, " ");
  const lead = flat.split(/[。！？!?\n：:]/u)[0]?.trim() || flat;
  return lead.length > MAX_HEADING_CHARS ? `${lead.slice(0, MAX_HEADING_CHARS)}\u2026` : lead;
}
function articleSlug(topic) {
  const slug = topic.normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[_\s]+/g, "-").toLowerCase().slice(0, 48);
  return slug || "article";
}
async function readDraft(cwd, topic) {
  if (!cwd) return "";
  const slug = articleSlug(topic);
  const candidates = [resolve3(cwd, "articles", slug, "article.md"), resolve3(cwd, "article.md")];
  for (const path of candidates) {
    try {
      return await readFile3(path, "utf8");
    } catch {
      continue;
    }
  }
  return "";
}
async function writeDraft(cwd, topic, markdown) {
  if (!cwd) return;
  const slug = articleSlug(topic);
  const dir = resolve3(cwd, "articles", slug);
  const body = markdown.startsWith("#") ? markdown : `# ${topic}

${markdown}`;
  try {
    await mkdir2(dir, { recursive: true });
    await writeFile(resolve3(dir, "article.md"), body, "utf8");
    await writeFile(resolve3(cwd, "article.md"), body, "utf8");
  } catch {
  }
}
async function appendWriteSection(cwd, topic, goal, result) {
  if (!cwd) return;
  const existing = await readDraft(cwd, topic);
  const header = existing.trim() ? existing.trimEnd() : `# ${topic}`;
  const section = `## ${sectionHeading(goal)}

${result.trim()}`;
  if (existing.includes(section)) return;
  await writeDraft(cwd, topic, `${header}

${section}
`);
}

// packages/writehere/src/skills.ts
import { readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
var METHODOLOGY_MARKERS = ["\u5EF6\u8FDF\u63ED\u6653", "\u6700\u5C0F\u5145\u5206\u7406\u89E3"];
var METHODOLOGY_OPEN = "<article-methodology>";
var METHODOLOGY_CLOSE = "</article-methodology>";
function shippedSkillsRoot() {
  return fileURLToPath(new URL(
    "../../../presets/article-editor/skills/",
    import.meta.url
  ));
}
function userSkillsRoots() {
  const home = homedir();
  return [
    join(home, ".dsh", ".agent-presets", "article-editor", "skills"),
    join(home, ".dsh", ".agent-presets", "xieka", "skills")
  ];
}
function readSkillTree(root) {
  const chunks = [];
  let names;
  try {
    names = readdirSync(root, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  } catch {
    return chunks;
  }
  for (const name2 of names) {
    try {
      const text = readFileSync(join(root, name2, "SKILL.md"), "utf8").trim();
      if (text) chunks.push(`## ${name2}

${text}`);
    } catch {
      continue;
    }
  }
  return chunks;
}
function methodologySkillContext() {
  const seen = /* @__PURE__ */ new Set();
  const parts = [];
  for (const root of [shippedSkillsRoot(), ...userSkillsRoots()]) {
    for (const chunk of readSkillTree(root)) {
      if (seen.has(chunk)) continue;
      seen.add(chunk);
      parts.push(chunk);
    }
  }
  if (parts.length === 0) return "";
  return [METHODOLOGY_OPEN, parts.join("\n\n"), METHODOLOGY_CLOSE].join("\n");
}

// packages/writehere/src/scheduler.ts
var MAX_TICKS = 3e3;
var DRIVER_PLUGIN = "writehere";
function latestUserText(session) {
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i];
    if (event?.type !== "user/message") continue;
    if (event.data.source.kind !== "user") continue;
    const parts = [];
    for (const block of event.data.content) {
      if (block.type === "text" && block.text.trim()) parts.push(block.text.trim());
    }
    const text = parts.join("\n").trim();
    if (text) return text;
  }
  return "";
}
function treeSettled(tree) {
  if (pickReadyNode(tree) !== null) return false;
  return !Object.values(tree.nodes).some((node) => node.status === "running");
}
function ensureDriverEvent(session) {
  if (session.events.some((event) => event.type === "agent/driver")) return;
  session.append("agent/driver", { id: WRITEHERE_DRIVER_ID });
}
async function ensureMemoryIndex(session) {
  if (session.events.some(
    (event) => event.type === "user/message" && event.data.source.kind === "plugin" && event.data.source.plugin === DRIVER_PLUGIN && event.data.content.some((block) => block.type === "text" && block.text.includes(MEMORY_INDEX_OPEN))
  )) return;
  const text = await memoryIndexText(session.header.cwd);
  if (!text) return;
  appendContext(session, text);
}
function ensureMethodologyContext(session) {
  if (session.events.some(
    (event) => event.type === "user/message" && event.data.source.kind === "plugin" && event.data.source.plugin === DRIVER_PLUGIN && event.data.content.some((block) => block.type === "text" && block.text.includes("<article-methodology>"))
  )) return;
  const text = methodologySkillContext();
  if (!text) return;
  appendContext(session, text);
}
function formatGetInfo(info, instruction, extra = "") {
  const body = [
    GET_INFO_OPEN,
    JSON.stringify(info),
    GET_INFO_CLOSE,
    "",
    instruction
  ];
  if (extra) body.push("", extra);
  return body.join("\n");
}
function childrenExtra(tree, node) {
  if (node.children.length === 0) return "";
  const lines = node.children.map((id) => {
    const child = tree.nodes[id];
    if (!child) return `## ${id}
`;
    return `## ${child.id} (${child.type})
${child.result ?? ""}`;
  });
  return `<article-children>
${lines.join("\n\n")}
</article-children>`;
}
function appendContext(session, text) {
  session.append(
    "user/message",
    createUserMessage2({
      content: [{ type: "text", text }],
      source: { kind: "plugin", plugin: DRIVER_PLUGIN }
    }),
    { surfaceOp: "append" }
  );
}
async function persistGetInfo(host, tree, nodeId, instruction, extra = "", kind = "execute") {
  const draft = await readDraft(host.session.header.cwd, tree.topic);
  const info = kind === "planner" ? getPlannerInfo(tree, nodeId, { draft }) : getExecuteInfo(tree, nodeId, { draft });
  host.session.append("article/get-info", { info });
  ensureMethodologyContext(host.session);
  await ensureMemoryIndex(host.session);
  if (kind === "planner") {
    const node = tree.nodes[nodeId];
    const hits = await memoryHitsText(host.session.header.cwd, node?.goal ?? tree.topic);
    if (hits) appendContext(host.session, hits);
  }
  appendContext(host.session, formatGetInfo(info, instruction, extra));
}
function reportTextForChild(session, childId) {
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i];
    if (event?.type !== "user/message") continue;
    const source = event.data.source;
    if (source.kind !== "subagent-report" || source.senderSessionId !== childId) continue;
    const text = event.data.content.filter((block) => block.type === "text").map((block) => block.text.trim()).filter(Boolean).join("\n").trim();
    return text || null;
  }
  return null;
}
function settleRunningLabs(session, tree) {
  let next = tree;
  for (const id of tree.order) {
    const node = next.nodes[id];
    if (!node || node.status !== "running" || !isLabType(node.type)) continue;
    const childId = loadLabChildId(session, id);
    if (!childId) continue;
    const finding = reportTextForChild(session, childId);
    if (!finding) continue;
    next = commitNode(next, id, finding);
  }
  if (next !== tree) saveTree(session, next);
  return next;
}
function requireTree(session) {
  const tree = loadTree(session);
  if (!tree) throw new Error("article tree missing after ensure");
  return tree;
}
function requireNode(tree, nodeId) {
  const node = tree.nodes[nodeId];
  if (!node) throw new Error(`unknown node ${nodeId}`);
  return node;
}
async function updateSelected(host, tree, nodeId) {
  await persistGetInfo(host, tree, nodeId, UPDATE_INSTRUCTION, "", "planner");
  let update;
  try {
    update = parseNodeUpdate(await host.completeText({ responseFormat: UPDATE_RESPONSE_FORMAT }));
  } catch {
    appendContext(host.session, UPDATE_INSTRUCTION);
    update = parseNodeUpdate(await host.completeText({ responseFormat: UPDATE_RESPONSE_FORMAT }));
  }
  const next = setGoal(tree, nodeId, update.goal);
  saveTree(host.session, next);
  host.session.append("article/update", { nodeId, goal: update.goal });
  return next;
}
function decideInstructionFor(node) {
  return node.type === "write" ? DECIDE_WRITE_INSTRUCTION : DECIDE_ATOM_INSTRUCTION;
}
async function decide(host, tree, nodeId) {
  const node = requireNode(tree, nodeId);
  await persistGetInfo(host, tree, nodeId, decideInstructionFor(node), "", "planner");
  try {
    return parseNodeDecision(await host.completeText({ responseFormat: DECIDE_RESPONSE_FORMAT }));
  } catch {
    appendContext(host.session, DECIDE_RETRY_INSTRUCTION);
    return parseNodeDecision(await host.completeText({ responseFormat: DECIDE_RESPONSE_FORMAT }));
  }
}
async function completeProse(host) {
  const first = (await host.completeText()).trim();
  if (first) return first;
  appendContext(host.session, "Previous reply was empty. Return the result prose only.");
  const second = (await host.completeText()).trim();
  if (!second) throw new Error("empty model result");
  return second;
}
function labProvider(subagents) {
  if (subagents.getProvider?.("spawn")) return "spawn";
  const names = subagents.list?.() ?? [];
  return names[0] ?? "spawn";
}
function appendLabUnavailable(host) {
  const message = createAssistantMessage({
    content: [{ type: "text", text: LAB_UNAVAILABLE_TEXT }],
    source: {
      provider: host.options.provider ?? "writehere",
      model: host.options.model ?? "writehere"
    }
  });
  host.session.append(
    "assistant/message",
    { turn: host.turn, step: host.step, message },
    { surfaceOp: "append" }
  );
}
async function dispatchTask(host, tree, node) {
  const subagents = host.ctx.get("subagents");
  if (subagents?.startContinuable === void 0) {
    appendLabUnavailable(host);
    return "park";
  }
  const retrieval = isRetrievalGoal(node.goal);
  const prompt = [{
    type: "text",
    text: retrieval ? `${RETRIEVAL_PROMPT_PREFIX}${node.goal}` : node.goal
  }];
  const existing = loadLabChildId(host.session, node.id);
  try {
    if (existing && typeof subagents.followup === "function") {
      await subagents.followup(host.self, existing, prompt, {
        source: { kind: "coordinator", form: "relay", senderSessionId: host.self.id },
        signal: host.signal
      });
    } else {
      const started = await subagents.startContinuable({
        provider: labProvider(subagents),
        label: `task:${node.id}`,
        request: {
          prompt,
          parent: host.self,
          preset: "standard",
          persona: retrieval ? RETRIEVAL_PERSONA : LAB_PERSONA
        },
        signal: host.signal
      });
      saveLabChild(host.session, node.id, started.childId);
    }
  } catch {
    appendLabUnavailable(host);
    return "park";
  }
  saveTree(host.session, markRunning(tree, node.id));
  return "park";
}
async function executeAtomic(host, tree, node) {
  if (isLabType(node.type)) return dispatchTask(host, tree, node);
  const composing = node.type === "write" && node.children.length > 0 && allChildrenDone(tree, node.id);
  const instruction = node.type === "think" ? EXECUTE_THINK_INSTRUCTION : composing ? COMPOSE_WRITE_INSTRUCTION : writeLengthInstruction(node.length);
  await persistGetInfo(host, tree, node.id, instruction, childrenExtra(tree, node), "execute");
  const result = await completeProse(host);
  const committed = commitNode(tree, node.id, result);
  saveTree(host.session, committed);
  if (node.type === "write" && node.children.length === 0) {
    await appendWriteSection(host.session.header.cwd, committed.topic, node.goal, result);
  }
  return "continue";
}
async function tick(host, tree, nodeId) {
  const current = await updateSelected(host, tree, nodeId);
  const node = requireNode(current, nodeId);
  if (node.children.length > 0 && allChildrenDone(current, nodeId)) {
    return executeAtomic(host, current, node);
  }
  if (!isAtomicFlag(node)) {
    const decision = await decide(host, current, nodeId);
    if (decision.kind === "atomic") {
      const atomic = markAtomic(current, nodeId);
      saveTree(host.session, atomic);
      return executeAtomic(host, atomic, requireNode(atomic, nodeId));
    }
    saveTree(host.session, decomposeNode(current, nodeId, decision.children));
    return "continue";
  }
  return executeAtomic(host, current, node);
}
async function runWriteHereScheduler(host) {
  ensureDriverEvent(host.session);
  const topic = latestUserText(host.session);
  const existing = loadTree(host.session);
  if (!existing) {
    if (!topic) return "completed";
    ensureTree(host.session, topic);
  } else if (treeSettled(settleRunningLabs(host.session, existing)) && topic && topic !== existing.topic) {
    startTree(host.session, topic);
  }
  for (let i = 0; i < MAX_TICKS; i++) {
    const tree = settleRunningLabs(host.session, requireTree(host.session));
    const nodeId = pickReadyNode(tree);
    if (nodeId === null) return "completed";
    const end = await tick(host, tree, nodeId);
    if (end === "park") return "completed";
  }
  throw new Error("writehere scheduler exceeded the per-turn tick limit");
}

// packages/writehere/src/agent.ts
function liveMessages(messages) {
  let lastGetInfo = -1;
  let lastMemory = -1;
  for (let i = 0; i < messages.length; i++) {
    const message = messages[i];
    if (message === void 0 || message.role !== "user") continue;
    const text = message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
    if (text.includes(GET_INFO_OPEN)) lastGetInfo = i;
    if (text.includes(MEMORY_OPEN)) lastMemory = i;
  }
  if (lastGetInfo < 0 && lastMemory < 0) return messages;
  return messages.filter((message, index) => {
    if (index === lastGetInfo || index === lastMemory) return true;
    if (message.role !== "user") return true;
    const text = message.content.filter((block) => block.type === "text").map((block) => block.text).join("");
    if (lastGetInfo >= 0 && text.includes(GET_INFO_OPEN)) return false;
    if (lastMemory >= 0 && text.includes(MEMORY_OPEN)) return false;
    return true;
  });
}
function requestProposal(header) {
  if (header.adapterDefaults === void 0) return header.config;
  const proposal = { ...header.config };
  if (header.adapterDefaults.reasoningEffort === true) delete proposal.reasoningEffort;
  if (header.adapterDefaults.maxTokens === true) delete proposal.maxTokens;
  return proposal;
}
function assistantText(message) {
  return message.content.filter((block) => block.type === "text" && typeof block.text === "string").map((block) => block.text ?? "").join("");
}
var WriteHereAgent = class {
  constructor(loopCtx, id, options, session) {
    this.loopCtx = loopCtx;
    this.id = id;
    this.options = options;
    this.session = session;
    this.dispatch = agentEvents(loopCtx, this);
    this.inbox = new Inbox(session, {
      inserted: (message) => {
        this.dispatch.emit("agent/inbox/inserted", { message });
      },
      discarded: (message) => {
        this.dispatch.emit("agent/inbox/discarded", { message });
      },
      claimed: (message, turn) => {
        this.dispatch.emit("agent/inbox/claimed", { message, turn });
      }
    });
    const lastTurn = session.events.findLast((event) => event.type === "turn/start")?.data.turn ?? 0;
    this.phase = { kind: "idle", lastTurn };
    this.scope = createScope(loopCtx, this);
    this.ctx = this.scope.ctx.extend({ agent: this });
    this.runtimeContext = new RuntimeContextProjection(this.ctx, session);
  }
  loopCtx;
  id;
  options;
  session;
  inbox;
  phase;
  activityDone = Promise.resolve();
  /** The agent-scoped registration boundary; the lifecycle owner unwinds it after the driver exits. */
  scope;
  ctx;
  /** Fused dispatcher, built once in the constructor so hot-path dispatches never allocate. */
  dispatch;
  /** Whether this loop instance has appended its initial/resume request anchor. */
  requestHeaderLogged = false;
  runtimeContext;
  get status() {
    return this.phase.kind === "idle" || this.phase.kind === "maintenance" ? "idle" : "running";
  }
  /** Commit a phase and publish its externally visible status transition. */
  setPhase(next) {
    const previousStatus = this.status;
    this.phase = next;
    const status = this.status;
    if (status !== previousStatus) {
      this.dispatch.emit("agent/status", { status });
    }
  }
  send(message, target, wakeup) {
    const wakingAfterAbort = wakeup && this.phase.kind !== "idle" && this.phase.abort.signal.aborted;
    const resolvedTarget = wakingAfterAbort ? "next-turn" : target;
    this.inbox.splice(resolvedTarget, Infinity, 0, [message]);
    if (wakeup) this.wakeDriver(wakingAfterAbort);
  }
  followup(input) {
    this.send(input, "next-turn", true);
  }
  steer(input) {
    this.send(input, "next-step", true);
  }
  inject(input) {
    this.send(input, "next-step", false);
  }
  cancel(cause, options = {}) {
    if (!options.keepInbox) {
      this.inbox.clear();
      if (this.phase.kind !== "idle") this.phase.wakeRequested = false;
    }
    if (this.phase.kind !== "idle") this.phase.abort.abort(cause);
  }
  runMaintenance(job) {
    if (this.phase.kind !== "idle") throw new Error(`agent "${this.id}" already has active work`);
    const done = Promise.withResolvers();
    const maintenance = {
      kind: "maintenance",
      abort: new AbortController(),
      lastTurn: this.phase.lastTurn,
      wakeRequested: false
    };
    this.setPhase(maintenance);
    this.activityDone = done.promise;
    return (async () => {
      try {
        return await job(maintenance.abort.signal);
      } finally {
        this.setPhase({ kind: "idle", lastTurn: maintenance.lastTurn });
        if (maintenance.wakeRequested && this.inbox.hasPending) this.wakeDriver();
        done.resolve();
      }
    })();
  }
  /**
   * Start one driver, or latch its wake behind maintenance or an aborted
   * activity. A wake sent while idle always opens its turn boundary, even
   * when its message was cleared; only a latched replay is suppressed when
   * the queue no longer holds the wake.
   * @param wakeAfterAbort - the {@link send} classification, captured before
   *   the inbox insertion so a reentrant cancel cannot reclassify it.
   */
  wakeDriver(wakeAfterAbort = false) {
    if (this.phase.kind !== "idle") {
      const reason = this.phase.abort.signal.reason;
      if (reason?.kind !== "disposed" && (this.phase.kind === "maintenance" || wakeAfterAbort)) {
        this.phase.wakeRequested = true;
      }
      return;
    }
    const driver = Promise.withResolvers();
    this.activityDone = driver.promise;
    this.setPhase({
      kind: "running",
      abort: new AbortController(),
      turn: this.phase.lastTurn,
      step: 0,
      wakeRequested: false
    });
    this.loopCtx.agents.withInitiator(this, () => this.kick()).then(driver.resolve, driver.reject);
  }
  async whenIdle() {
    let activity;
    do {
      await (activity = this.activityDone);
    } while (activity !== this.activityDone);
  }
  /** Report one failure at its live boundary, then preserve it for driver containment. */
  throwError(error) {
    const turn = this.phase.kind === "running" ? this.phase.turn : this.phase.lastTurn;
    const step = this.phase.kind === "running" ? this.phase.step : 0;
    this.dispatch.emit("agent/error", { turn, step, error });
    throw error;
  }
  async kick() {
    try {
      while (await this.turn()) {
      }
    } catch (_error) {
    } finally {
      if (this.phase.kind === "running") {
        const { turn, wakeRequested } = this.phase;
        this.setPhase({ kind: "idle", lastTurn: turn });
        if (wakeRequested && this.inbox.hasPending) this.wakeDriver();
      }
    }
  }
  /* jscpd:ignore-start */
  async preStep(target, position) {
    if (this.phase.kind !== "running") throw new Error(`agent "${this.id}": pre-step outside running phase`);
    const signal = this.phase.abort.signal;
    const claimed = this.inbox.claim(target, position.turn);
    const assembly = await this.loopCtx.systemPrompt.assemble(assembleContextFor(this, signal));
    signal.throwIfAborted();
    const sections = renderContextSections(assembly);
    const context = this.runtimeContext.project(joinContextSections(sections), sections);
    const decision = await this.dispatch.waterfall(
      "agent/pre-step",
      { messages: claimed, ...position, signal },
      () => Promise.resolve({
        kind: "enter",
        messages: context === void 0 ? claimed : [...claimed, context]
      })
    );
    signal.throwIfAborted();
    return decision.kind === "reject" ? decision : { ...decision, assembly };
  }
  /** Open one turn before claiming its first proposed step. */
  async turn() {
    if (this.phase.kind !== "running") {
      this.throwError(new Error(`agent "${this.id}": turn without driver reservation`));
    }
    const phase = this.phase;
    const { signal } = phase.abort;
    signal.throwIfAborted();
    const turn = phase.turn + 1;
    try {
      this.session.append("turn/start", { turn });
    } catch (error) {
      this.throwError(error);
    }
    phase.turn = turn;
    let turnEnds = null;
    let target = "next-turn";
    try {
      while (true) {
        signal.throwIfAborted();
        const step = phase.step + 1;
        const decision = await this.preStep(target, { turn, step });
        if (decision.kind === "reject") {
          turnEnds = { kind: "blocked" };
          return false;
        }
        if (turnEnds && decision.messages.length === 0) break;
        if (phase.step === 0 && decision.messages.length === 0) {
          turnEnds = { kind: "completed" };
          return false;
        }
        signal.throwIfAborted();
        this.session.append("step/start", { turn, step });
        phase.step = step;
        try {
          for (const message of decision.messages) {
            this.session.append("user/message", message, { surfaceOp: "append" });
          }
          const stepEnd = await this.step(decision.assembly);
          if (turnEnds === null || turnEnds.kind !== "max-tokens") turnEnds = stepEnd;
        } finally {
          this.session.append("step/end", { turn, step });
        }
        signal.throwIfAborted();
        if (turnEnds && this.inbox.nextStep.length === 0) {
          await this.dispatch.serial("agent/turn-stopping", { turn, signal });
          signal.throwIfAborted();
        }
        if (turnEnds && this.inbox.nextStep.length === 0) break;
        target = "next-step";
      }
    } catch (error) {
      if (signal.aborted) {
        turnEnds = { kind: "aborted", reason: signal.reason };
        throw error;
      }
      turnEnds = {
        kind: "error",
        error: error instanceof LlmError ? error.failure : { message: errorChain(error), code: "UNKNOWN" }
      };
      this.throwError(error);
    } finally {
      try {
        this.session.append("turn/end", { turn, reason: turnEnds });
      } catch (error) {
        this.throwError(error);
      }
    }
    if (!this.inbox.hasPending) return false;
    phase.abort = new AbortController();
    phase.wakeRequested = false;
    phase.step = 0;
    return true;
  }
  /* jscpd:ignore-end */
  async step(assembly) {
    if (this.phase.kind !== "running") throw new Error(`agent "${this.id}": step outside running phase`);
    const { turn, step, abort: { signal } } = this.phase;
    signal.throwIfAborted();
    await runWriteHereScheduler({
      session: this.session,
      ctx: this.ctx,
      self: this,
      options: this.options,
      turn,
      step,
      signal,
      completeText: (options) => this.completeText(assembly, options?.responseFormat)
    });
    return { kind: "completed" };
  }
  /**
   * One no-tools model call whose messages are `session.deriveMessages()`.
   * Logs `request/header` the same way ReactLoopAgent does, so a reconstructable
   * request is the logged surface plus the latest header.
   */
  async completeText(assembly, responseFormat) {
    if (this.phase.kind !== "running") throw new Error(`agent "${this.id}": completeText outside running phase`);
    const { turn, step, abort: { signal } } = this.phase;
    const system = renderPrompt(assembly);
    const emptyTools = [];
    while (true) {
      const { request, preparedCall } = await this.buildRequest(
        turn,
        step,
        emptyTools,
        system,
        liveMessages(this.session.deriveMessages()),
        signal,
        responseFormat
      );
      const assembler = new BlockAssembler();
      const chunkSeqs = [];
      const stream = preparedCall?.stream(request) ?? this.loopCtx.llm.stream(request);
      signal.throwIfAborted();
      for await (const chunk of stream) {
        signal.throwIfAborted();
        chunkSeqs.push(this.session.append("assistant/chunk", { turn, step, chunk }).seq);
        assembler.push(chunk);
      }
      signal.throwIfAborted();
      const finish = assembler.finish;
      if (finish.kind === "error" || finish.kind === "aborted") {
        const action = await this.dispatch.waterfall(
          "agent/request-error",
          {
            turn,
            step,
            provider: request.provider,
            failure: finish.failure,
            retryPolicy: preparedCall?.retryPolicy,
            signal
          },
          () => Promise.resolve(void 0)
        );
        signal.throwIfAborted();
        if (action?.kind !== "retry") {
          throw new LlmError(finish.failure.message, finish.failure.code, finish.failure);
        }
        continue;
      }
      const message = createAssistantMessage2({
        content: assembler.blocks(),
        source: {
          provider: request.provider,
          model: request.model,
          ...assembler.replayState !== void 0 ? { replayState: assembler.replayState } : {}
        }
      });
      this.session.append(
        "assistant/message",
        {
          turn,
          step,
          message,
          ...assembler.usage === void 0 ? {} : { usage: assembler.usage }
        },
        { surfaceOp: "append", sourceEventSeqs: chunkSeqs }
      );
      return assistantText(message);
    }
  }
  /**
   * Compose one frozen request and bind it to the adapter registration that
   * resolved its exact-model defaults.
   */
  async buildRequest(turn, step, tools, system, boundaryMessages, signal, responseFormat) {
    const { session } = this;
    const persistedHeader = session.requestHeader();
    const persistedConfig = persistedHeader?.config;
    const route = { provider: this.options.provider ?? "", model: this.options.model ?? "" };
    const reasoningEffort = persistedConfig?.provider === route.provider && persistedConfig.model === route.model && persistedHeader?.adapterDefaults?.reasoningEffort !== true ? persistedConfig.reasoningEffort : void 0;
    const maxTokens = this.options.maxTokens;
    const seedConfig = deepFreeze(structuredClone(
      this.requestHeaderLogged ? requestProposal(persistedHeader) : {
        ...route,
        ...reasoningEffort === void 0 ? {} : { reasoningEffort },
        ...maxTokens === void 0 ? {} : { maxTokens }
      }
    ));
    const proposedConfig = await this.dispatch.waterfall(
      "agent/request",
      { turn, step, signal },
      () => Promise.resolve(seedConfig)
    );
    signal.throwIfAborted();
    if (!proposedConfig.provider || !proposedConfig.model) {
      throw new Error(`agent "${this.id}" has no provider/model: set AgentOptions.provider and AgentOptions.model or supply both via the agent/request waterfall`);
    }
    let config;
    let preparedCall;
    try {
      preparedCall = await this.loopCtx.llm.prepareCall(proposedConfig, signal);
      config = preparedCall.config;
    } catch (error) {
      if (!(error instanceof LlmError) || error.code !== "NO_ADAPTER") throw error;
      config = proposedConfig;
    }
    signal.throwIfAborted();
    const header = canonicalHeader({
      config,
      ...preparedCall === void 0 ? {} : { adapterDefaults: preparedCall.adapterDefaults },
      ...system ? { system } : {},
      ...tools.length > 0 ? { tools } : {}
    });
    const baseline = this.session.requestHeader();
    if (!this.requestHeaderLogged) {
      this.session.append("request/header", { header, reason: baseline === void 0 ? "initial" : "resume" });
      this.requestHeaderLogged = true;
    } else if (baseline === void 0 || !headerEquals(baseline, header)) {
      this.session.append("request/header", { header, reason: "change" });
    }
    const contextWindow = preparedCall?.context?.contextWindow;
    const requestContext = {
      provider: config.provider,
      model: config.model,
      ...contextWindow === void 0 ? {} : { contextWindow }
    };
    const previousContext = session.requestContext();
    if (previousContext?.provider !== requestContext.provider || previousContext.model !== requestContext.model || previousContext.contextWindow !== requestContext.contextWindow) {
      session.append("request/context", requestContext);
    }
    signal.throwIfAborted();
    const request = markAgentLoopRequest(deepFreeze({
      ...header.config,
      messages: boundaryMessages,
      ...header.system !== void 0 ? { system: header.system } : {},
      ...header.tools !== void 0 ? { tools: header.tools } : {},
      ...responseFormat === void 0 ? {} : { responseFormat },
      sessionId: this.session.id,
      signal
    }));
    return { request, ...preparedCall === void 0 ? {} : { preparedCall } };
  }
};

// packages/writehere/src/install-preset.ts
import { cpSync, existsSync, mkdirSync } from "node:fs";
import { homedir as homedir2 } from "node:os";
import { dirname as dirname2, join as join2 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
function installShippedPreset() {
  const packageRoot = join2(dirname2(fileURLToPath2(import.meta.url)), "..");
  const src = join2(packageRoot, "presets", "article-editor");
  if (!existsSync(join2(src, "agent.cordis.yml"))) return;
  const home = process.env.DSH_HOME?.trim() || join2(homedir2(), ".dsh");
  const dst = join2(home, ".agent-presets", "article-editor");
  if (existsSync(join2(dst, "agent.cordis.yml"))) return;
  mkdirSync(dirname2(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
}

// packages/writehere/src/index.ts
var name = "writehere";
var inject = ["agentDrivers"];
function apply(ctx) {
  installShippedPreset();
  ctx.agentDrivers.register(WRITEHERE_DRIVER_ID, WriteHereAgent);
  ctx.agentDrivers.bindPreset("article-editor", WRITEHERE_DRIVER_ID);
  ctx.agentDrivers.bindPreset("xieka", WRITEHERE_DRIVER_ID);
}
export {
  DECIDE_ATOM_INSTRUCTION,
  DECIDE_INSTRUCTION,
  DECIDE_JSON_SCHEMA,
  DECIDE_RESPONSE_FORMAT,
  DECIDE_WRITE_INSTRUCTION,
  EXECUTE_THINK_INSTRUCTION,
  EXECUTE_WRITE_INSTRUCTION,
  GET_INFO_CLOSE,
  GET_INFO_OPEN,
  LAB_UNAVAILABLE_TEXT,
  MEMORY_INDEX_OPEN,
  MEMORY_OPEN,
  METHODOLOGY_MARKERS,
  RETRIEVAL_PERSONA,
  RETRIEVAL_PROMPT_PREFIX,
  UPDATE_INSTRUCTION,
  UPDATE_JSON_SCHEMA,
  UPDATE_RESPONSE_FORMAT,
  WRITEHERE_DRIVER_ID,
  WriteHereAgent,
  apply,
  inject,
  isRetrievalGoal,
  memoryHitsText,
  memoryIndexText,
  methodologySkillContext,
  name,
  parseNodeDecision,
  parseNodeUpdate,
  structuredResponseFormat
};
