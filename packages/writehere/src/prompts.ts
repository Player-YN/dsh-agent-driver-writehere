/** Opening tag around the GetInfo JSON the model sees each scheduler tick. */
export const GET_INFO_OPEN = '<article-get-info>'
/** Closing tag around the GetInfo JSON the model sees each scheduler tick. */
export const GET_INFO_CLOSE = '</article-get-info>'

/** Paper Update(v*, K): refine this node's goal only. */
export const UPDATE_INSTRUCTION = [
  'Reply with a JSON object only.',
  'Use {"goal":"..."} to refine THIS selected node\'s goal from GetInfo.',
  'Do not return children. Do not change a parent node.',
].join(' ')

/** Write parents may split. Legal decide keys stay atomic/children. */
export const DECIDE_WRITE_INSTRUCTION = [
  'Reply with a JSON object only.',
  'Use {"atomic":true} to execute this write node now.',
  'Use {"atomic":false,"children":[{"type":"task"|"think"|"write","goal":"...","atomic":true,"length":200}]} to split it.',
  'A write parent requires at least one write child. Think and task children default to atomic.',
  'To split a think or task child you must set atomic:false on that child. Omitting atomic keeps them atomic.',
  'Optional child length is a composition budget for write children only.',
].join(' ')

/** Think/task default atomic; split only with explicit atomic:false. */
export const DECIDE_ATOM_INSTRUCTION = [
  'Reply with a JSON object only.',
  'Think and task nodes stay atomic unless you set atomic:false.',
  'Prefer {"atomic":true}.',
  'Use {"atomic":false,"children":[{"type":"task"|"think"|"write","goal":"..."}]} only when this node must split, and set atomic:false on any think or task child that should split later.',
].join(' ')

/** @deprecated use DECIDE_WRITE_INSTRUCTION or DECIDE_ATOM_INSTRUCTION */
export const DECIDE_INSTRUCTION = DECIDE_WRITE_INSTRUCTION

/** Instruction for an atomic think node. */
export const EXECUTE_THINK_INSTRUCTION = 'Write the reasoning result for this node. Return only the result prose, not JSON.'

/** Instruction for an atomic write node with no finished children. */
export const EXECUTE_WRITE_INSTRUCTION = 'Write the reader-facing prose for this node. Return only the committed paragraph(s), not JSON.'

export function writeLengthInstruction(length?: number): string {
  if (length === undefined) return EXECUTE_WRITE_INSTRUCTION
  return `${EXECUTE_WRITE_INSTRUCTION} Target about ${length} words.`
}

/** Instruction for a parent write whose children are all done. */
export const COMPOSE_WRITE_INSTRUCTION = 'Compose the parent write from the finished child results in GetInfo. Return only the composed prose, not JSON.'

/** User-visible text when a task card cannot start a lab worker. */
export const LAB_UNAVAILABLE_TEXT = 'Lab runtime is unavailable. Search cards stay on the tree until a subagent provider is mounted.'

/** Lab worker persona — not the editor. Same string as dsh-article-tree LAB_PERSONA. */
export const LAB_PERSONA = 'Execute the single assigned task. Do not adopt an editorial persona. Return evidence only.'

/** Retrieval-class lab: search then summarize. Not a bare one-line goal. */
export const RETRIEVAL_PERSONA =
  'You are a retrieval worker. Search and fetch sources. Return a concise evidence summary only. Do not write the reader-facing article.'

export const RETRIEVAL_PROMPT_PREFIX =
  'Retrieve and summarize evidence for this information need. Use web search and fetch. Return only the findings.\n\n'

const RETRIEVAL_GOAL = /search|retrieve|查|搜|检索|资料|证据|公开榜|论文|source|fetch|调研|cite|引用/i
const PUBLISH_GOAL = /draft\/add|upload-draft|desk\.ps1|排版|推箱|cover\.png|wechat/i

export function isRetrievalGoal(goal: string): boolean {
  return RETRIEVAL_GOAL.test(goal) && !PUBLISH_GOAL.test(goal)
}

/** Retry hint after a rejected JSON decision. */
export const DECIDE_RETRY_INSTRUCTION = 'Previous reply was not a valid decision JSON object. Reply with a JSON object only.'
