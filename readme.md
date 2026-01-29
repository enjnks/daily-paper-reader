# 📖 Daily Paper Reader：3 分钟搭建你的智能论文推荐站

一个开箱即用的学术论文推荐系统，通过关键词或自然语言描述你的研究兴趣，每天自动从 arXiv 筛选、重排、精读相关论文，并生成精美的在线阅读站点。

- **零成本部署**：基于 GitHub Actions + Pages，无需服务器，Fork 即用
- **智能推荐**：BM25 + Embedding 双路召回 + Reranker 重排 + LLM 评分，精准匹配你的研究方向
- **沉浸式阅读**：双语标题、论文速览、AI 精读总结、私人研讨区，一站式学术体验
- **实时交互**：站内订阅管理、工作流触发、论文分享、本地聊天记忆，所有操作都在浏览器完成

---

## ✨ 核心功能

### 📊 智能推荐流水线
- **多路召回**：BM25（词法匹配）+ Qwen3-Embedding（语义理解）双引擎检索，RRF 融合扩大覆盖
- **精准重排**：Qwen3-Reranker-4b 对候选集重排序，提升推荐准确度
- **LLM 评分**：自动生成双语证据（Evidence）、一句话总结（TLDR）及 0-10 分评分
- **Carryover 机制**：高分论文跨日保留，避免遗漏重要成果

### 🎨 现代化阅读界面
- **双语标题栏**：中英文标题智能布局，响应式适配
- **论文速览卡片**：Motivation / Method / Result / Conclusion 四维快速浏览
- **AI 精读总结**：自动生成结构化深度总结（需配置 BLT API）
- **私人研讨区**：基于 Gemini 的论文问答，支持上下文对话，本地 IndexedDB 存储记忆

### 🔧 站内后台管理
- **订阅关键词**：支持高级搜索语法（`||` / `&&` / `author:`）
- **智能订阅（LLM Query）**：用自然语言描述研究兴趣，自动扩展查询
- **论文引用追踪**：通过 Semantic Scholar ID 订阅论文的新引用
- **工作流触发**：站内一键刷新推荐结果，实时查看运行状态
- **密钥配置**：本地加密存储 API Key，支持 BLT / Gemini 等多个提供商

### 🎯 辅助功能
- **Zotero 集成**：一键导入论文元数据，包含 AI 总结和聊天历史
- **GitHub Gist 分享**：生成论文分享链接，方便团队协作
- **最近提问**：记录并快速复用常用问题（仅本地存储）

---

## 🚀 快速开始（3 步上线）

### 第 1 步：Fork 本仓库
点击页面右上角的 **Fork** 按钮，将项目复制到你的 GitHub 账号下。

### 第 2 步：激活并运行 Actions
Fork 后 GitHub Actions 默认处于禁用状态，需手动激活：

1. 进入 Fork 后的仓库 → 点击顶部 **Actions** 标签
2. 点击绿色按钮 **I understand my workflows, go ahead and enable them**
3. 左侧选择 **daily-paper-reader** 工作流
4. 右上角点击 **Run workflow** → 再次点击绿色的 **Run workflow** 确认

> 首次运行会生成 `docs/` 目录（网站内容）和 `archive/*/recommend`（推荐结果），耗时约 3-8 分钟。运行成功后会自动提交到 `main` 分支。

### 第 3 步：开启 GitHub Pages
1. 仓库 **Settings** → 左侧 **Pages**
2. **Source** 选择 `Deploy from a branch`
3. **Branch** 选择 `main`，目录选择 `/docs`，点击 **Save**

等待约 30 秒后，页面顶部会显示你的站点地址：`https://<你的用户名>.github.io/<仓库名>/`

---

## 🔑 必需配置

### 1. BLT API（核心能力）

本项目使用 [柏拉图 BLT](https://api.bltcy.ai/register?aff=wrM957407) 提供以下核心能力：
- **重排序（Reranker）**：Step 3 - `qwen3-reranker-4b` 对候选论文精准重排
- **LLM 精炼**：Step 4 - `gemini-3-flash-preview-nothinking` 生成双语证据、TLDR 和评分
- **总结翻译**：Step 6 - 生成论文详细总结（可选）

**配置步骤：**
1. **注册并充值**：访问 [BLT 官网](https://api.bltcy.ai/register?aff=wrM957407)（推荐码已包含），建议先充值 5 元体验
2. **创建 API Key**：右上角头像 → **令牌** → **新建令牌**（名称随意，默认权限即可）
3. **配置到项目**：
   - 方式一（推荐）：站点首页点击"后台管理"→"密钥配置"，在浏览器中加密保存
   - 方式二：在仓库 **Settings** → **Secrets and variables** → **Actions** → **New repository secret**，添加 `BLT_API_KEY`

> 默认模型配置见 [`.github/workflows/daily-paper-reader.yml`](.github/workflows/daily-paper-reader.yml)，可根据需要调整。

### 2. GitHub Token（站内功能）

用于解锁以下高级功能：
- **一键保存配置**：将订阅信息加密写入仓库 Secrets
- **工作流触发**：站内立即刷新推荐结果或同步上游更新
- **Gist 分享**：生成论文分享链接

**推荐方式：使用 Classic PAT（权限最小化）**

1. 点击链接（已预填权限）：  
   https://github.com/settings/tokens/new?description=Daily%20Paper%20Reader&scopes=repo,workflow,gist
2. **Expiration** 选择合适的过期时间（如 90 天），到期可重新生成
3. 点击底部绿色的 **Generate token**，**立即复制**（只显示一次）
4. 在站点首页点击"后台管理"→"密钥配置"，填入 `GitHub Token` 字段

**最小权限说明：**
- `repo`：写入仓库 Secrets（保存 BLT API Key）
- `workflow`：触发 GitHub Actions 工作流
- `gist`：创建论文分享链接

---

## 🔧 目录结构与更新规则

### 用户配置区（可自由修改）
- `config.yaml`：订阅配置（关键词 / LLM Query / 跟踪论文），上游同步不会覆盖

### 每日产出区（自动更新）
- `docs/`：网站内容（GitHub Pages 发布目录）
- `archive/*/recommend`：每日推荐结果（按日期存档）
- `archive/*.json`：运行状态文件（增量抓取、跨日保留、去重）

### 代码区（谨慎修改）
- `src/`：Python 后端流水线（6 个步骤脚本）
- `app/`：JavaScript 前端应用（Docsify 插件、聊天、订阅管理）
- `.github/workflows/`：GitHub Actions 工作流定义

> 建议不要在 Fork 中大幅修改核心代码，以便将来同步上游更新。

---

## 📚 技术栈与工作流

### 后端流水线（Python）
```
Step 0: 丰富查询（可选）  →  LLM 扩展订阅关键词
Step 1: 抓取 arXiv        →  增量获取最新论文
Step 2: 多路召回          →  BM25 + Embedding + RRF 融合
Step 3: 重排序            →  Qwen3-Reranker-4b 精准排序
Step 4: LLM 精炼          →  生成 Evidence / TLDR / Score
Step 5: 选择论文          →  按评分筛选 + Carryover 机制
Step 6: 生成网站          →  Docsify 格式 Markdown + 侧边栏
```

### 前端应用（JavaScript + Docsify）
- **docsify-plugin.js**：核心插件，负责论文页面渲染、标题栏、元数据、导航
- **chat.discussion.js**：私人研讨区，Gemini 对话 + IndexedDB 本地存储
- **subscriptions.manager.js**：后台管理面板，整合关键词/LLM Query/引用追踪
- **workflows.runner.js**：工作流触发面板，GitHub API 调用 + 实时状态查询
- **secret.session.js**：密钥会话管理，libsodium 加密 + localStorage 存储

---

## ❓ 常见问题（FAQ）

**Q: 为什么今天没有更新论文？**  
A: 检查 Actions 运行状态（仓库 → Actions → daily-paper-reader），可能当天窗口内无新论文或被过滤后为空。

**Q: 站点能打开但没有内容？**  
A: 确认 Actions 首次运行成功，且 Pages 设置正确（Branch = main，目录 = /docs）。

**Q: 如何立即刷新推荐结果？**  
A: 方式一：仓库 Actions → daily-paper-reader → Run workflow；方式二：站内"后台管理"→"立即触发"（需 GitHub Token）。

**Q: 私人研讨区的聊天记录存储在哪里？**  
A: 仅本地 IndexedDB（`dpr_chat_db_v1` 数据库），不会上传到服务器或 GitHub。

**Q: 如何同步上游更新？**  
A: 方式一：GitHub 网页 Sync fork → Update branch；方式二：站内"后台管理"→"立即触发"→ 选择"同步上游更新"。

**Q: 能否使用其他 LLM 提供商（如 OpenAI / Claude）？**  
A: 可以，修改 `.github/workflows/daily-paper-reader.yml` 中的环境变量（`BLT_FILTER_MODEL` 等），并在"密钥配置"中添加相应 API Key。

---

## 🌟 特色亮点

### 1. 本地优先的隐私设计
- **聊天记录**：IndexedDB 本地存储，不上传云端
- **API 密钥**：libsodium 加密后存储在 localStorage，仅在浏览器解密
- **最近提问**：仅保存在本机，不同步到 GitHub

### 2. 渐进式增强体验
- **密钥解锁门控**：游客模式可浏览论文，完整功能需解锁密钥
- **响应式布局**：桌面端双栏，移动端自动调整为单栏（Authors 区域优先显示）
- **平滑动画**：侧边栏拖拽、论文切换、弹窗出现都有流畅过渡效果

### 3. 深度集成 GitHub 生态
- **Secrets 写入**：前端直接调用 GitHub API，无需手动复制粘贴
- **Actions 触发**：站内按钮即可启动工作流，实时查看运行日志
- **Gist 分享**：一键生成论文分享链接，包含 AI 总结和讨论历史

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！以下是推荐的贡献方式：

1. **Bug 报告**：请提供复现步骤、错误截图和浏览器控制台日志
2. **功能建议**：描述使用场景和预期效果，最好附上参考案例
3. **代码贡献**：Fork → 创建新分支 → 提交 PR，确保通过 Actions 检查

---

## 📄 开源协议

本项目采用 [MIT License](LICENSE)，可自由使用、修改和分发。

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=ziwenhahaha/daily-paper-reader&type=date&legend=top-left)](https://www.star-history.com/#ziwenhahaha/daily-paper-reader&type=date&legend=top-left)
