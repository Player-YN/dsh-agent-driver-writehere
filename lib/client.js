window.__ModuleLoader__.load({
	id: "dsh-agent-driver-writehere",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_dom = require("react-dom");
		let react_jsx_runtime = require("react/jsx-runtime");
		const CANVAS_YGAP = 156;
		function leafCount(tree, id) {
			const node = tree.nodes[id];
			if (!node || node.children.length === 0) return 1;
			return node.children.reduce((sum, cid) => sum + leafCount(tree, cid), 0);
		}
		/**
		* Top-down outline: depth grows Y, siblings fan in X.
		* Parent-child only — `dependsOn` never moves a node.
		*/
		function layoutVerticalTree(tree) {
			const positions = {};
			const width = Math.max(560, leafCount(tree, "root") * 232 + 48);
			const place = (id, depth, x0, x1) => {
				const node = tree.nodes[id];
				if (!node) return;
				positions[id] = {
					x: (x0 + x1) / 2,
					y: 56 + depth * CANVAS_YGAP
				};
				if (node.children.length === 0) return;
				const total = node.children.reduce((sum, cid) => sum + leafCount(tree, cid), 0);
				let cursor = x0;
				for (const cid of node.children) {
					const span = (x1 - x0) * leafCount(tree, cid) / total;
					place(cid, depth + 1, cursor, cursor + span);
					cursor += span;
				}
			};
			place("root", 0, 24, width - 24);
			let maxY = 0;
			for (const point of Object.values(positions)) if (point.y > maxY) maxY = point.y;
			return {
				positions,
				width,
				height: maxY + 88 / 2 + 48
			};
		}
		function nodeDependsOn(node) {
			return node.dependsOn ?? [];
		}
		function clipViewText(text, n) {
			return text.length <= n ? text : `${text.slice(0, n - 1)}…`;
		}
		function viewEdges(tree) {
			const edges = [];
			const childKeys = /* @__PURE__ */ new Set();
			for (const node of Object.values(tree.nodes)) for (const cid of node.children) {
				if (!tree.nodes[cid]) continue;
				childKeys.add(`${node.id}\0${cid}`);
				edges.push({
					from: node.id,
					to: cid,
					kind: "child"
				});
			}
			for (const node of Object.values(tree.nodes)) for (const dep of nodeDependsOn(node)) {
				if (!tree.nodes[dep]) continue;
				if (childKeys.has(`${dep}\0${node.id}`)) continue;
				edges.push({
					from: dep,
					to: node.id,
					kind: "depends"
				});
			}
			return edges;
		}
		/** Parent bottom-center to child top-center. Stretches when either card moves. */
		function childLinkPathDown(from, to, nodeH = 88) {
			const x1 = from.x;
			const y1 = from.y + nodeH / 2;
			const x2 = to.x;
			const y2 = to.y - nodeH / 2;
			const mid = (y1 + y2) / 2;
			return `M ${x1} ${y1} C ${x1} ${mid} ${x2} ${mid} ${x2} ${y2}`;
		}
		//#endregion
		//#region src/client/store.ts
		/** Card-tree window and canvas — process-local, not persisted. */
		const listeners = /* @__PURE__ */ new Set();
		let open = false;
		let epoch = 0;
		let sessionKey = "";
		let windowOffset = null;
		let pan = {
			x: 48,
			y: 36
		};
		let zoom = 1;
		let nodePos = {};
		function notify() {
			epoch += 1;
			for (const listener of listeners) listener();
		}
		function getCanvasEpoch() {
			return epoch;
		}
		function subscribeArticleTreeOpen(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
		}
		function isArticleTreeOpen() {
			return open;
		}
		function setArticleTreeOpen(next) {
			if (open === next) return;
			open = next;
			notify();
		}
		function toggleArticleTreeOpen() {
			setArticleTreeOpen(!open);
		}
		function getWindowOffset() {
			return windowOffset;
		}
		function setWindowOffset(next) {
			windowOffset = {
				x: next.x,
				y: next.y
			};
			notify();
		}
		function getPan() {
			return pan;
		}
		function getZoom() {
			return zoom;
		}
		function getNodePositions() {
			return nodePos;
		}
		function bindCanvasSession(id) {
			if (sessionKey === id) return;
			sessionKey = id;
			nodePos = {};
			pan = {
				x: 48,
				y: 36
			};
			zoom = 1;
			notify();
		}
		function mergeCanvasLayout(tree) {
			const laid = layoutVerticalTree(tree);
			let changed = false;
			for (const [id, point] of Object.entries(laid.positions)) if (nodePos[id] === void 0) {
				nodePos[id] = {
					x: point.x,
					y: point.y
				};
				changed = true;
			}
			for (const id of Object.keys(nodePos)) if (tree.nodes[id] === void 0) {
				delete nodePos[id];
				changed = true;
			}
			if (changed) notify();
		}
		function moveCanvasNode(id, x, y) {
			const current = nodePos[id];
			if (current === void 0) return;
			if (current.x === x && current.y === y) return;
			nodePos[id] = {
				x,
				y
			};
			notify();
		}
		function panCanvas(dx, dy) {
			if (dx === 0 && dy === 0) return;
			pan = {
				x: pan.x + dx,
				y: pan.y + dy
			};
			notify();
		}
		function zoomCanvasAt(nextZoom, screenX, screenY) {
			const clamped = Math.min(2.6, Math.max(.35, nextZoom));
			if (clamped === zoom) return;
			const worldX = (screenX - pan.x) / zoom;
			const worldY = (screenY - pan.y) / zoom;
			zoom = clamped;
			pan = {
				x: screenX - worldX * zoom,
				y: screenY - worldY * zoom
			};
			notify();
		}
		function resetCanvasLayout(tree) {
			const laid = layoutVerticalTree(tree);
			const next = {};
			for (const [id, point] of Object.entries(laid.positions)) next[id] = {
				x: point.x,
				y: point.y
			};
			nodePos = next;
			pan = {
				x: 48,
				y: 36
			};
			zoom = 1;
			notify();
		}
		//#endregion
		//#region \0dsh-css:C:\Users\yyy\Documents\GitHub\deepseek-harness\packages\client\ui-article-tree\src\client\ArticleTreeGraph.module.css.mjs
		const css$2 = "._9-SVUG_viewport{cursor:grab;touch-action:none;user-select:none;background:radial-gradient(circle at 1px 1px,#94a3b829 1px,#0000 0) 0 0/28px 28px;width:100%;height:100%;position:relative;overflow:hidden}._9-SVUG_viewport:active{cursor:grabbing}._9-SVUG_world{transform-origin:0 0;will-change:transform;position:absolute;top:0;left:0}._9-SVUG_edges{pointer-events:none;position:absolute;overflow:visible}._9-SVUG_edge{fill:none;stroke:#64748b;stroke-width:2px}._9-SVUG_node{box-sizing:border-box;color:#e5e7eb;cursor:grab;background:#0f2744;border:1.5px solid #3b82f6;border-radius:10px;flex-direction:column;gap:4px;padding:8px 10px;display:flex;position:absolute;box-shadow:0 8px 24px #00000047}._9-SVUG_node:active{cursor:grabbing}._9-SVUG_think{background:#221a3a;border-color:#a78bfa}._9-SVUG_search,._9-SVUG_task{background:#0f2a22;border-color:#34d399}._9-SVUG_blocked{opacity:.62;border-style:dashed}._9-SVUG_done{opacity:.78}._9-SVUG_running{box-shadow:0 0 0 2px #34d399,0 10px 28px #34d39947}._9-SVUG_needs-update{border-style:dashed;border-color:#f59e0b}._9-SVUG_needs-update ._9-SVUG_status{color:#fbbf24}._9-SVUG_meta{justify-content:space-between;align-items:baseline;gap:8px;display:flex}._9-SVUG_kind{letter-spacing:.02em;color:#93c5fd;font-size:10px;font-weight:700}._9-SVUG_think ._9-SVUG_kind{color:#ddd6fe}._9-SVUG_search ._9-SVUG_kind,._9-SVUG_task ._9-SVUG_kind{color:#6ee7b7}._9-SVUG_status{color:#94a3b8;font-size:10px}._9-SVUG_goal{-webkit-line-clamp:2;-webkit-box-orient:vertical;margin:0;font-size:12px;line-height:16px;display:-webkit-box;overflow:hidden}._9-SVUG_wait{color:#fbbf24;margin:0;font-size:10px;line-height:14px}";
		const tagId$2 = "dsh-agent-driver-writehere/ArticleTreeGraph.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-agent-driver-writehere";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var ArticleTreeGraph_module_css_default = {
			"think": "_9-SVUG_think",
			"status": "_9-SVUG_status",
			"viewport": "_9-SVUG_viewport",
			"running": "_9-SVUG_running",
			"meta": "_9-SVUG_meta",
			"node": "_9-SVUG_node",
			"edge": "_9-SVUG_edge",
			"search": "_9-SVUG_search",
			"task": "_9-SVUG_task",
			"world": "_9-SVUG_world",
			"kind": "_9-SVUG_kind",
			"done": "_9-SVUG_done",
			"goal": "_9-SVUG_goal",
			"needs-update": "_9-SVUG_needs-update",
			"blocked": "_9-SVUG_blocked",
			"edges": "_9-SVUG_edges",
			"wait": "_9-SVUG_wait"
		};
		//#endregion
		//#region src/client/ArticleTreeGraph.tsx
		const WORLD = 8e3;
		const WORLD_ORIGIN = -2e3;
		function ArticleTreeGraph({ tree, sessionId, t }) {
			(0, react.useSyncExternalStore)(subscribeArticleTreeOpen, getCanvasEpoch, getCanvasEpoch);
			const viewportRef = (0, react.useRef)(null);
			const drag = (0, react.useRef)(void 0);
			(0, react.useEffect)(() => {
				bindCanvasSession(sessionId);
				mergeCanvasLayout(tree);
			}, [sessionId, tree]);
			(0, react.useEffect)(() => {
				const el = viewportRef.current;
				if (el === null) return;
				const onWheel = (event) => {
					event.preventDefault();
					const rect = el.getBoundingClientRect();
					const factor = event.deltaY < 0 ? 1.08 : 1 / 1.08;
					zoomCanvasAt(getZoom() * factor, event.clientX - rect.left, event.clientY - rect.top);
				};
				el.addEventListener("wheel", onWheel, { passive: false });
				return () => {
					el.removeEventListener("wheel", onWheel);
				};
			}, []);
			const pan = getPan();
			const zoom = getZoom();
			const positions = getNodePositions();
			const childEdges = viewEdges(tree).filter((edge) => edge.kind === "child");
			const onPointerMove = (event) => {
				const current = drag.current;
				if (current === void 0) return;
				const dx = event.clientX - current.lastX;
				const dy = event.clientY - current.lastY;
				current.lastX = event.clientX;
				current.lastY = event.clientY;
				if (current.kind === "pan") {
					panCanvas(dx, dy);
					return;
				}
				const pos = getNodePositions()[current.id];
				if (pos === void 0) return;
				moveCanvasNode(current.id, pos.x + dx / getZoom(), pos.y + dy / getZoom());
			};
			const onPointerUp = () => {
				drag.current = void 0;
				window.removeEventListener("pointermove", onPointerMove);
				window.removeEventListener("pointerup", onPointerUp);
			};
			const startDrag = (kind, event, id) => {
				event.preventDefault();
				event.stopPropagation();
				if (kind === "node" && id !== void 0) drag.current = {
					kind: "node",
					id,
					lastX: event.clientX,
					lastY: event.clientY
				};
				else drag.current = {
					kind: "pan",
					lastX: event.clientX,
					lastY: event.clientY
				};
				window.addEventListener("pointermove", onPointerMove);
				window.addEventListener("pointerup", onPointerUp);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				ref: viewportRef,
				className: ArticleTreeGraph_module_css_default.viewport,
				"data-canvas": "article-tree",
				onPointerDown: (event) => {
					if (event.button !== 0) return;
					if (event.target.closest("[data-node-id]")) return;
					startDrag("pan", event);
				},
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ArticleTreeGraph_module_css_default.world,
					"data-world": "true",
					style: { transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` },
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
						className: ArticleTreeGraph_module_css_default.edges,
						width: WORLD,
						height: WORLD,
						viewBox: `${WORLD_ORIGIN} ${WORLD_ORIGIN} ${WORLD} ${WORLD}`,
						role: "img",
						"aria-label": tree.topic,
						style: {
							left: WORLD_ORIGIN,
							top: WORLD_ORIGIN
						},
						children: childEdges.map((edge) => {
							const from = positions[edge.from];
							const to = positions[edge.to];
							if (!from || !to) return null;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
								"data-edge": "child",
								"data-from": edge.from,
								"data-to": edge.to,
								className: ArticleTreeGraph_module_css_default.edge,
								d: childLinkPathDown(from, to)
							}, `${edge.from}-${edge.to}`);
						})
					}), Object.values(tree.nodes).map((node) => {
						const pos = positions[node.id];
						if (!pos) return null;
						const deps = nodeDependsOn(node);
						const statusClass = ArticleTreeGraph_module_css_default[node.status];
						const typeClass = ArticleTreeGraph_module_css_default[node.type];
						return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
							className: `${ArticleTreeGraph_module_css_default.node} ${typeClass ?? ""} ${statusClass ?? ""}`,
							"data-node-id": node.id,
							"data-x": pos.x,
							"data-y": pos.y,
							"data-waits-on": deps.join(","),
							style: {
								width: 200,
								height: 88,
								left: pos.x - 200 / 2,
								top: pos.y - 88 / 2
							},
							onPointerDown: (event) => {
								if (event.button !== 0) return;
								startDrag("node", event, node.id);
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ArticleTreeGraph_module_css_default.meta,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ArticleTreeGraph_module_css_default.kind,
										children: clipViewText(`${node.type.toUpperCase()} · ${node.id}`, 22)
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: ArticleTreeGraph_module_css_default.status,
										children: node.status
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ArticleTreeGraph_module_css_default.goal,
									children: node.goal
								}),
								deps.length > 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
									className: ArticleTreeGraph_module_css_default.wait,
									children: `${t("wait")} ${deps.join(", ")}`
								})
							]
						}, node.id);
					})]
				})
			});
		}
		//#endregion
		//#region src/client/editor-session.ts
		/** Must match apps/cli/config/agent-presets/article-editor. */
		const EDITOR_PRESET_ID = "article-editor";
		function currentSessionPreset(ctx) {
			const list = ctx.sessions.list.getSnapshot();
			const id = list.current;
			if (!id) return void 0;
			return list.byId[id]?.agentPreset;
		}
		function isEditorSession(ctx) {
			return currentSessionPreset(ctx) === EDITOR_PRESET_ID;
		}
		//#endregion
		//#region \0dsh-css:C:\Users\yyy\Documents\GitHub\deepseek-harness\packages\client\ui-article-tree\src\client\ArticleTreePanel.module.css.mjs
		const css$1 = ".g1JM5G_root{z-index:1000;justify-content:center;align-items:center;padding:24px;display:flex;position:fixed;inset:0}.g1JM5G_mask{background:#00000073;position:absolute;inset:0}.g1JM5G_window{z-index:1;border:1px solid var(--dsw-alias-border-inverted,#3a4254);background:var(--dsw-alias-bg-layer-2,#121722);border-radius:16px;flex-direction:column;width:min(92vw,1280px);height:min(88vh,900px);display:flex;position:relative;overflow:hidden;box-shadow:0 24px 64px #00000073}.g1JM5G_window[data-window-x]{margin:0;position:fixed}.g1JM5G_header{border-bottom:1px solid var(--border-subtle,#2a3140);cursor:grab;flex:none;justify-content:space-between;align-items:center;gap:8px;padding:16px 16px 12px 20px;display:flex}.g1JM5G_header:active{cursor:grabbing}.g1JM5G_actions{align-items:center;gap:8px;display:flex}.g1JM5G_title{color:var(--dsw-alias-label-primary,#e5e7eb);margin:0;font-size:16px;font-weight:600;line-height:24px}.g1JM5G_close{border:1px solid var(--border-subtle,#3a4254);min-width:72px;height:32px;color:inherit;font:inherit;cursor:pointer;background:0 0;border-radius:8px;flex:none;justify-content:center;align-items:center;padding:0 10px;font-size:13px;display:inline-flex}.g1JM5G_close:hover{background:#ffffff0f}.g1JM5G_canvas{flex:1;min-height:0;overflow:hidden}.g1JM5G_empty{color:var(--text-secondary,#8b93a2);margin:0;font-size:13px;line-height:20px}";
		const tagId$1 = "dsh-agent-driver-writehere/ArticleTreePanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-agent-driver-writehere";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var ArticleTreePanel_module_css_default = {
			"header": "g1JM5G_header",
			"close": "g1JM5G_close",
			"actions": "g1JM5G_actions",
			"canvas": "g1JM5G_canvas",
			"root": "g1JM5G_root",
			"mask": "g1JM5G_mask",
			"window": "g1JM5G_window",
			"empty": "g1JM5G_empty",
			"title": "g1JM5G_title"
		};
		//#endregion
		//#region src/client/ArticleTreePanel.tsx
		const TITLE_ID = "article-tree-dialog-title";
		function ArticleTreePanel({ ctx, t }) {
			(0, react.useSyncExternalStore)(subscribeArticleTreeOpen, getCanvasEpoch, getCanvasEpoch);
			const open = isArticleTreeOpen();
			const offset = getWindowOffset();
			const windowRef = (0, react.useRef)(null);
			const drag = (0, react.useRef)(void 0);
			const tree = (0, react.useSyncExternalStore)((onStoreChange) => {
				let unsubProj = () => {};
				const rebind = () => {
					unsubProj();
					const id = ctx.sessions.list.getSnapshot().current;
					const session = id ? ctx.sessions.binding(id)?.session : void 0;
					unsubProj = session ? session.projections.faceOf("articleTree").subscribe(onStoreChange) : () => {};
				};
				const unsubList = ctx.sessions.list.subscribe(() => {
					rebind();
					onStoreChange();
				});
				rebind();
				return () => {
					unsubList();
					unsubProj();
				};
			}, () => {
				const id = ctx.sessions.list.getSnapshot().current;
				return (id ? ctx.sessions.binding?.(id)?.session : void 0)?.projections.faceOf("articleTree").getSnapshot();
			}, () => null);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onKeyDown = (event) => {
					if (event.key === "Escape") setArticleTreeOpen(false);
				};
				document.addEventListener("keydown", onKeyDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
				};
			}, [open]);
			const onHeaderPointerDown = (event) => {
				if (event.button !== 0) return;
				if (event.target.closest("button")) return;
				event.preventDefault();
				const box = windowRef.current?.getBoundingClientRect();
				if (box !== void 0 && getWindowOffset() === null) setWindowOffset({
					x: box.left,
					y: box.top
				});
				drag.current = {
					lastX: event.clientX,
					lastY: event.clientY
				};
				const move = (next) => {
					const current = drag.current;
					if (current === void 0) return;
					const origin = getWindowOffset();
					if (origin === null) return;
					setWindowOffset({
						x: origin.x + next.clientX - current.lastX,
						y: origin.y + next.clientY - current.lastY
					});
					current.lastX = next.clientX;
					current.lastY = next.clientY;
				};
				const up = () => {
					drag.current = void 0;
					window.removeEventListener("pointermove", move);
					window.removeEventListener("pointerup", up);
				};
				window.addEventListener("pointermove", move);
				window.addEventListener("pointerup", up);
			};
			if (!isEditorSession(ctx) || !open || typeof document === "undefined") return null;
			const close = () => {
				setArticleTreeOpen(false);
			};
			const sessionId = ctx.sessions.list.getSnapshot().current ?? "";
			return (0, react_dom.createPortal)(/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ArticleTreePanel_module_css_default.root,
				role: "presentation",
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
					className: ArticleTreePanel_module_css_default.mask,
					"aria-hidden": "true",
					onClick: close
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					ref: windowRef,
					className: ArticleTreePanel_module_css_default.window,
					role: "dialog",
					"aria-modal": "true",
					"aria-labelledby": TITLE_ID,
					"data-window-x": offset?.x,
					"data-window-y": offset?.y,
					style: offset === null ? void 0 : {
						left: offset.x,
						top: offset.y
					},
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("header", {
						className: ArticleTreePanel_module_css_default.header,
						onPointerDown: onHeaderPointerDown,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h2", {
							id: TITLE_ID,
							className: ArticleTreePanel_module_css_default.title,
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ArticleTreePanel_module_css_default.actions,
							children: [tree && tree.nodes && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ArticleTreePanel_module_css_default.close,
								"aria-label": t("reset"),
								onClick: () => {
									resetCanvasLayout(tree);
								},
								children: t("reset")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: ArticleTreePanel_module_css_default.close,
								"aria-label": t("toggle.close"),
								onClick: close,
								children: t("toggle.close")
							})]
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ArticleTreePanel_module_css_default.canvas,
						children: tree && tree.nodes ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ArticleTreeGraph, {
							tree,
							sessionId,
							t
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
							className: ArticleTreePanel_module_css_default.empty,
							children: t("empty")
						})
					})]
				})]
			}), document.body);
		}
		//#endregion
		//#region \0dsh-css:C:\Users\yyy\Documents\GitHub\deepseek-harness\packages\client\ui-article-tree\src\client\TreeToggle.module.css.mjs
		const css = "._tNJmG_btn{border:1px solid var(--border-subtle,#3a4254);width:100%;min-height:32px;color:inherit;font:inherit;cursor:pointer;background:0 0;border-radius:8px;justify-content:center;align-items:center;margin:0 0 6px;font-size:13px;display:flex}._tNJmG_btn[aria-pressed=true]{background:#15233a;border-color:#3b82f6}";
		const tagId = "dsh-agent-driver-writehere/TreeToggle.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-agent-driver-writehere";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var TreeToggle_module_css_default = { "btn": "_tNJmG_btn" };
		//#endregion
		//#region src/client/TreeToggle.tsx
		function TreeToggle({ wide, t, ctx }) {
			const editor = (0, react.useSyncExternalStore)((onChange) => ctx.sessions.list.subscribe(onChange), () => isEditorSession(ctx), () => false);
			const open = (0, react.useSyncExternalStore)(subscribeArticleTreeOpen, isArticleTreeOpen, isArticleTreeOpen);
			if (!editor) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: TreeToggle_module_css_default.btn,
				"aria-pressed": open,
				"aria-label": open ? t("toggle.close") : t("toggle.open"),
				onClick: () => {
					toggleArticleTreeOpen();
				},
				children: wide ? t("toggle.label") : "树"
			}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ArticleTreePanel, {
				ctx,
				t
			})] });
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			"toggle.label": "拆卡树",
			"toggle.open": "打开拆卡树",
			"toggle.close": "关闭拆卡树",
			empty: "对本会话说主题后，树会在这块画布里从上往下展开。拖窗口、拖节点、空白处拖动画布；滚轮缩放。依赖显示为「等」，不是树枝。",
			title: "拆卡树",
			wait: "等",
			reset: "复位布局"
		};
		const en = {
			"toggle.label": "Card tree",
			"toggle.open": "Open card tree",
			"toggle.close": "Close card tree",
			empty: "Send a topic and the tree unfolds downward on this canvas. Drag the window, drag cards, pan the empty canvas, and scroll to zoom. Dependencies are wait chips, not extra branches.",
			title: "Card tree",
			wait: "waiting on",
			reset: "Reset layout"
		};
		//#endregion
		//#region src/client/index.ts
		const NS = "articleTree";
		const inject = [
			"slots",
			"locale",
			"sessions"
		];
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-article-tree: dictionaries");
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "article-tree-toggle",
				order: 20,
				locale: NS,
				inject: () => ({ ctx })
			}, TreeToggle));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map