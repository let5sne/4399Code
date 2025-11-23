# 4399Code - 智能编程助手优惠券系统

一个基于 Supabase 的优惠券发放和管理系统，提供用户端领取页面和管理员后台。

## 🚀 功能特性

- **用户端**
  - 优惠券展示与领取
  - 邮箱登录认证
  - 优惠码自动生成
  - 一键复制与跳转

- **管理后台**
  - 券种模板管理
  - 批量导入券码
  - 实时库存统计
  - 券种启用/禁用

## 📦 技术栈

- **前端**: Vite + Vanilla JavaScript
- **后端**: Supabase (PostgreSQL + Edge Functions)
- **认证**: Supabase Auth (Magic Link)
- **部署**: Cloudflare Pages

## 🛠️ 本地开发

### 前置要求

- Node.js 18+
- Supabase 账号

### 安装依赖

```bash
cd vite-app
npm install
```

### 环境变量

在 `vite-app` 目录创建 `.env` 文件：

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

### 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:5173

## 🌐 部署

### Cloudflare Pages

1. 推送代码到 GitHub
2. 登录 [Cloudflare Pages](https://dash.cloudflare.com/)
3. 创建新项目，配置：
   - **Framework**: Vite
   - **Build command**: `npm run build`
   - **Build output**: `dist`
   - **Root directory**: `vite-app`

### Supabase Edge Functions

Edge Functions 已在项目中配置，使用 Supabase MCP 工具部署。

## 📁 项目结构

```
4399Code/
├── vite-app/              # 前端应用
│   ├── src/
│   │   ├── app.js        # 用户端逻辑
│   │   ├── admin.js      # 管理端逻辑
│   │   ├── style.css     # 全局样式
│   │   └── supabase.js   # Supabase 客户端
│   ├── index.html        # 用户端页面
│   ├── admin.html        # 管理端页面
│   └── public/
│       └── _redirects    # Cloudflare Pages API 代理配置
└── supabase/
    ├── functions/        # Edge Functions
    │   └── site/
    │       └── index.ts  # 优惠券领取 API
    └── migrations/       # 数据库迁移
```

## 📝 许可证

MIT License
