# SealAI Webhook 集成 Demo

这是一个演示如何与 SealAI Webhook 接口集成的示例项目。该项目使用 **Fastify** 构建后端服务，纯 HTML/CSS/JavaScript 构建前端界面，提供完整的 Webhook 集成演示功能。

## 📚 目录

- [功能特性](#-功能特性)
- [项目结构](#-项目结构)
- [快速开始](#-快速开始)
- [使用指南](#-使用指南)
- [API 接口说明](#-api-接口说明)
- [签名算法说明](#-签名算法说明)
- [命令行测试](#-命令行测试)
- [测试场景](#-测试场景)
- [注意事项](#-注意事项)
- [常见问题](#-常见问题)

## ✨ 功能特性

- 🚀 **推送单据到 SealAI**：支持附件上传和完整单据推送
- 📥 **接收审批结果**：作为 Outgoing Webhook 接收端，实时接收 SealAI 推送的审批结果
- 🔄 **人工审批模拟**：模拟推送人工审批结果（approve/reject）
- 💾 **历史记录管理**：使用 localStorage 保存推送历史（前端）+ 内存存储审批结果（后端）
- 🔐 **HMAC-SHA256 签名**：完整实现 SealAI 的签名验证机制
- 🎨 **简洁 UI**：纯 HTML/CSS/JS 实现，无需复杂框架

## 📁 项目结构

```
webhook-demo/
├── src/
│   ├── server.js             # Fastify 服务器入口
│   └── routes/               # API 路由
│       ├── push-document.js      # 推送单据到 SealAI
│       ├── push-manual-result.js # 推送人工审批结果
│       └── receive-result.js     # 接收审批结果
├── public/                   # 静态资源
│   ├── index.html           # 主页面
│   ├── style.css            # 样式文件
│   └── app.js               # 前端逻辑
├── lib/                     # 共享工具库
│   └── signature.js         # 签名生成工具
├── package.json             # 依赖配置
├── Dockerfile               # Docker 镜像配置
├── docker-compose.yml       # Docker Compose 配置
├── .env.example             # 环境变量示例
└── README.md                # 本文档
```

## 🚀 快速开始

### 环境要求

- Node.js 20.0.0 或更高版本
- npm 或 pnpm

### 启动步骤

```bash
# 1. 安装依赖
npm install

# 2. 启动服务器
PORT=5500 npm start

# 3. 打开浏览器访问
open http://localhost:5500
```

### 开发模式（支持热重载）

```bash
PORT=5500 npm run dev
```

### Docker 部署（可选）

```bash
# 使用 Docker Compose
docker-compose up -d

# 查看日志
docker-compose logs -f

# 停止服务
docker-compose down
```

## 📖 使用指南

### 1. 配置 SealAI Webhook

在 Demo 页面的"⚙️ 配置"区域填写以下信息：

#### SealAI Webhook 地址
- **作用**：用于推送单据到 SealAI
- **格式**：`https://your-domain.com/api/v1/integrations/webhook/{webhookId}`
- **示例**：`https://dev.localhost.tv:5500/api/v1/integrations/webhook/abc123`
- **获取方式**：由 SealAI 提供

#### Webhook Secret
- **作用**：用于生成 HMAC-SHA256 签名，确保请求安全性
- **格式**：32 位字符串
- **示例**：`a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`
- **获取方式**：由 SealAI 提供

#### 本 Demo 的接收地址
- **作用**：接收 SealAI 推送的审批结果
- **格式**：`http://your-server:5500/api/receive-result`
- **配置位置**：将此地址配置到 SealAI 作为 **Outgoing Webhook URL**
- **注意**：本地测试时需要使用内网穿透工具（如 ngrok）使 SealAI 可以访问

配置完成后点击"保存配置"按钮。

### 集成检查清单

在开始集成前，请确认以下事项：

- [ ] 已从 SealAI 获取 Webhook URL 和 Secret
- [ ] 已在 Demo 配置页面保存配置
- [ ] 已将接收地址配置到 SealAI 的 Outgoing Webhook
- [ ] 服务器已启动并可访问（`curl http://localhost:5500/api/health` 返回 200）
- [ ] 如果是本地测试，已配置内网穿透工具

### 2. 推送单据到 SealAI

在"📤 推送单据"区域：

1. **加载示例单据**
   - 点击"加载示例单据（无附件）"加载基础模板
   - 点击"加载示例单据（带附件）"加载包含本地示例文件（100KB .doc 文件）的模板
   - 附件 URL 会自动包含在 JSON 的 `attachments` 字段中

2. **编辑单据（可选）**
   - 可以手动修改 JSON 内容
   - 可以在 `attachments` 字段的 `value` 数组中添加更多附件 URL
   - 附件 URL 必须可公开访问

3. **推送**
   - 点击"推送单据"按钮
   - 系统会自动提取 JSON 中的附件 URL
   - 先下载附件并上传到 SealAI
   - 然后推送完整的单据数据

4. **查看结果**
   - 推送结果会显示在页面下方
   - 成功推送的单据会添加到历史记录

### 3. 查看历史记录

在"📋 历史记录"区域：

- 查看所有推送过的单据
- 支持操作：
  - **审批通过**：推送人工审批通过结果到 SealAI
  - **审批拒绝**：推送人工审批拒绝结果到 SealAI
  - **删除记录**：从本地删除历史记录

### 4. 接收审批结果

在"📥 接收的审批结果"区域：

- 自动轮询（每 5 秒）接收 SealAI 推送的审批结果
- 显示：
  - 接收时间
  - 单据 ID
  - 决策结果（approve/reject/review）
  - 审批意见
  - 详情链接（可点击跳转到 SealAI 查看详情）

## 🔑 API 接口说明

### 1. 推送单据 API

**端点**：`POST /api/push-document`

**功能**：推送单据数据到 SealAI，支持附件上传

**请求体**：

```json
{
  "documentData": {
    "type": "document",
    "documentId": "DOC-001",
    "documentSN": "采购申请-001",
    "documentURL": "https://example.com/doc/001",
    "startTime": 1704067200,
    "fields": [
      {
        "key": "title",
        "type": "TEXT",
        "value": "办公用品采购"
      },
      {
        "key": "amount",
        "type": "AMOUNT",
        "value": 15000
      },
      {
        "key": "attachments",
        "type": "ATTACHMENT",
        "value": [
          "https://example.com/file1.pdf",
          "https://example.com/file2.jpg"
        ]
      }
    ]
  },
  "attachmentUrls": [
    "https://example.com/file1.pdf",
    "https://example.com/file2.jpg"
  ],
  "config": {
    "webhookUrl": "https://your-domain.com/api/v1/integrations/webhook/YOUR_ID",
    "secret": "your-32-character-secret"
  }
}
```

**注意**：
- 将 `https://example.com/...` 替换为你实际的附件 URL
- 附件 URL 必须可公开访问
- 本 Demo 提供了测试用的本地文件：`http://localhost:5500/file-sample_100kB.docx`

**成功响应**（200）：

```json
{
  "success": true,
  "message": "单据推送成功",
  "uploadedAttachments": 2,
  "result": {
    "documentId": "DOC-001",
    "status": "submitted"
  }
}
```

**失败响应**（400/500）：

```json
{
  "success": false,
  "error": "签名验证失败",
  "details": "Webhook signature verification failed"
}
```

### 2. 推送人工审批结果 API

**端点**：`POST /api/push-manual-result`

**功能**：模拟人工审批结果推送到 SealAI

**请求体**：

```json
{
  "documentId": "DOC-001",
  "decision": "approve",
  "comment": "符合采购流程，同意采购",
  "approver": {
    "id": "user001",
    "name": "张三",
    "email": "zhangsan@example.com"
  },
  "config": {
    "webhookUrl": "https://your-domain.com/api/v1/integrations/webhook/YOUR_ID",
    "secret": "your-32-character-secret"
  }
}
```

**参数说明**：
- `decision`: 审批决策，可选值：`approve`（通过）、`reject`（拒绝）
- `comment`: 审批意见（可选）

**成功响应**（200）：

```json
{
  "success": true,
  "message": "审批结果推送成功"
}
```

### 3. 接收审批结果 API

#### 接收端点（由 SealAI 调用）

**端点**：`POST /api/receive-result`

**功能**：接收 SealAI 推送的审批结果

**请求体示例**（由 SealAI 推送）：

```json
{
  "documentId": "DOC-001",
  "decision": "approve",
  "comment": "审批通过",
  "detailURL": "https://your-domain.com/detail/DOC-001",
  "timestamp": 1704067200
}
```

**响应**：

```json
{
  "success": true,
  "message": "审批结果已接收"
}
```

#### 查询端点

**端点**：`GET /api/receive-result`

**功能**：查询已接收的所有审批结果

**响应**：

```json
{
  "total": 2,
  "results": [
    {
      "documentId": "DOC-001",
      "decision": "approve",
      "comment": "审批通过",
      "receivedAt": "2024-01-01T12:00:00.000Z"
    },
    {
      "documentId": "DOC-002",
      "decision": "reject",
      "comment": "预算不足",
      "receivedAt": "2024-01-01T13:00:00.000Z"
    }
  ]
}
```

#### 删除端点

**端点**：`DELETE /api/receive-result/:documentId`

**功能**：删除指定单据的审批结果

**响应**：

```json
{
  "success": true,
  "message": "已删除"
}
```

### 4. 健康检查 API

**端点**：`GET /api/health`

**功能**：检查服务器是否正常运行

**响应**：

```json
{
  "status": "ok",
  "timestamp": "2024-01-01T12:00:00.000Z"
}
```

### 错误码说明

| HTTP 状态码 | 错误信息 | 说明 | 解决方法 |
|------------|---------|------|---------|
| 400 | "Missing required fields" | 缺少必需字段 | 检查请求体是否包含所有必需字段 |
| 401 | "签名验证失败" | HMAC 签名不匹配 | 检查 Secret 配置是否正确 |
| 404 | "Document not found" | 单据不存在 | 确认 documentId 是否正确 |
| 500 | "附件上传失败" | 附件处理错误 | 检查附件 URL 是否可访问 |
| 500 | "推送失败" | SealAI 服务错误 | 查看服务器日志获取详细信息 |

## 🔐 签名算法说明

SealAI 使用 **HMAC-SHA256** 签名机制确保请求的真实性和完整性。本 Demo 完整实现了该签名算法。

### 签名生成流程

```
1. 生成时间戳 (timestamp)
   ↓
2. 生成随机字符串 (nonce)
   ↓
3. 构造请求体 (payload)
   ↓
4. 拼接签名字符串: timestamp.nonce.payload
   ↓
5. 使用 HMAC-SHA256 计算签名
   ↓
6. 将签名和参数添加到 HTTP Headers
```

### 详细步骤

#### 1. 生成时间戳

```javascript
const timestamp = Math.floor(Date.now() / 1000); // Unix 秒级时间戳
// 示例: 1704067200
```

#### 2. 生成 Nonce

```javascript
import crypto from 'crypto';

const nonce = crypto.randomBytes(16).toString('hex'); // 32位十六进制字符串
// 示例: "a1b2c3d4e5f6789012345678abcdef01"
```

#### 3. 构造 Payload

- **附件上传时**：使用 `{ webhookId, files: [{ name, size, type }] }`
- **单据推送时**：使用完整的单据 JSON 对象

```javascript
// 附件上传
const payload = {
  webhookId: 'your-webhook-id',
  files: [{
    name: 'document.pdf',
    size: 102400,
    type: 'application/pdf'
  }]
};

// 单据推送
const payload = {
  type: "document",
  documentId: "DOC-001",
  documentSN: "采购申请-001",
  // ... 其他字段
};
```

#### 4. 构造签名字符串

```javascript
const signatureString = `${timestamp}.${nonce}.${JSON.stringify(payload)}`;
// 示例: "1704067200.a1b2c3d4e5f6789012345678abcdef01.{}"
```

#### 5. 计算 HMAC-SHA256 签名

```javascript
const secret = 'your-32-character-webhook-secret';

const signature = crypto
  .createHmac('sha256', secret)
  .update(signatureString)
  .digest('hex');
// 结果是 64 位十六进制字符串
```

#### 6. 添加到 HTTP Headers

```javascript
const headers = {
  'Content-Type': 'application/json',
  'x-webhook-signature': signature,
  'x-webhook-timestamp': timestamp.toString(),
  'x-webhook-nonce': nonce,
};
```

### 完整示例代码

```javascript
import crypto from 'crypto';

/**
 * 生成 SealAI Webhook 签名
 * @param {Object} payload - 请求体数据
 * @param {string} secret - Webhook 密钥
 * @returns {Object} 包含签名的 headers
 */
function generateSignature(payload, secret) {
  const timestamp = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');
  
  const signatureString = `${timestamp}.${nonce}.${JSON.stringify(payload)}`;
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureString)
    .digest('hex');
  
  return {
    'x-webhook-signature': signature,
    'x-webhook-timestamp': timestamp.toString(),
    'x-webhook-nonce': nonce,
  };
}

// 使用示例
const payload = { type: "document", documentId: "DOC-001" };
const secret = "a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6";
const headers = generateSignature(payload, secret);

// 发送请求
fetch('https://your-domain.com/api/v1/integrations/webhook/YOUR_ID', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    ...headers,
  },
  body: JSON.stringify(payload),
});
```

### 签名验证（接收端）

当 SealAI 推送数据到你的服务器时，你需要验证签名：

```javascript
function verifySignature(body, headers, secret) {
  const receivedSignature = headers['x-webhook-signature'];
  const timestamp = headers['x-webhook-timestamp'];
  const nonce = headers['x-webhook-nonce'];
  
  // 1. 检查时间戳（防重放攻击）
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp)) > 300) { // 5分钟有效期
    throw new Error('Timestamp expired');
  }
  
  // 2. 重新计算签名
  const signatureString = `${timestamp}.${nonce}.${JSON.stringify(body)}`;
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signatureString)
    .digest('hex');
  
  // 3. 比对签名
  if (receivedSignature !== expectedSignature) {
    throw new Error('Invalid signature');
  }
  
  return true;
}
```

### 注意事项

1. **时间戳有效期**：建议验证时间戳在 5 分钟内，防止重放攻击
2. **Nonce 唯一性**：生产环境建议记录已使用的 nonce，防止重复请求
3. **JSON 序列化**：使用 `JSON.stringify()` 时注意保持一致性
4. **密钥安全**：Secret 必须保密，不要提交到代码仓库

## 🔧 命令行测试

### 使用 curl 测试 API

```bash
# 1. 健康检查
curl http://localhost:5500/api/health

# 2. 推送单据（示例）
curl -X POST http://localhost:5500/api/push-document \
  -H "Content-Type: application/json" \
  -d '{
    "documentData": {
      "type": "document",
      "documentId": "DOC-001",
      "documentSN": "采购申请-001",
      "documentURL": "https://example.com/doc/001",
      "startTime": 1704067200,
      "fields": [
        {
          "key": "title",
          "type": "TEXT",
          "value": "测试单据"
        }
      ]
    },
    "attachmentUrls": [],
    "config": {
      "webhookUrl": "https://your-domain.com/api/v1/integrations/webhook/YOUR_ID",
      "secret": "your-32-character-secret"
    }
  }'

# 3. 查询接收到的审批结果
curl http://localhost:5500/api/receive-result
```

---

## 🧪 测试场景

### 场景 1：推送简单单据（无附件）

**步骤**：
1. 在 Web 界面点击"加载示例单据（无附件）"
2. 确认 JSON 中 `attachments.value` 为空数组
3. 点击"推送单据"按钮
4. 查看推送结果和响应信息

**预期结果**：
- 显示"单据推送成功"
- 历史记录中新增一条记录
- 服务器日志显示推送详情

### 场景 2：推送带附件的单据

**步骤**：
1. 点击"加载示例单据（带附件）"
2. 查看 JSON 中的附件字段：
   ```json
   {
     "key": "attachments",
     "type": "ATTACHMENT",
     "value": [
       "http://localhost:5500/file-sample_100kB.docx"
     ]
   }
   ```
3. 点击"推送单据"
4. 观察控制台输出的附件处理过程

**预期结果**：
- 显示"附件下载中..."
- 显示"附件上传中..."（上传 100KB 的 .doc 文件）
- 最后显示"单据推送成功"

### 场景 3：模拟人工审批

**步骤**：
1. 在历史记录中找到已推送的单据
2. 点击"审批通过"或"审批拒绝"
3. 填写审批人信息（姓名、邮箱等）
4. 点击提交

**预期结果**：
- 显示"审批结果推送成功"
- SealAI 收到审批结果

### 场景 4：接收 SealAI 的审批结果

**前提条件**：
- 已在 SealAI 配置本 Demo 的接收地址

**步骤**：
1. 在 SealAI 中处理已推送的单据
2. SealAI 自动推送审批结果到本 Demo
3. 在"📥 接收的审批结果"区域查看

**预期结果**：
- 页面自动刷新（每5秒轮询）
- 显示接收到的审批结果
- 包含单据ID、决策、意见、详情链接

### 场景 5：命令行测试

使用 curl 测试 API：

```bash
# 1. 健康检查
curl http://localhost:5500/api/health

# 2. 查询接收结果
curl http://localhost:5500/api/receive-result

# 3. 推送单据
curl -X POST http://localhost:5500/api/push-document \
  -H "Content-Type: application/json" \
  -d '{"documentData": {...}, "config": {...}}'
```

## ⚠️ 注意事项

### 1. 数据存储

- **前端**：使用 `localStorage` 存储配置和历史记录
- **后端**：使用内存存储接收的审批结果
- 重启服务或清空浏览器缓存会丢失数据
- **⚠️ 本 Demo 仅用于演示和测试**

### 2. 生产环境使用

本项目是演示性质的 Demo，如需用于生产环境，建议进行以下改造：

- 使用持久化存储（Redis/数据库）替代内存存储
- 实现 API 认证和授权机制
- 添加请求限流和日志审计
- 配置 HTTPS 和限制 CORS 来源
- 使用环境变量管理敏感配置

## 🐛 常见问题

### Q1: 推送单据时提示"签名验证失败"

**原因**：Secret 配置不正确或单据 JSON 格式错误

**解决**：
1. 检查 SealAI 提供的 Secret 是否正确（32位密钥）
2. 确认单据 JSON 格式符合规范
3. 查看浏览器控制台和服务器日志中的详细错误信息

### Q2: 附件上传失败

**原因**：附件 URL 无法访问或文件过大

**解决**：
1. 确认附件 URL 可以公开访问（测试：`curl -I <附件URL>`）
2. 检查文件大小（建议 < 100MB）
3. 查看服务器日志中的错误详情

### Q3: 接收不到审批结果

**原因**：Outgoing Webhook 地址配置错误或网络不通

**解决**：
1. 在 SealAI 中配置正确的接收地址：`http://your-server:5500/api/receive-result`
2. 确认服务器可从 SealAI 访问（如果是本地测试，需要内网穿透）
3. 查看服务器日志确认是否收到请求

### Q4: 端口被占用

**解决**：
```bash
# 方式1：使用其他端口
PORT=5500 npm start

# 方式2：查找并停止占用端口的进程（macOS/Linux）
lsof -ti:5500 | xargs kill -9
```

## 📚 相关资源

- [Fastify 官方文档](https://www.fastify.io/)
- [HMAC-SHA256 签名算法](https://en.wikipedia.org/wiki/HMAC)

## 📄 许可证

MIT License

---

## ⚠️ 免责声明

本项目仅用于 **演示和集成测试** 目的，展示如何与 SealAI Webhook 接口进行对接。

**不建议直接用于生产环境**。如需生产使用，请进行以下改造：
- 使用持久化数据库替代内存存储
- 实现完整的认证和授权机制
- 添加请求限流、日志审计和错误监控
- 配置 HTTPS 和生产级安全措施

如有疑问，请联系 SealAI 技术支持团队。
