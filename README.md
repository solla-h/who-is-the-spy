# 谁是卧底 (Who is the Spy)

一个基于 Cloudflare Workers 和 D1 数据库的网页版多人社交推理游戏。

## 功能特点

- 🎮 支持 3-20 人游戏
- 🔐 房间密码保护
- 📱 移动端适配
- 🔄 断线重连支持
- ⚡ 实时状态同步
- 🌐 一键部署到 Cloudflare

## 快速开始

### 前置要求

- [Node.js](https://nodejs.org/) 18+
- [Cloudflare 账户](https://dash.cloudflare.com/sign-up)（免费套餐即可）
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)

### 安装 Wrangler CLI

**Windows PowerShell / macOS / Linux：**

```bash
npm install -g wrangler
```

安装完成后验证：

```bash
wrangler --version
```

### 安装依赖

```bash
npm install
```

### 本地开发

1. 创建本地 D1 数据库：

```bash
wrangler d1 create who-is-spy-db --local
```

2. 初始化数据库 Schema：

```bash
npm run db:migrate
```

3. 启动开发服务器：

```bash
npm run dev
```

访问 http://localhost:8787 即可开始游戏。

## 部署到 Cloudflare

### 一键部署

1. 登录 Cloudflare：

```bash
wrangler login
```

2. 创建 D1 数据库：

```bash
wrangler d1 create who-is-spy-db
```

3. 更新 `wrangler.toml` 中的 `database_id`：

将命令输出中的 `database_id` 复制到 `wrangler.toml`：

```toml
[[d1_databases]]
binding = "DB"
database_name = "who-is-spy-db"
database_id = "your-actual-database-id"  # 替换为实际 ID
```

4. 初始化生产数据库：

```bash
wrangler d1 execute who-is-spy-db --file=./schema.sql
# wrangler d1 execute who-is-spy-db --remote --file=./schema.sql # 本地执行
```

5. 部署应用：

```bash
npm run deploy
# wrangler deploy
```

部署完成后，Wrangler 会输出应用的 URL。

### 环境配置

#### wrangler.toml 配置说明

```toml
name = "who-is-spy"           # Worker 名称
main = "src/index.ts"         # 入口文件
compatibility_date = "2024-01-01"

[site]
bucket = "./public"           # 静态资源目录

[[d1_databases]]
binding = "DB"                # 数据库绑定名称
database_name = "who-is-spy-db"
database_id = "your-database-id"  # 从 wrangler d1 create 获取

[triggers]
crons = ["0 * * * *"]         # 每小时清理不活跃房间
```

#### 自定义域名（可选）

在 Cloudflare Dashboard 中：
1. 进入 Workers & Pages
2. 选择你的 Worker
3. 点击 "Custom Domains"
4. 添加你的域名

## 项目结构

```
├── public/                 # 前端静态资源
│   ├── index.html         # 主页面
│   ├── app.js             # 前端逻辑
│   └── styles.css         # 样式文件
├── src/                    # 后端源码
│   ├── index.ts           # Worker 入口
│   ├── router.ts          # API 路由
│   ├── api/               # API 处理函数
│   ├── utils/             # 工具函数
│   └── sync-words.ts      # 词语同步
├── data/
│   └── word-pairs.json    # 词语对数据
├── tests/                  # 测试文件
├── schema.sql             # 数据库 Schema
├── wrangler.toml          # Wrangler 配置
└── package.json
```

## 开发命令

| 命令 | 说明 |
|------|------|
| `npm run dev` | 启动本地开发服务器 |
| `npm run deploy` | 部署到 Cloudflare |
| `npm test` | 运行测试 |
| `npm run test:watch` | 监听模式运行测试 |
| `npm run db:migrate` | 执行数据库迁移（本地） |

## 更新词语库

词语对存储在 `data/word-pairs.json` 文件中。

1. 编辑 `data/word-pairs.json` 添加新词语对
2. 提交并推送到 GitHub
3. 重新部署：`npm run deploy`

词语会在 Worker 启动时自动同步到数据库。

## API 文档

### 创建房间
```
POST /api/room/create
Body: { "playerName": "玩家1" }
Response: { "success": true, "roomCode": "123456", "roomPassword": "AB3K", "playerToken": "xxx" }
```

### 加入房间
```
POST /api/room/join
Body: { "roomCode": "123456", "password": "1234", "playerName": "玩家2" }
```

### 获取房间状态
```
GET /api/room/:roomId/state?token=xxx
```

### 执行游戏操作
```
POST /api/room/:roomId/action
Body: { "token": "xxx", "action": { "type": "start-game" } }
```

## 技术栈

- **前端**: 纯 HTML/CSS/JavaScript
- **后端**: Cloudflare Workers (TypeScript)
- **数据库**: Cloudflare D1 (SQLite)
- **测试**: Vitest + fast-check

## 许可证

MIT License
