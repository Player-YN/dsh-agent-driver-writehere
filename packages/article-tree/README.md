# @deepseek-ai/dsh-article-tree

技术博客博主：拆卡、判断、本稿读写。工人：另开 **标准模式** 会话，不定制人格。

```sh
cd C:\Users\yyy\Documents\GitHub\deepseek-harness
pnpm dsh web
```

新会话选 **技术博客博主**，或 `pnpm dsh --profile headless --preset article-editor "<题目>"`。页脚打开 **拆卡树**：`needs-update` 表示依赖刚齐，先改本卡 goal。think/task 默认原子，再拆必须 `atomic:false`。需要跑命令时另开标准模式当工人。
