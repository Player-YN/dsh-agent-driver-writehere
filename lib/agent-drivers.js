// packages/agent-drivers/src/index.ts
import { Service } from "@deepseek-ai/cordis";
import { scopeOf } from "@deepseek-ai/dsh-scope";
var AgentDrivers = class extends Service {
  drivers = /* @__PURE__ */ new Map();
  bindings = /* @__PURE__ */ new Map();
  constructor(ctx) {
    super(ctx, "agentDrivers");
  }
  /**
   * Register a named constructor. Duplicate live ids throw; disposing the
   * returned effect (or unloading the registering plugin) frees the id.
   * @param id - non-empty driver id.
   * @param ctor - constructor matching the AgentLoop.prepare call.
   * @returns the exact Cordis effect disposer.
   */
  register(id, ctor) {
    this.assertHostPlane("agentDrivers.register()");
    assertNonEmpty(id, "agent driver id");
    const dispose = this.ctx.effect(() => {
      if (this.drivers.has(id)) {
        throw new Error(`agent driver "${id}" is already registered`);
      }
      this.drivers.set(id, ctor);
      return () => {
        this.drivers.delete(id);
      };
    }, "agentDrivers.register()");
    return dispose;
  }
  /**
   * Bind a session `header.agentPreset` value to a registered driver id.
   * The driver need not be registered yet; {@link resolve} returns undefined
   * until both the bind and the constructor are live. Duplicate live preset
   * ids throw; disposing the effect frees the preset.
   * @param presetId - non-empty preset id written on the session header.
   * @param driverId - non-empty driver id passed to {@link register}.
   * @returns the exact Cordis effect disposer.
   */
  bindPreset(presetId, driverId) {
    this.assertHostPlane("agentDrivers.bindPreset()");
    assertNonEmpty(presetId, "agent preset id");
    assertNonEmpty(driverId, "agent driver id");
    const dispose = this.ctx.effect(() => {
      if (this.bindings.has(presetId)) {
        throw new Error(`agent preset "${presetId}" is already bound to a driver`);
      }
      this.bindings.set(presetId, driverId);
      return () => {
        this.bindings.delete(presetId);
      };
    }, "agentDrivers.bindPreset()");
    return dispose;
  }
  /**
   * Look up the constructor for this session: `header.agentPreset` → bind → ctor.
   * Missing header, unbound preset, or unbound driver yields `undefined` so
   * AgentLoop can fall back to ReactLoopAgent.
   * @param session - session whose header may name an agent preset.
   * @returns the live constructor, or `undefined` when nothing is bound.
   */
  resolve(session) {
    const presetId = session.header.agentPreset;
    if (presetId === void 0) return void 0;
    const driverId = this.bindings.get(presetId);
    if (driverId === void 0) return void 0;
    return this.drivers.get(driverId);
  }
  /** Refuse agent/preset-scoped registration: construct happens before preset mount. */
  assertHostPlane(method) {
    if (scopeOf(this.ctx) !== void 0) {
      throw new Error(`${method} requires a host context (not an agent or preset scope)`);
    }
  }
};
function assertNonEmpty(value, label) {
  if (value.length === 0) throw new Error(`${label} must be a non-empty string`);
}
var index_default = AgentDrivers;
export {
  AgentDrivers,
  index_default as default
};
