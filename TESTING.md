# LexiKeep 测试报告

测试日期：2026-10-28，macOS，Chromium 151（Playwright 1.62.1）。

## 真实操作验证

使用未经修改权限的生产扩展，通过原生工具栏点击 LexiKeep，验证 activeTab 授权。真实弹窗初始化、注入页面脚本、请求在线中文翻译、显示处理数量、精确恢复原文均通过。原始记录：`test-results/native-flow.json`，截图：`test-results/native-popup.png`。该操作记录基于 1.1.0；1.1.1 的权限与弹窗流程未变，页面可见性修复另经下述回归验证。

## 浏览器自动回归：10 项通过

`tests/browser.cjs` 使用真实 Chromium 和生产源文件；仅临时副本的清单加入 localhost 权限，以便自动化注入测试页。它不替代上面的工具栏授权验证。翻译服务在本组测试中使用确定性模拟，在线服务另测。

- 首次安装指南和默认设置。
- 隐藏祖先容器、编辑区、代码后代和 translate=no 不发送翻译。
- 精确恢复原文，多次翻译不嵌套包装。
- 长段落分段，单请求不超过 480 UTF-8 字节。
- 服务失败保留原文，正确返回失败数量。
- 学习模式保留词汇，打开词卡，恢复时移除词卡。
- 占位符损坏保留原文。
- 重复注入无重复监听；请求中拒绝恢复和重复翻译。
- 受限页错误提示，失败后按钮恢复可用（测试指定目标页，未原生点击内部页工具栏）。
- 请求期间页面更新，不覆盖应用新状态。

测试曾真实暴露隐藏祖先容器仍被翻译的问题（预期 1 个、实际 3 个文本块），修复后上述测试通过。学习词卡测试初次失败因测试语料不包含示例词库单词，更换为真实词库词汇后验证通过。

## 在线语义评测

`tests/corpus.json` 包含 10 条人工编写的非私人语料。使用实际后台翻译函数和 MyMemory 在线 API，原始返回值在 `test-results/online-corpus.json`。

人工按每条预先列出的关键含义检查：9 条符合，1 条失败。否定、条件、数字、日期、银行/河岸、多分句因果等案例通过。失败案例：`call it a day` 被误译为“打电话”。这说明公共服务仍可能误译惯用语；本轮保留该失败记录，不用硬编码单句答案掩盖问题。此小样本结果不能代表总体准确率。

## 复现

```sh
python3 scripts/check_project.py
node scripts/test_translation.cjs
npm install --no-save --package-lock=false playwright@1.62.1
npx playwright install chromium
node tests/browser.cjs
node scripts/test_online.cjs
python3 scripts/package.py
```

在线测试会消耗公共 API 配额，返回值和速度可能变化，不放进自动发布门槛。`tests/native-flow.cjs` 需要先在可见测试 Chromium 中真实点击工具栏，按脚本注释提供 CDP 端口后运行。

## 验证边界

没有单独在 Microsoft Edge 或 Windows 上运行；没有声称机器翻译全对。跨 DOM 文本节点的语义、很长段落的跨分段语境以及惯用语质量仍有限。后台服务超时由 AbortSignal 控制，本组未实际等待 15 秒超时。安装包 CRC、Manifest 版本及发布资产哈希另行核对。
