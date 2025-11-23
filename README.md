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

### Cloudflare Workers (Static Assets)

1. 推送代码到 GitHub
2. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com/)
3. **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
4. 选择仓库并配置：
   - **Framework**: Vite
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Root directory**: `vite-app`
5. 部署完成后，前端将通过 CDN 全球分发

### Supabase Edge Functions

Edge Functions 已在项目中配置，使用 Supabase MCP 工具部署。

## 🔒 安全特性

### 管理后台保护

管理后台 (`/admin.html`) 采用多层安全防护：

1. **数据库层（RLS）**
   - `coupon_templates` 和 `coupon_pool` 表启用了行级安全策略
   - 只有 `admin_users` 表中的授权用户可以执行管理操作
   - 即使绕过前端，数据库也会拒绝未授权的修改

2. **身份认证**
   - 基于 Supabase Auth 的邮箱验证
   - Magic Link 无密码登录

3. **应用层保护（可选）**
   - 可配置 Cloudflare Access 对 `/admin.html` 路径进行访问控制
   - 在请求到达页面前即进行身份验证

### 添加管理员

在 Supabase SQL Editor 中执行：
```sql
INSERT INTO admin_users (email) VALUES ('admin@example.com');
```

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
│   └── wrangler.jsonc    # Cloudflare Workers 配置
└── supabase/
    ├── functions/        # Edge Functions
    │   └── site/
    │       └── index.ts  # 优惠券领取 API
    └── migrations/       # 数据库迁移
```

## 📝 许可证

MIT License
