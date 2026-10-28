# LexiKeep

**Translate to understand. Keep words to learn.**

LexiKeep 是一款面向中文用户的 Chrome / Edge 开源浏览器扩展。它会把当前英文页面翻译为中文，默认用完整原文翻译以保留语境；可选学习模式保留英文关键词并提供行内释义。

## 特性

- 仅在用户点击“翻译当前页”后访问页面，不在所有网站常驻执行。
- 分批处理页面文本，支持失败重试、受控并发和有界缓存。
- 保留重点英文词，点击“详”查看释义、短语和音标。
- 可随时恢复页面原文。
- 包含一份 MIT 许可的小型示例词库，方便开发者替换为自有或兼容授权的词库。
- 零 npm 依赖，可直接加载源码。

## 安装

1. 从 [最新 Release](https://github.com/TheaXin/LexiKeep/releases/latest) 下载 `lexikeep-1.1.1.zip` 并解压（不要选择 GitHub 自动生成的 Source code）。也可直接加载本仓库源码。
2. 打开 `chrome://extensions` 或 `edge://extensions`。
3. 开启“开发者模式”。
4. 选择“加载已解压的扩展程序”，然后选择包含 `manifest.json` 的解压目录。请保留此目录，ZIP 不能直接安装。
5. 在工具栏拼图菜单中固定 LexiKeep；首次安装会自动打开扩展内的使用指南。

更新时覆盖原解压目录，在扩展管理页点击重新加载，然后刷新网页。无需部署网页或启动服务器。

## 使用

1. 打开一个英文网页。
2. 点击浏览器工具栏中的“LexiKeep”。
3. 点击“翻译当前页”。
4. 需要撤销时点击“恢复原页”。

> 浏览器内部页面、扩展商店和其他受限页面不允许扩展注入脚本。

## 隐私与网络请求

翻译时，扩展会将当前页面中待翻译的英文文本发送给 [MyMemory Translation API](https://mymemory.translated.net/doc/spec.php)。扩展不要求账号，不收集分析数据，不在项目服务器上保存网页内容。详见 [PRIVACY.md](PRIVACY.md)。

请不要在包含密码、私人消息、商业机密或其他敏感信息的页面使用公共翻译 API。

## 项目结构

```text
assets/dictionary.json   # 可分发的示例词库
src/background.js        # 设置、翻译请求、缓存
src/content.js           # 页面扫描、替换、恢复和词卡
src/popup.*              # 扩展弹窗
src/dictionary.*         # 词库浏览页
scripts/check_project.py # 项目完整性检查
scripts/package.py       # 生成可发布 ZIP
```

## 开发与检查

需要 Python 3.10+ 和 Node.js 18+。

```bash
python3 scripts/check_project.py
node scripts/test_translation.cjs
python3 scripts/package.py
```

第一条命令会检查 Manifest、JSON、JavaScript 语法和发布必需文件。第二条命令会在 `dist/` 生成不含开发文档和本地文件的安装包。

## 已知限制

- 在线固定语料评测中发现惯用语误译（例如 call it a day）；请结合原文核对。测试结果和边界见 [TESTING.md](TESTING.md)。
- MyMemory 公共服务有配额、速度和可用性限制；失败段落保留原文并显示失败数量。
- 学习模式会以占位符替换少量关键词，可能影响语义准确性，默认关闭。占位符损坏时保留原文。
- 完整句子跨多个 DOM 文本节点时，仍按节点翻译，跨节点语境存在限制。
- 为避免破坏复杂 DOM，单个超过 20,000 字符的文本节点会跳过；其他长段落按句子优先拆分为不超过 480 UTF-8 字节的请求。拆分仍可能损失跨句语境。
- 动态加载的新内容需要再次执行翻译。
- 公开版仅附带小型示例词库；完整词库必须由使用者确保拥有可分发授权。

## 贡献与安全

提交代码前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，不要直接建立公开 Issue。

## 许可证

项目代码和自带示例词库均使用 [MIT License](LICENSE)。外部服务及用户自行导入的数据不因本项目而获得 MIT 授权。

## GitHub 发布

主分支更新后自动检查、测试和打包。首次出现的新 Manifest 版本会创建同名 Release 并上传扩展 ZIP 和 SHA-256 校验文件；已有版本不会覆盖。项目不需要网页部署。
