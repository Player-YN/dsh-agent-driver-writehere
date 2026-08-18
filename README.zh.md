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
  <a href="#安装">安装</a> ·
  <a href="#快速上手">快速上手</a> ·
  <a href="#一拍在做什么">一拍在做什么</a> ·
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

## 安装

官方安装：

```sh
dsh plugin --profile web add github:Player-YN/dsh-agent-driver-writehere
```

钉死某个 commit，避免 `main` 一推安装物就变：

```sh
dsh plugin --profile web add github:Player-YN/dsh-agent-driver-writehere#<sha>
```

再把出厂 preset 拷到本机 presets 目录（下面的远程包装脚本会代做这一步）：

```sh
# DSH_HOME 默认为 ~/.dsh
cp -R "$DSH_HOME/profiles/web/node_modules/dsh-agent-driver-writehere/presets/article-editor" \
      "$DSH_HOME/.agent-presets/article-editor"
```

重启该 profile，并确认配置层已叠上：

```sh
dsh --profile web --dump-config   # 应出现 "# == dsh-agent-driver-writehere"
```

将来若发到 npm，命令会是 `dsh plugin --profile web add dsh-agent-driver-writehere`。**目前尚未发布到 npm。**

### 可选的远程包装

`install-remote.sh` 与 `install-remote.ps1` 只调用官方的 `dsh plugin add`，再拷一份 preset。它们不是第二套加载器。请钉 commit，并且只对你读过的脚本做管道执行。

```sh
# macOS / Linux
WRITEHERE_PLUGIN=github:Player-YN/dsh-agent-driver-writehere \
  curl -fsSL https://raw.githubusercontent.com/Player-YN/dsh-agent-driver-writehere/main/install-remote.sh | sh
```

```powershell
# Windows
$env:WRITEHERE_PLUGIN = 'github:Player-YN/dsh-agent-driver-writehere'
irm https://raw.githubusercontent.com/Player-YN/dsh-agent-driver-writehere/main/install-remote.ps1 | iex
```

### 本地目录

```powershell
.\install.ps1
# 可选：.\install.ps1 -Profile web -Harness /path/to/deepseek-harness
```

```sh
dsh plugin --profile web add .
# 再把 presets/article-editor 拷到 $DSH_HOME/.agent-presets/article-editor
```

`install.ps1` 会先拷 preset，再对本目录执行官方的 `dsh plugin add`。

若某个 profile 已经从其他层装过本驱动，不要再加一次 bundle，同一 driver id 不能重复注册。

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
