# 留词通读

留词通读是一款面向中文用户的 Chrome / Edge 开源浏览器扩展。它会把当前英文页面翻译为中文，同时保留少量值得学习的英文关键词，并提供行内释义。

## 特性

- 仅在用户点击“翻译当前页”后访问页面，不在所有网站常驻执行。
- 分批处理页面文本，支持失败重试、受控并发和有界缓存。
- 保留重点英文词，点击“详”查看释义、短语和音标。
- 可随时恢复页面原文。
- 包含一份 MIT 许可的小型示例词库，方便开发者替换为自有或兼容授权的词库。
- 零 npm 依赖，可直接加载源码。

## 安装

1. 下载最新 [Release](../../releases) 中的 ZIP 并解压，或克隆本仓库。
2. 打开 `chrome://extensions` 或 `edge://extensions`。
3. 开启“开发者模式”。
4. 选择“加载已解压的扩展程序”，然后选择项目根目录。

## 使用

1. 打开一个英文网页。
2. 点击浏览器工具栏中的“留词通读”。
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
python3 scripts/package.py
```

第一条命令会检查 Manifest、JSON、JavaScript 语法和发布必需文件。第二条命令会在 `dist/` 生成不含开发文档和本地文件的安装包。

## 已知限制

- MyMemory 公共服务有配额、速度和可用性限制。
- 为避免破坏复杂 DOM，单个超过 450 字符的文本节点会跳过。
- 动态加载的新内容需要再次执行翻译。
- 公开版仅附带小型示例词库；完整词库必须由使用者确保拥有可分发授权。

## 贡献与安全

提交代码前请阅读 [CONTRIBUTING.md](CONTRIBUTING.md)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告，不要直接建立公开 Issue。

## 许可证

项目代码和自带示例词库均使用 [MIT License](LICENSE)。外部服务及用户自行导入的数据不因本项目而获得 MIT 授权。
