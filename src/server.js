/**
 * Fastify 服务器入口
 * 
 * SealAI Webhook 集成 Demo
 */

import Fastify from 'fastify';
import fastifyStatic from '@fastify/static';
import fastifyCors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import path from 'path';
import { fileURLToPath } from 'url';

// 导入路由
import pushDocumentRoute from './routes/push-document.js';
import pushManualResultRoute from './routes/push-manual-result.js';
import receiveResultRoute from './routes/receive-result.js';

// 获取当前文件目录
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 创建 Fastify 实例
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'development' ? {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    } : undefined,
  },
  disableRequestLogging: process.env.NODE_ENV === 'production',
});

// 错误处理器
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(error.statusCode || 500).send({
    success: false,
    error: error.message,
    code: error.code,
  });
});

// 注册插件
await fastify.register(fastifyCors, {
  origin: true, // 允许所有来源（演示用途）
  credentials: true,
});

await fastify.register(fastifyMultipart, {
  limits: {
    fieldNameSize: 100,
    fieldSize: 100 * 1024 * 1024, // 100MB
    fields: 10,
    fileSize: 100 * 1024 * 1024, // 100MB
    files: 10,
    headerPairs: 2000,
  },
});

await fastify.register(fastifyStatic, {
  root: path.join(__dirname, '../public'),
  prefix: '/',
  constraints: {}, // 移除默认约束
});

// 注册路由
await fastify.register(pushDocumentRoute);
await fastify.register(pushManualResultRoute);
await fastify.register(receiveResultRoute);

// 健康检查接口
fastify.get('/api/health', async (request, reply) => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// 启动服务器
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '5500');
    const host = process.env.HOST || '127.0.0.1';
    
    // 使用 127.0.0.1 而不是 0.0.0.0，避免网络接口获取问题
    await fastify.listen({ 
      port, 
      host,
      listenTextResolver: () => '' // 禁用自动地址日志
    });
    
    console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  🚀 SealAI Webhook Demo 已启动！
  
  📍 本地地址: http://localhost:${port}
  
  📖 API 文档:
     - POST /api/push-document - 推送单据
     - POST /api/push-manual-result - 推送审批结果
     - GET  /api/receive-result - 查询接收结果
     - POST /api/receive-result - 接收审批结果
     - GET  /api/health - 健康检查
     
  🎨 Web 界面: http://localhost:${port}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);
  } catch (err) {
    console.error('启动失败:', err);
    process.exit(1);
  }
};

// 优雅关闭
const gracefulShutdown = async () => {
  fastify.log.info('收到关闭信号，正在优雅关闭...');
  await fastify.close();
  fastify.log.info('服务器已关闭');
  process.exit(0);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// 启动
start();
