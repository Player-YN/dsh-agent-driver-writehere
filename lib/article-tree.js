// packages/article-tree/src/index.ts
import { z as zod } from "zod";

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
function reviseParent(tree, childId, newGoal) {
  const next = cloneTree(tree);
  const child = next.nodes[childId];
  if (!child) throw new Error(`unknown node ${childId}`);
  if (!child.parentId) throw new Error("root has no parent to revise");
  const parent = next.nodes[child.parentId];
  if (!parent) throw new Error(`missing parent ${child.parentId}`);
  const goal = newGoal.trim();
  if (!goal) throw new Error("revised goal must be non-empty");
  parent.goal = goal;
  next.lastOp = "revise-parent";
  next.selectedId = parent.id;
  return next;
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
var NODE_W = 176;
var XGAP = 214;
function leafCount(tree, id) {
  const node = tree.nodes[id];
  if (!node || node.children.length === 0) return 1;
  return node.children.reduce((sum, cid) => sum + leafCount(tree, cid), 0);
}
function layoutHorizontalTree(tree) {
  const positions = {};
  const leaves = leafCount(tree, "root");
  const height = Math.max(220, leaves * 88 + 24);
  const place = (id, depth, y0, y1) => {
    const node = tree.nodes[id];
    if (!node) return;
    positions[id] = { x: 16 + NODE_W / 2 + depth * XGAP, y: (y0 + y1) / 2 };
    if (node.children.length === 0) return;
    const total = node.children.reduce((sum, cid) => sum + leafCount(tree, cid), 0);
    let cursor = y0;
    for (const cid of node.children) {
      const span = (y1 - y0) * leafCount(tree, cid) / total;
      place(cid, depth + 1, cursor, cursor + span);
      cursor += span;
    }
  };
  place("root", 0, 16, height - 16);
  let maxX = 0;
  for (const point of Object.values(positions)) {
    if (point.x > maxX) maxX = point.x;
  }
  return { positions, width: maxX + NODE_W / 2 + 20, height };
}

// packages/article-tree/src/corpus.ts
import { appendFile, mkdir, readdir, readFile, stat } from "node:fs/promises";
import { dirname, resolve } from "node:path";

// packages/article-tree/src/policy.ts
import { win32 } from "node:path";
var LAB_ROLE = "article-lab";
var EDITOR_PERSONA = "\u4F60\u662F\u6280\u672F\u535A\u5BA2\u535A\u4E3B\u3002WriteHere \u8C03\u5EA6\u5668\u51B3\u5B9A\u4E0B\u4E00\u5F20\u5361\u3002\u66F4\u65B0\u62CD\u53EA\u6539\u5F53\u524D\u8282\u70B9 goal\u3002\u7136\u540E\u4F60\u56DE\u7B54\u662F\u5426\u539F\u5B50\u3001\u5982\u4F55\u62C6\u5361\u3001\u6216\u6210\u7A3F\u6B63\u6587\u3002think \u548C task \u9ED8\u8BA4\u539F\u5B50\uFF0C\u518D\u62C6\u5FC5\u987B\u5199 atomic:false\u3002\u4E0D\u8981\u8C03\u7528\u5DE5\u5177\u3002\u4E00\u7BC7\u53EA\u505A\u4E00\u4E2A\u8BA4\u77E5\u53D8\u5316\u3002\u9009\u9898\u5355\u4F4D\u662F\u77DB\u76FE\uFF0C\u4E0D\u662F\u672F\u8BED\u3002\u7981\u6B62\u5F00\u7EC8\u7AEF\u3002\u68C0\u7D22\u4E0E\u5B9E\u9A8C\u7531\u6807\u51C6\u6A21\u5F0F\u5DE5\u4EBA\u6267\u884C\u3002";
var EDITOR_SYSTEM_PROMPT = [
  "You are the article editor. One article, one cognitive change. Topic unit is a contradiction, not a term.",
  'The WriteHere driver chooses the next tree node. First refine THIS node with {"goal":"..."}. Then reply with decision JSON or node prose.',
  "think and task stay atomic unless the decision sets atomic:false.",
  "Do not call tools. Do not run a shell.",
  "Web search belongs on a worker session, not this driver loop."
].join(" ");
var LAB_PERSONA = "Execute the single assigned task. Do not adopt an editorial persona. Return evidence only.";
function resolveLabPreset(preset) {
  return preset === "minimal" ? "minimal" : "standard";
}
function createLabHandoff(input) {
  const nodeId = input.nodeId.trim();
  const brief = input.brief.trim();
  if (!nodeId) throw new Error("lab handoff requires nodeId");
  if (!brief) throw new Error("lab handoff requires a one-card brief");
  if (/\n\s*#\s|全文|读者正文/.test(brief) && brief.length > 4e3) {
    throw new Error("lab handoff must be one card, not a full article outline");
  }
  return {
    role: LAB_ROLE,
    persona: LAB_PERSONA,
    nodeId,
    brief
  };
}
function labPersonaIsNotEditor(handoff) {
  const persona = handoff.persona;
  return handoff.role === LAB_ROLE && persona !== EDITOR_PERSONA && persona === LAB_PERSONA;
}
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
var SERIES_KINDS = ["continues", "contradicts", "assumes"];
function toPosixRel(rel) {
  return rel.replace(/\\/g, "/");
}
function acceptCorpusRel(cwd, rel) {
  const posix = toPosixRel(rel);
  if (!isBoundedArticlePath(posix, cwd)) return null;
  return resolve(cwd, posix);
}
function asRecord(record) {
  if (record === null || typeof record !== "object" || Array.isArray(record)) {
    throw new Error("ledger record must be an object");
  }
  return { ...record };
}
function requireText(record, key) {
  const value = record[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`ledger ${key} must be a non-empty string`);
  }
  return value.trim();
}
function validateLedgerRecord(kind, record) {
  const raw = asRecord(record);
  if (kind === "concept") {
    return {
      path: "ledger/concepts.jsonl",
      record: {
        ...raw,
        id: requireText(raw, "id"),
        name: requireText(raw, "name"),
        firstArticle: requireText(raw, "firstArticle")
      }
    };
  }
  if (kind === "series") {
    const seriesKind = requireText(raw, "kind");
    if (!SERIES_KINDS.includes(seriesKind)) {
      throw new Error("series kind must be continues, contradicts, or assumes");
    }
    return {
      path: "ledger/series.jsonl",
      record: {
        ...raw,
        from: requireText(raw, "from"),
        to: requireText(raw, "to"),
        kind: seriesKind
      }
    };
  }
  throw new Error(`unknown ledger kind ${kind}`);
}
async function appendLedgerRecord(cwd, kind, record) {
  const validated = validateLedgerRecord(kind, record);
  const abs = resolve(cwd, validated.path);
  await mkdir(dirname(abs), { recursive: true });
  await appendFile(abs, `${JSON.stringify(validated.record)}
`, "utf8");
  return { path: validated.path };
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
async function searchCorpusFiles(cwd, query, files) {
  const needle = query.trim();
  if (!needle) throw new Error("query must be non-empty");
  const lower = needle.toLowerCase();
  const hits = [];
  for (const rel of files) {
    if (hits.length >= MAX_CORPUS_HITS) break;
    const abs = acceptCorpusRel(cwd, rel);
    if (!abs) continue;
    const text = await readBoundedFile(abs);
    if (text === null) continue;
    const index = text.toLowerCase().indexOf(lower);
    if (index < 0) continue;
    const start = Math.max(0, index - 80);
    const end = Math.min(text.length, index + needle.length + 80);
    hits.push({ path: toPosixRel(rel), snippet: text.slice(start, end) });
  }
  return hits;
}
async function searchCorpus(cwd, query) {
  return { hits: await searchCorpusFiles(cwd, query, await listCorpusFiles(cwd)) };
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
function getNodeInfo(tree, nodeId, corpus) {
  return getExecuteInfo(tree, nodeId, { draft: corpus.draft });
}

// packages/article-tree/src/session.ts
function loadTree(session) {
  for (let i = session.events.length - 1; i >= 0; i--) {
    const event = session.events[i];
    if (event?.type === "article/tree") return event.data.tree;
  }
  return null;
}
function saveTree(session, tree) {
  session.append("article/tree", { tree });
}
function loadOrCreate(session, topic) {
  return loadTree(session) ?? createArticleTree(topic);
}
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

// packages/article-tree/src/index.ts
var name = "article-tree";
var inject = [];
var treeSchema = zod.any();
function apply(ctx) {
  ctx.inject(["sessionProjections"], (projectionCtx) => {
    projectionCtx.sessionProjections.register({
      key: "articleTree",
      schema: treeSchema,
      init: () => null,
      apply: (state, event) => {
        if (event.type === "article/tree") return event.data.tree;
        return state;
      },
      view: (state) => state,
      stateVersion: 1
    });
  });
}
export {
  EDITOR_PERSONA,
  EDITOR_SYSTEM_PROMPT,
  LAB_PERSONA,
  MAX_ANCESTOR_DEPTH,
  allChildrenDone,
  appendLedgerRecord,
  apply,
  cloneTree,
  commitNode,
  createArticleTree,
  createLabHandoff,
  decomposeNode,
  getExecuteInfo,
  getNodeInfo,
  getPlannerInfo,
  inject,
  isAtomicFlag,
  isBoundedArticlePath,
  isLabType,
  labPersonaIsNotEditor,
  layoutHorizontalTree,
  loadLabChildId,
  loadOrCreate,
  loadTree,
  markRunning,
  name,
  pickReadyNode,
  resolveLabPreset,
  reviseParent,
  saveLabChild,
  saveTree,
  searchCorpus,
  searchCorpusAny,
  setGoal,
  validateLedgerRecord
};
