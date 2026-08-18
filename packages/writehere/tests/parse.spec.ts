import { describe, expect, it } from 'vitest'
import {
  DECIDE_JSON_SCHEMA,
  DECIDE_RESPONSE_FORMAT,
  UPDATE_JSON_SCHEMA,
  parseJsonObject,
  parseNodeDecision,
  parseNodeUpdate,
  structuredResponseFormat,
} from '../src/parse.ts'
import { isRetrievalGoal } from '../src/prompts.ts'

describe('parseNodeDecision', () => {
  it('names official JSON Output for decide ticks', () => {
    expect(DECIDE_RESPONSE_FORMAT).toEqual({ type: 'json_object' })
    expect(structuredResponseFormat('decide')).toEqual({ type: 'json_object' })
    expect(UPDATE_JSON_SCHEMA).toMatchObject({ required: ['goal'] })
    expect(DECIDE_JSON_SCHEMA).toMatchObject({ type: 'object' })
  })

  it('pins json_schema when DSH_JSON_SCHEMA=1', () => {
    const previous = process.env.DSH_JSON_SCHEMA
    process.env.DSH_JSON_SCHEMA = '1'
    expect(structuredResponseFormat('update')).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'writehere_update', strict: true },
    })
    expect(structuredResponseFormat('decide')).toMatchObject({
      type: 'json_schema',
      json_schema: { name: 'writehere_decide' },
    })
    if (previous === undefined) delete process.env.DSH_JSON_SCHEMA
    else process.env.DSH_JSON_SCHEMA = previous
  })

  it('accepts an atomic object', () => {
    expect(parseNodeDecision('{"atomic":true}')).toEqual({ kind: 'atomic' })
  })

  it('accepts a fenced plan', () => {
    const text = '```json\n{"atomic":false,"children":[{"type":"think","goal":"定尺子","atomic":true},{"type":"write","goal":"写开篇"}]}\n```'
    const decision = parseNodeDecision(text)
    expect(decision).toEqual({
      kind: 'plan',
      children: [
        { type: 'think', goal: '定尺子', atomic: true },
        { type: 'write', goal: '写开篇' },
      ],
    })
  })

  it('rejects atomic plus children, unknown keys, and empty children', () => {
    expect(() => parseNodeDecision('{"atomic":true,"children":[]}')).toThrow(/cannot include children/)
    expect(() => parseNodeDecision('{"atomic":false,"extra":1}')).toThrow(/unknown key/)
    expect(() => parseNodeDecision('{"children":[]}')).toThrow(/non-empty/)
    expect(() => parseNodeDecision('not json')).toThrow(/JSON object/)
    expect(() => parseNodeDecision('{"children":[{"type":"other","goal":"x"}]}')).toThrow(/type/)
    expect(() => parseNodeDecision('{"children":[{"type":"write","goal":""}]}')).toThrow(/goal/)
    expect(() => parseNodeDecision('{"atomic":"yes"}')).toThrow(/boolean/)
    expect(() => parseNodeDecision('{"children":[{"type":"write","goal":"写","atomic":"yes"}]}')).toThrow(/atomic/)
    expect(() => parseNodeDecision('{"children":[{"type":"write","goal":"写","id":""}]}')).toThrow(/id/)
    expect(() => parseNodeDecision('{"children":[{"type":"write","goal":"写","dependsOn":true}]}')).toThrow(/dependsOn/)
    expect(() => parseNodeDecision('{"children":["x"]}')).toThrow(/object/)
  })

  it('rejects a non-object JSON value', () => {
    expect(() => parseJsonObject('[1]')).toThrow(/JSON object/)
  })

  it('accepts optional id and dependsOn', () => {
    expect(parseNodeDecision('{"children":[{"id":"s","type":"task","goal":"查","dependsOn":["root"]},{"type":"write","goal":"写"}]}')).toEqual({
      kind: 'plan',
      children: [
        { id: 's', type: 'task', goal: '查', dependsOn: ['root'] },
        { type: 'write', goal: '写' },
      ],
    })
  })

  it('coerces integer and bare-string dependsOn to a string array', () => {
    expect(parseNodeDecision('{"children":[{"type":"write","goal":"写"},{"type":"task","goal":"推","dependsOn":[0]}]}')).toEqual({
      kind: 'plan',
      children: [
        { type: 'write', goal: '写' },
        { type: 'task', goal: '推', dependsOn: ['0'] },
      ],
    })
    expect(parseNodeDecision('{"children":[{"id":"w","type":"write","goal":"写"},{"type":"search","goal":"推","dependsOn":"w"}]}')).toEqual({
      kind: 'plan',
      children: [
        { id: 'w', type: 'write', goal: '写' },
        { type: 'task', goal: '推', dependsOn: ['w'] },
      ],
    })
  })

  it('accepts optional write length on a child', () => {
    expect(parseNodeDecision('{"children":[{"type":"write","goal":"写","length":200}]}')).toEqual({
      kind: 'plan',
      children: [{ type: 'write', goal: '写', length: 200 }],
    })
    expect(() => parseNodeDecision('{"children":[{"type":"write","goal":"写","length":0}]}')).toThrow(/length/)
  })
})

describe('parseNodeUpdate', () => {
  it('accepts a goal-only object and rejects decide keys', () => {
    expect(parseNodeUpdate('{"goal":"  只写现象  "}')).toEqual({ goal: '只写现象' })
    expect(() => parseNodeUpdate('{"atomic":true}')).toThrow(/unknown key/)
    expect(() => parseNodeUpdate('{"goal":"x","children":[]}')).toThrow(/unknown key/)
    expect(() => parseNodeUpdate('{"goal":"  "}')).toThrow(/goal/)
  })
})

describe('isRetrievalGoal', () => {
  it('classifies retrieval goals and excludes publish goals', () => {
    expect(isRetrievalGoal('查公开榜')).toBe(true)
    expect(isRetrievalGoal('检索 ReAct 论文')).toBe(true)
    expect(isRetrievalGoal('写开篇')).toBe(false)
    expect(isRetrievalGoal('upload-draft via desk.ps1')).toBe(false)
  })
})

