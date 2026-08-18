window.__ModuleLoader__.load({
	id: "dsh-agent-driver-writehere",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region src/client/layout.ts
		const NODE_W$1 = 176;
		const XGAP = 214;
		const GRAPH_NODE_W = 168;
		function leafCount(tree, id) {
			const node = tree.nodes[id];
			if (!node || node.children.length === 0) return 1;
			return node.children.reduce((sum, cid) => sum + leafCount(tree, cid), 0);
		}
		/** Parent-child only. `dependsOn` must not change X, or ready siblings look serial. */
		function layoutHorizontalTree(tree) {
			const positions = {};
			const height = Math.max(220, leafCount(tree, "root") * 88 + 24);
			const place = (id, depth, y0, y1) => {
				const node = tree.nodes[id];
				if (!node) return;
				positions[id] = {
					x: 104 + depth * XGAP,
					y: (y0 + y1) / 2
				};
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
			for (const point of Object.values(positions)) if (point.x > maxX) maxX = point.x;
			return {
				positions,
				width: maxX + NODE_W$1 / 2 + 20,
				height
			};
		}
		function nodeDependsOn(node) {
			return node.dependsOn ?? [];
		}
		function formatWaitsOn(ids) {
			if (ids.length === 0) return void 0;
			return `waits on: ${ids.join(", ")}`;
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
		function childLinkPath(from, to, nodeW = GRAPH_NODE_W) {
			const x1 = from.x + nodeW / 2;
			const y1 = from.y;
			const x2 = to.x - nodeW / 2;
			const y2 = to.y;
			const mid = (x1 + x2) / 2;
			return `M ${x1} ${y1} C ${mid} ${y1} ${mid} ${y2} ${x2} ${y2}`;
		}
		function dependsLinkPath(from, to, nodeW = GRAPH_NODE_W) {
			if (Math.abs(to.x - from.x) < 8) {
				const x1 = from.x + nodeW / 2;
				const x2 = to.x + nodeW / 2;
				const bow = from.x + nodeW / 2 + 22;
				return `M ${x1} ${from.y} C ${bow} ${from.y} ${bow} ${to.y} ${x2} ${to.y}`;
			}
			if (to.x >= from.x) return childLinkPath(from, to, nodeW);
			const x1 = from.x - nodeW / 2;
			const x2 = to.x + nodeW / 2;
			const mid = (x1 + x2) / 2;
			return `M ${x1} ${from.y} C ${mid} ${from.y} ${mid} ${to.y} ${x2} ${to.y}`;
		}
		//#endregion
		//#region \0dsh-css:C:\Users\yyy\Documents\GitHub\deepseek-harness\packages\client\ui-article-tree\src\client\ArticleTreeGraph.module.css.mjs
		const css$2 = "._9-SVUG_svg{width:100%;height:220px;display:block}._9-SVUG_edge{fill:none;stroke:#64748b;stroke-width:1.8px}._9-SVUG_depEdge{fill:none;stroke:#f59e0b;stroke-width:1.6px;stroke-dasharray:5 3}._9-SVUG_box{stroke-width:1.5px}._9-SVUG_write ._9-SVUG_box{fill:#0f2744;stroke:#3b82f6}._9-SVUG_think ._9-SVUG_box{fill:#221a3a;stroke:#a78bfa}._9-SVUG_search ._9-SVUG_box{fill:#0f2a22;stroke:#34d399}._9-SVUG_blocked ._9-SVUG_box{stroke-dasharray:4 3;opacity:.65}._9-SVUG_kind{fill:#93c5fd;font-size:9px;font-weight:700}._9-SVUG_search ._9-SVUG_kind{fill:#6ee7b7}._9-SVUG_think ._9-SVUG_kind{fill:#ddd6fe}._9-SVUG_status{fill:#94a3b8;font-size:9px}._9-SVUG_goal{fill:#e5e7eb;font-size:11px}._9-SVUG_waits{fill:#fbbf24;font-size:9px}";
		const tagId$2 = "dsh-agent-driver-writehere/ArticleTreeGraph.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-agent-driver-writehere";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var ArticleTreeGraph_module_css_default = {
			"blocked": "_9-SVUG_blocked",
			"depEdge": "_9-SVUG_depEdge",
			"kind": "_9-SVUG_kind",
			"write": "_9-SVUG_write",
			"status": "_9-SVUG_status",
			"svg": "_9-SVUG_svg",
			"think": "_9-SVUG_think",
			"edge": "_9-SVUG_edge",
			"search": "_9-SVUG_search",
			"waits": "_9-SVUG_waits",
			"goal": "_9-SVUG_goal",
			"box": "_9-SVUG_box"
		};
		//#endregion
		//#region src/client/ArticleTreeGraph.tsx
		const NODE_W = 168;
		const NODE_H = 68;
		function ArticleTreeGraph({ tree }) {
			const layout = layoutHorizontalTree(tree);
			const edges = viewEdges(tree);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
				className: ArticleTreeGraph_module_css_default.svg,
				viewBox: `0 0 ${layout.width + 24} ${layout.height}`,
				role: "img",
				"aria-label": tree.topic,
				children: [edges.map((edge) => {
					const from = layout.positions[edge.from];
					const to = layout.positions[edge.to];
					if (!from || !to) return null;
					return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
						"data-edge": edge.kind,
						"data-from": edge.from,
						"data-to": edge.to,
						className: edge.kind === "child" ? ArticleTreeGraph_module_css_default.edge : ArticleTreeGraph_module_css_default.depEdge,
						d: edge.kind === "child" ? childLinkPath(from, to) : dependsLinkPath(from, to)
					}, `${edge.kind}-${edge.from}-${edge.to}`);
				}), Object.values(tree.nodes).map((node) => {
					const pos = layout.positions[node.id];
					if (!pos) return null;
					const deps = nodeDependsOn(node);
					const waits = formatWaitsOn(deps);
					return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("g", {
						className: `${ArticleTreeGraph_module_css_default.node} ${ArticleTreeGraph_module_css_default[node.type]} ${ArticleTreeGraph_module_css_default[node.status]}`,
						"data-node-id": node.id,
						"data-x": pos.x,
						"data-y": pos.y,
						"data-waits-on": deps.join(","),
						transform: `translate(${pos.x},${pos.y})`,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
								className: ArticleTreeGraph_module_css_default.box,
								x: -168 / 2,
								y: -68 / 2,
								width: NODE_W,
								height: NODE_H,
								rx: 8
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
								className: ArticleTreeGraph_module_css_default.kind,
								x: -76,
								y: -14,
								children: clipViewText(`${node.type.toUpperCase()} · ${node.id}`, 18)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
								className: ArticleTreeGraph_module_css_default.status,
								x: NODE_W / 2 - 8,
								y: -14,
								textAnchor: "end",
								children: node.status
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
								className: ArticleTreeGraph_module_css_default.goal,
								x: -76,
								y: 6,
								children: clipViewText(node.goal, 16)
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("text", {
								className: ArticleTreeGraph_module_css_default.waits,
								x: -76,
								y: 22,
								children: clipViewText(waits ?? "", 22)
							})
						]
					}, node.id);
				})]
			});
		}
		//#endregion
		//#region src/client/store.ts
		/** Sidebar tree pane open state — process-local, not persisted. */
		const listeners = /* @__PURE__ */ new Set();
		let open = true;
		function isArticleTreeOpen() {
			return open;
		}
		function setArticleTreeOpen(next) {
			if (open === next) return;
			open = next;
			for (const listener of listeners) listener();
		}
		function toggleArticleTreeOpen() {
			setArticleTreeOpen(!open);
		}
		function subscribeArticleTreeOpen(listener) {
			listeners.add(listener);
			return () => {
				listeners.delete(listener);
			};
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
		const css$1 = ".g1JM5G_panel{border-top:1px solid var(--border-subtle,#2a3140);min-height:180px;max-height:42%;padding:8px 10px 10px;overflow:auto}.g1JM5G_title{color:var(--text-secondary,#8b93a2);margin:0 0 6px;font-size:12px;font-weight:600}.g1JM5G_empty{color:var(--text-secondary,#8b93a2);margin:0;font-size:12px}";
		const tagId$1 = "dsh-agent-driver-writehere/ArticleTreePanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-agent-driver-writehere";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var ArticleTreePanel_module_css_default = {
			"title": "g1JM5G_title",
			"panel": "g1JM5G_panel",
			"empty": "g1JM5G_empty"
		};
		//#endregion
		//#region src/client/ArticleTreePanel.tsx
		function ArticleTreePanel({ ctx, wide, t }) {
			const open = (0, react.useSyncExternalStore)(subscribeArticleTreeOpen, isArticleTreeOpen, isArticleTreeOpen);
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
			if (!isEditorSession(ctx) || !open || !wide) return null;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("section", {
				className: ArticleTreePanel_module_css_default.panel,
				"aria-label": t("title"),
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("h3", {
					className: ArticleTreePanel_module_css_default.title,
					children: t("title")
				}), tree && tree.nodes ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(ArticleTreeGraph, { tree }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
					className: ArticleTreePanel_module_css_default.empty,
					children: t("empty")
				})]
			});
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
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
				type: "button",
				className: TreeToggle_module_css_default.btn,
				"aria-pressed": open,
				"aria-label": t("toggle.open"),
				onClick: () => {
					toggleArticleTreeOpen();
				},
				children: wide ? t("toggle.label") : "树"
			});
		}
		//#endregion
		//#region src/client/locales.ts
		const zh = {
			"toggle.label": "拆卡树",
			"toggle.open": "打开拆卡树",
			empty: "对本会话说主题后，树会在这里向右长出来。",
			title: "拆卡树"
		};
		const en = {
			"toggle.label": "Card tree",
			"toggle.open": "Open card tree",
			empty: "Send a topic in this session and the tree grows to the right here.",
			title: "Card tree"
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
			ctx.slots.inject("sidebar.articleTree", () => ctx.slots.register({
				name: "sidebar.articleTree",
				locale: NS,
				inject: () => ({ ctx })
			}, ArticleTreePanel));
		}
		//#endregion
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map