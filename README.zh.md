<p align="center">
  <img src="docs/banner.png" alt="dsh-agent-driver-writehere — 把 WriteHERE 做成 DeepSeek Harness 的 Agent Driver" width="100%">
</p>

<h1 align="center">dsh-agent-driver-writehere</h1>

<p align="center">
  <a href="README.md">English</a> · 中文
</p>

<p align="center">
  <img src="https://img.shields.io/github/stars/Player-YN/dsh-agent-driver-writehere?style=flat-square" alt="GitHub stars">
  <img src="https://img.shields.io/github/last-commit/Player-YN/dsh-agent-driver-writehere?style=flat-square" alt="Last commit">
  <img src="https://img.shields.io/badge/dsh-plugin-4D6BFE?style=flat-square" alt="dsh-plugin">
  <img src="https://img.shields.io/badge/agent%20driver-WriteHERE-f59e0b?style=flat-square" alt="WriteHERE driver">
  <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT">
  <img src="https://img.shields.io/badge/arXiv-2503.08275-b31b1b?style=flat-square" alt="arXiv 2503.08275">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/profile-web-111827?style=flat-square" alt="DSH web profile">
</p>

<p align="center">
  <strong>一个 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness</a> <em>Agent Driver</em>：把 <a href="https://arxiv.org/abs/2503.08275">WriteHERE</a> 的长文循环做成第二套推理循环，而不是往默认 ReAct 上再挂一批写作工具。</strong><br>
  <em>GetInfo → Update → 决定 → 按类型执行 · tools: [] · task 卡另开 <code>standard</code> 工人</em>
</p>

<p align="center">
  <a href="#是什么">是什么</a> ·
  <a href="#案例">案例</a> ·
  <a href="#安装">安装</a> ·
  <a href="#快速上手">快速上手</a> ·
  <a href="#一拍在做什么">一拍在做什么</a> ·
  <a href="#自定义">自定义</a> ·
  <a href="#扩展">扩展</a> ·
  <a href="#不适合做什么">不适合做什么</a> ·
  <a href="#环境要求">环境要求</a> ·
  <a href="#致谢与引用">致谢</a>
</p>

## 是什么

默认 ReAct 上跑长文，很容易摊平。模型要么先列大纲再整篇倒出，要么一路调工具，直到对话记录本身变成稿子。中途改目标、「这一段还缺事实」、以及检索 / 推理 / 成稿这三类工作，都没有一等公民的位置。

[WriteHERE](https://arxiv.org/abs/2503.08275) 把写作看成**异构递归规划**：先更新当前节点，再决定立刻执行，或拆成不同类型的子节点。本包装的是同一套循环，调度权在宿主 TypeScript，不在模型的 function calling。

| | 默认 ReAct 会话 | 本驱动 |
| --- | --- | --- |
| 构造器 | `ReactLoopAgent` | `WriteHereAgent` |
| 主编工具 | 原生 function calling | `tools: []` |
| 规划 / 检索 / 成稿 | 一份越积越长的对话 | 分类型卡片：`write` / `think` / `task` |
| 检索 | 同一会话继续调工具 | 可续跑的 `standard` 工人 |
| 草稿 | 模型在对话里打出来的字 | 叶子 `write` 追加 `article.md` |
| Web 界面 | 只有对话 | 可选侧栏 **拆卡树** |

<p align="center">
  <img src="docs/card-tree.png" alt="拆卡树侧栏示意图：从「什么是 ReAct？」根节点长出 write / think / task 卡" width="100%">
</p>

<p align="center"><sub>Web 界面示意图。卡片颜色与真实侧栏一致（write / think / task / needs-update）。不是某次私人会话的实拍。</sub></p>

所以它是 **Agent Driver**（`AgentLoop.prepare` 可以选的另一种构造器），不是默认循环上的 `article_*` 工具包。

## 案例

<p>
  <img src="docs/react-loop.jpg" alt="ReAct Loop" width="72" height="72" align="left" style="margin: 4px 16px 8px 0; border-radius: 8px;">
  <strong>ReAct Loop</strong> 是用本驱动写技术文的微信公众号。微信搜这个名字即可关注。
</p>
<br clear="all">

一期成稿题目是「什么是ReAct？」。主编会话是 `WriteHereAgent`，`tools: []`。检索和之后的排版是 `task` 卡，交给普通 `standard` 工人。叶子 `write` 追加进 `article.md`。**发到公众号不是本包的事**——宿主调度器只负责规划、更新和成稿。

循环之所以还能给别人用：调度拍的协议（GetInfo → Update → 决定 → 执行）里不写微信。栏目差异放在 preset 人设、方法论 skill，以及 `task` 卡上的调度单。

## 安装

需要本机已有能跑的 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)（`dsh` 在 PATH 上，以及 `pnpm`）。官方加载器就是 `dsh plugin add`：它在 `$DSH_HOME/profiles/<名字>` 里执行 `pnpm add`，因为本包声明了 `dsh.bundle`，所以会多叠一层配置。

### 一行（推荐）

```sh
dsh plugin --profile web add github:Player-YN/dsh-agent-driver-writehere
dsh --profile web
```

这一条会把本仓库装进 `web` profile、登记 bundle，并拉下 `zod`。插件第一次加载时，只有 `~/.dsh/.agent-presets/article-editor` **还不存在** 才会拷出厂 preset。然后：新会话 → 选 **article-editor**（技术博客博主）。

钉死某个 commit，避免 `main` 一推安装物就变：

```sh
dsh plugin --profile web add github:Player-YN/dsh-agent-driver-writehere#<sha>
```

### 先克隆再装

```sh
git clone https://github.com/Player-YN/dsh-agent-driver-writehere.git
cd dsh-agent-driver-writehere
dsh plugin --profile web add .
```

Windows 在检出目录里也可以（会立刻拷一份 preset）：

```powershell
.\install.ps1
```

### 确认、更新、卸载

```sh
dsh --profile web --dump-config   # 应出现 "# == dsh-agent-driver-writehere"
dsh plugin --profile web update github:Player-YN/dsh-agent-driver-writehere
dsh plugin --profile web remove dsh-agent-driver-writehere
```

尚未发布到 npm。若某个 profile 已经从其他层装过本驱动，不要再加一次 bundle。

`install-remote.sh` / `install-remote.ps1` 只包装官方的 `add`，再拷 preset。不是第二套加载器。只对你读过的脚本做管道执行。

## 快速上手

**请用 Web。**

1. 启动 profile：`dsh --profile web`（或 `dsh web`）。
2. 新会话，选 preset **article-editor**（技术博客博主）。
3. 发一个题目，不要发一条 shell 命令。
4. 打开侧栏 **拆卡树**。调度器拆卡、执行时，树会往右长。
5. 叶子 `write` 追加进 `article.md`。`task` 交给 `standard` 工人，等回报。

主编不会开终端。需要跑命令、读仓库、调外部 API，一律写成 `task` 卡。

若宿主会把 `--preset` 写进 `session.header.agentPreset`，headless 可以这样开：

```sh
dsh --profile headless --preset article-editor "为什么必须写回"
```

遇到 `task` 卡，这一枪进程会 park。要等工人回来，请用 Web。

## 一拍在做什么

<p align="center">
  <img src="docs/loop.png" alt="调度器一拍：GetInfo、Update、决定、执行" width="100%">
</p>

1. 用户题目成为根节点（若后续不是新题目，则继续同一棵树）。
2. 宿主构造 **WriteHereAgent**，不是 `ReactLoopAgent`。
3. **GetInfo** — 当前节点、祖先、依赖、本稿；规划拍还会带结构图。
4. **Update** — 模型只回 `{"goal":"..."}`，且只改 *这一张* 卡。
5. **决定** — `{"atomic":true}` 表示现在执行，或 `{"atomic":false,"children":[…]}` 表示拆卡。
6. **执行** — `write` 写读者正文；`think` 写备忘；`task` 以 `preset: 'standard'` 调用 `startContinuable`。

子节点完成后，父卡可能进入 `needs-update`，下一拍会先再 Update，再执行。

### 模型允许回什么

| 拍 | 允许的回复 |
|----|------------|
| Update | `{"goal":"..."}` — 只改本节点；不要带子卡；不要改父节点 |
| 决定 | `{"atomic":true}` 或 `{"atomic":false,"children":[{"type":"task"\|"think"\|"write","goal":"...","atomic":true}]}` |
| write 执行 | 读者会读到的段落。不要回 JSON，不要写成「写手须知」 |
| think 执行 | 推理备忘，不是成稿 |

调度器还会执行这些约束：

- `write` 父节点若拆卡，孩子里至少要有一张 `write`。
- `think` 与 `task` 默认原子；再拆必须在该孩子上写 `atomic: false`。
- 可选的 `length` 只给 `write` 孩子当篇幅预算。
- 不要在决定 JSON 后面粘正文。

## 自定义

三层，从最便宜到「你在改驱动」。

| 层 | 改哪里 | 要不要重新构建 |
| --- | --- | --- |
| 主编人设 | `~/.dsh/.agent-presets/article-editor/agent.cordis.yml`（`persona` / `config.text`） | 不用。重启 `dsh web`。 |
| 方法论 | `~/.dsh/.agent-presets/article-editor/skills/<名字>/SKILL.md` | 不用。下一拍规划会重读目录。 |
| 每一拍的指令、工人人设、检索分类 | [`packages/writehere/src/prompts.ts`](packages/writehere/src/prompts.ts) | 要：`node scripts/build.mjs`，再装一次或对着这份检出重启。 |
| 把另一个 preset id 绑到 WriteHere | [`packages/writehere/src/index.ts`](packages/writehere/src/index.ts) 里的 `bindPreset(...)` | 要。目前只绑了 `article-editor` 和 `xieka`。 |
| 算法 / 节点类型 / `tools: []` | 调度器 + 树引擎 | 要，并尽量保持 Algorithm 1 兼容。 |

第一次加载 **不会覆盖** 已经存在的 `article-editor` 目录。请改 `~/.dsh/.agent-presets/` 里那份。只有想恢复出厂 preset 时才删那个目录。

### 哪些 prompt 能改

| Prompt | 文件 | 作用 |
| --- | --- | --- |
| 主编人设（模型以为自己是谁） | preset 的 `agent.cordis.yml` | 真正活着的人设。日常改这里。 |
| Update 拍 | `UPDATE_INSTRUCTION` | 必须仍是「只回 JSON `{"goal":"..."}`，只改本节点」。 |
| 决定拍（write 父节点） | `DECIDE_WRITE_INSTRUCTION` | 必须仍是 JSON `atomic` / `children`。 |
| 决定拍（think / task） | `DECIDE_ATOM_INSTRUCTION` | 同一套 JSON；默认原子。 |
| write / think 执行 | `EXECUTE_WRITE_INSTRUCTION`、`EXECUTE_THINK_INSTRUCTION` | 只收散文。 |
| 父节点合成 | `COMPOSE_WRITE_INSTRUCTION` | 子卡齐了之后只收散文。 |
| 检索工人 | `RETRIEVAL_PERSONA`、`RETRIEVAL_PROMPT_PREFIX` | `isRetrievalGoal(goal)` 为真时传给 `startContinuable`。 |
| 其他 task 工人 | `LAB_PERSONA` | 同一套派工，非检索任务。 |
| GetInfo 外壳 | `GET_INFO_OPEN` / `GET_INFO_CLOSE` | 快照两侧的标签。只改标签、不改 `completeText`，旧快照会漏到表面上。 |

GetInfo 的 **JSON 形状**（节点、祖先、依赖、本稿、规划拍的结构图）由 [`packages/article-tree/src/getinfo.ts`](packages/article-tree/src/getinfo.ts) 生成。把它当协议，不要当文案改。

`DSH_JSON_SCHEMA=1` 会把 Update / 决定从 `{ type: "json_object" }` 换成 `{ type: "json_schema" }`。适配器没写明支持就不要开——DeepSeek 的 chat-completions 对 `json_schema` 仍会 400。

## 扩展

这套循环的设计是 **小主编 + 普通 ReAct 工人**。多出来的能力放在工人或 preset 上，不要做成主编身上的 `article_*` 函数。

### Skills（现在就能加，不用改驱动）

方法论 skill **不是** function calling 工具。编辑 preset 下每个 `SKILL.md` 会在规划拍拼进 `<article-methodology>…</article-methodology>`（[`packages/writehere/src/skills.ts`](packages/writehere/src/skills.ts)）。

```
~/.dsh/.agent-presets/article-editor/skills/
  my-house-style/
    SKILL.md
```

出厂例子：`presets/article-editor/skills/teach-for-transfer/` 与 `column-runtime-control/`。第一次拷贝之后它们在用户 roster 里；新 skill 加在旁边即可。

不要指望在主编 preset 上放一个会开终端、调 API 的 skill，模型就会去调。主编请求里是 `tools: []`。

工人 skill 就是 **`standard`** preset 已经会加载的那些（用户 / 工作区 / 系统 skill 目录）。`task` 卡继承那个世界。给工人加能力：按 DSH 常规给 `standard` 装 skill 包，或在工作区放 `SKILL.md`。

### 工具（工人可以，主编不行）

| 面 | 工具 |
| --- | --- |
| 主编（`WriteHereAgent`） | 没有。不要在这里加 `article_decompose` / `article_write` / `bash`。 |
| `task` 工人（`preset: 'standard'`） | `standard` 有什么就是什么：终端、搜索、你用 `dsh plugin add` 装的其他工具。 |

要给专栏加一种新能力（抓网页、调 API、排版）：

1. 把那个工具做成普通 DSH 插件，装在 **web / standard** 一侧。
2. 在人设或方法论 `SKILL.md` 里写清：何时拆一张 `task`，goal 写成给工人的调度单。
3. 调度器已经会 `startContinuable({ preset: 'standard', persona })`。不用给主编再注册函数。

`prompts.ts` 里的 `isRetrievalGoal` 只决定 **检索人设还是实验人设**，不选工具。长得像发稿的 goal 会走实验人设，不走检索。

### 换 preset，或换驱动

- **同一套 WriteHERE 循环，另一栏。** 把 `article-editor` 拷到 `~/.dsh/.agent-presets/<id>/`，改人设和 skills，再在 `apply()` 里加一行 `ctx.agentDrivers.bindPreset('<id>', 'writehere')`（或写一个只做 `bindPreset` 的小宿主插件）。不绑的话，会话仍是 `ReactLoopAgent`。
- **另一种构造器。** `ctx.agentDrivers.register(id, Ctor)` 是公开注册表。对 `article-editor` 再绑一次会抛错。卸掉本 bundle，writehere 的绑定一起卸掉。
- **不要**靠给主编挂工具带来做「扩展」。那会把循环摊回默认 ReAct。

### 除非你改算法，否则不要动这些

- 拍序：GetInfo → Update → 决定 → 按类型执行
- 节点类型：`write` / `think` / `task`（论文里的 *search*）
- 依赖齐了进入 `needs-update`
- 叶子 `write` 追加 `article.md`；父节点合成不会另写一篇稿
- 步子由宿主走；模型不能靠 function calling 自己点下一张卡

## 能做什么

- 层次化文章树：`write`（读者正文）、`think`（推理备忘）、`task`（检索或实验，论文里的 *search*）
- 先 Update **当前选中节点** 的 goal，再决定或执行
- 依赖刚完成时进入 `needs-update`
- 叶子 write 增量写入工作区草稿
- Web 侧栏 **拆卡树**（`ui-article-tree`，可选）
- 附带 preset **`article-editor`**（界面名：技术博客博主）

## 不适合做什么

出现下面任一需求，请不要用本包：

- 要写代码、运维、开终端的主编。编辑模型没有工具；干活的是普通 `standard` 会话。
- 要一份与 [principia-ai/WriteHERE](https://github.com/principia-ai/WriteHERE) 逐文件对应的 Python 移植。这是按算法重写的 TypeScript 实现。
- 只想在默认循环上多几个 `article_decompose` / `article_write` 之类的 ReAct 函数。
- 希望 headless 一枪把检索跑完。`task` 卡会 park，工人不会在同一次 `dsh` 进程里结束。**完整交互入口是 Web。**
- 在始终 `new ReactLoopAgent` 的原版 `AgentLoop` 上当即当成 WriteHERE。见 [环境要求](#环境要求)。

## 环境要求

- 已安装 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 的 `dsh` 命令
- 宿主的 `AgentLoop.prepare` 会解析 `ctx.agentDrivers` 并用该类构造 Agent。没有这步查找时，bundle 可以装上，会话仍会建成 `ReactLoopAgent`。应有的钩子见 [`patches/agent-loop-prepare.snippet.ts`](patches/agent-loop-prepare.snippet.ts)。
- 活跑需要 profile 里已配置好的模型密钥

`dsh plugin --profile <名字> add` 会把参数转发给 `$DSH_HOME/profiles/<名字>` 里的 **pnpm**。这是官方插件安装路径，见[打包并安装插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/publish.zh.md)。

如果新建的 `article-editor` 会话仍像会调工具的编程助手，说明宿主还没有上述 prepare 钩子。只把 bundle 装进 profile 不够。

## 工作原理

本仓库是 DSH **bundle**：`package.json` 声明 `"dsh": { "bundle": { "patch": "./cordis.patch.yml" } }`。装进 profile 后会多一层配置，插入三个插件：

- `agent-drivers` — 宿主平面的构造器注册表（`ctx.agentDrivers`）
- `writehere` — 注册 `WriteHereAgent`，并把 preset `article-editor` 绑到它
- `ui-article-tree` — Web 侧栏；在 headless 上为空操作

`register` 与 `bindPreset` 必须在**宿主**上下文、任何会话创建之前执行。它们不能放进 preset：preset 在 `new Agent` 之后才 mount。

每次调模型都会重新生成一封 GetInfo（`<article-get-info>…</article-get-info>`）。方法论 skill 和短栏记忆在这封 JSON **外面**。Update / 决定拍走 JSON 响应格式；think / write / 合成拍只收散文。`completeText` 在模型可见表面上只保留最新一封 GetInfo。

## 和论文、Python 原版的差别

算法和节点类型跟 WriteHERE §5 / Algorithm 1 以及 [principia-ai/WriteHERE](https://github.com/principia-ai/WriteHERE)。下面几处是有意不同，不是漏移植：

| | 论文 / Python | 本包 |
|---|---------------|------|
| 主编一侧 | Python 引擎里的写作工具 | `tools: []`，由宿主调度 |
| 检索类型名 | `search` | `task` |
| GetInfo | 共享的规划上下文 | Update、决定、执行各自刷新一封 |
| 检索 / 实验 | Python lab 进程 | DSH `standard` 会话，经 `startContinuable` |
| 代码 | 参考 Python 实现 | 新的 TypeScript 实现 |

## 仓库结构

```
docs/                      README 封面、拆卡树示意图、一拍流程图
packages/agent-drivers     ctx.agentDrivers 注册表
packages/article-tree      树、GetInfo、草稿辅助
packages/writehere         WriteHereAgent 与 Algorithm 1 调度器
packages/ui-article-tree   Web 拆卡树侧栏
presets/article-editor     人设与 skills（无工具）
cordis.patch.yml           `dsh plugin add` 叠上去的那一层
```

改循环请先看 [CONTRIBUTING.md](CONTRIBUTING.md)。主编一侧保持没有模型可见工具。

## 致谢与引用

- Ruibin Xiong、Yimeng Chen、Dmitrii Khizbullin、Mingchen Zhuge、Jürgen Schmidhuber。《Beyond Outlining: Heterogeneous Recursive Planning for Adaptive Long-form Writing with Language Models》。2025。https://arxiv.org/abs/2503.08275
- 参考实现：https://github.com/principia-ai/WriteHERE
- 插件与 Agent 契约：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)

署名说明见 [NOTICE](NOTICE)。机器可读引用见 [CITATION.cff](CITATION.cff)。

```bibtex
@misc{xiong2025heterogeneousrecursiveplanning,
  title={Beyond Outlining: Heterogeneous Recursive Planning for Adaptive Long-form Writing with Language Models},
  author={Ruibin Xiong and Yimeng Chen and Dmitrii Khizbullin and Mingchen Zhuge and J{\"u}rgen Schmidhuber},
  year={2025},
  eprint={2503.08275},
  archivePrefix={arXiv},
  primaryClass={cs.AI},
  url={https://arxiv.org/abs/2503.08275}
}
```

## 许可证

[MIT](LICENSE)。算法属于论文作者。这份 TypeScript 实现是新写的，不是逐文件移植。

## 发现

DeepSeek Harness 用 GitHub topic [`dsh-plugin`](https://github.com/topics/dsh-plugin) 收录社区插件。本仓库已打上：

`dsh-plugin` · `dsh` · `deepseek-harness` · `writehere` · `agent-driver` · `long-form-writing` · `cordis`

[awesome-dsh-plugin](https://github.com/Anil-matcha/awesome-dsh-plugin) 和市场类索引都靠这个 topic 发现新插件。被收录不等于安全审计——安装前请先读本 README 和源码。
