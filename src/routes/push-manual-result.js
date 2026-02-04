/**
 * 推送人工审批结果到 SealAI
 * 
 * 功能：
 * - 接收前端的审批决策
 * - 构造 ManualApprovalCompletedEvent
 * - 推送到 SealAI Webhook 接口
 */

import { generateSignatureInfo } from '../../lib/signature.js';
import { fetch, Agent } from 'undici';

// 创建支持 HTTPS 自签名证书的 undici agent
const httpsAgent = new Agent({
  connect: {
    rejectUnauthorized: false
  }
});

export default async function pushManualResultRoute(fastify, opts) {
  fastify.post('/api/push-manual-result', async (request, reply) => {
    try {
      const { documentId, decision, approver, config } = request.body;

      // 验证必要参数
      if (!documentId || !decision || !approver || !config) {
        return reply.status(400).send({
          error: '缺少必要参数: documentId, decision, approver 或 config',
        });
      }

      if (!['approve', 'reject'].includes(decision)) {
        return reply.status(400).send({
          error: 'decision 必须是 "approve" 或 "reject"',
        });
      }

      const { webhookUrl, secret } = config;

      if (!webhookUrl || !secret) {
        return reply.status(400).send({ error: '缺少 webhookUrl 或 secret' });
      }

      fastify.log.info('[推送人工审批结果] 开始处理', {
        documentId,
        decision,
        approver: approver.name,
      });

      // 提取 webhookId（从 URL 中提取，格式：/v1/integrations/webhook/{webhookId}/...）
      const webhookIdMatch = webhookUrl.match(/webhook\/([^/]+)/);
      if (!webhookIdMatch) {
        return reply.status(400).send({ error: 'webhookUrl 格式错误，无法提取 webhookId。格式应为：https://domain/v1/integrations/webhook/{webhookId}/...' });
      }
      const webhookId = webhookIdMatch[1];

      // 构建基础 URL（去掉路径，保留协议和域名）
      const urlObj = new URL(webhookUrl);
      const baseUrl = `${urlObj.protocol}//${urlObj.host}`;

      // 构建新的接口路径：/api/v1/integrations/webhook/{webhookId}/manual-result
      const manualResultUrl = `${baseUrl}/api/v1/integrations/webhook/${webhookId}/manual-result`;

      // 构造请求体（不包含 webhookId）
      const requestBody = {
        documentId,
        decision,
        approver: {
          id: approver.id,
          name: approver.name,
          email: approver.email,
        },
        timestamp: Math.floor(Date.now() / 1000),
      };

      // 构建签名 payload（包含 webhookId，因为 oRPC 会将路径参数合并到 input 中）
      const signaturePayload = {
        webhookId,
        ...requestBody,
      };

      // 生成签名
      const { timestamp, nonce, signature } = generateSignatureInfo(signaturePayload, secret);

      console.log('\n=== [推送人工审批结果] 请求详情 ===');
      console.log('URL:', manualResultUrl);
      console.log('请求体:', JSON.stringify(requestBody, null, 2));
      console.log('签名 payload:', JSON.stringify(signaturePayload, null, 2));

      // 发送请求
      const response = await fetch(manualResultUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
          'x-webhook-timestamp': timestamp.toString(),
          'x-webhook-nonce': nonce,
        },
        body: JSON.stringify(requestBody),
        dispatcher: manualResultUrl.startsWith('https') ? httpsAgent : undefined
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`推送失败: ${response.status} - ${errorText}`);
      }

      const result = await response.json();
      fastify.log.info('[推送人工审批结果成功]', result);

      return reply.send({
        success: true,
        message: '人工审批结果推送成功',
        result,
      });
  } catch (error) {
    fastify.log.error({ err: error }, '[推送人工审批结果失败] %s', error.message);
    return reply.status(500).send({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
  });
}
