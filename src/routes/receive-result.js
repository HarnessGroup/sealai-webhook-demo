/**
 * 接收 SealAI 推送的审批结果
 * 
 * 功能：
 * 1. 接收 SealAI 的 Outgoing Webhook（POST）
 * 2. 将结果存储在内存中
 * 3. 提供查询接口供前端轮询（GET）
 * 4. 提供删除接口清除已读结果（DELETE）
 */

// 使用Map存储结果（内存存储）
const resultsStore = new Map();

// 结果最大保存数量
const MAX_RESULTS = 100;

export default async function receiveResultRoute(fastify, opts) {
  // POST - 接收 SealAI 推送的审批结果
  fastify.post('/api/receive-result', async (request, reply) => {
    try {
      const payload = request.body;

      fastify.log.info(`[接收审批结果] 收到推送: ${JSON.stringify(payload)}`);

      // 验证必要字段
      if (!payload.documentId || !payload.decision) {
        return reply.status(400).send({
          success: false,
          error: '缺少必要字段: documentId 或 decision',
        });
      }

      // 添加接收时间戳
      const result = {
        ...payload,
        receivedAt: new Date().toISOString(),
        receivedTimestamp: Date.now(),
      };

      // 存储到Map
      resultsStore.set(payload.documentId, result);

      // 限制结果数量，删除最旧的
      if (resultsStore.size > MAX_RESULTS) {
        const firstKey = resultsStore.keys().next().value;
        resultsStore.delete(firstKey);
      }

      fastify.log.info('[接收审批结果成功]', {
        documentId: result.documentId,
        decision: result.decision,
        total: resultsStore.size,
      });

      // 返回成功响应给 SealAI
      return reply.send({
        success: true,
      });
    } catch (error) {
      fastify.log.error({ err: error }, '[接收审批结果失败] %s', error.message);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // GET - 前端轮询获取结果
  fastify.get('/api/receive-result', async (request, reply) => {
    try {
      // 返回所有结果（按时间倒序）
      const results = Array.from(resultsStore.values())
        .sort((a, b) => b.receivedTimestamp - a.receivedTimestamp);
      
      fastify.log.debug('[查询结果] 返回', results.length, '条记录');
      
      return reply.send({
        success: true,
        count: results.length,
        results,
      });
    } catch (error) {
      fastify.log.error({ err: error }, '[查询结果失败] %s', error.message);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });

  // DELETE - 清除单个结果
  fastify.delete('/api/receive-result/:documentId', async (request, reply) => {
    try {
      const { documentId } = request.params;
      
      const deleted = resultsStore.delete(documentId);
      
      if (deleted) {
        fastify.log.info('[删除结果]', documentId);
        return reply.send({
          success: true,
          message: '结果已删除',
        });
      } else {
        return reply.status(404).send({
          success: false,
          error: '未找到该结果',
        });
      }
    } catch (error) {
      fastify.log.error({ err: error }, '[删除结果失败] %s', error.message);
      return reply.status(500).send({
        success: false,
        error: error.message,
      });
    }
  });
}
