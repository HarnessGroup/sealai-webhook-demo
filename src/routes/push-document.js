/**
 * 推送单据到 SealAI
 * 
 * 功能流程：
 * 1. 接收前端请求（单据JSON + 附件URL列表）
 * 2. 下载附件并上传到 SealAI
 * 3. 将返回的 AttachmentValue 替换到单据 JSON
 * 4. 推送完整单据到 SealAI
 */

import { generateSignatureInfo } from '../../lib/signature.js';
import { fetch, Agent } from 'undici';
import FormData from 'form-data';
import https from 'https';
import http from 'http';

// 创建支持 HTTPS 自签名证书的 undici agent（用于普通请求）
const undiciAgent = new Agent({
  connect: {
    rejectUnauthorized: false
  }
});

// 创建支持 HTTPS 自签名证书的 Node.js agent（用于 form-data 上传）
const httpsAgent = new https.Agent({
  rejectUnauthorized: false
});

export default async function pushDocumentRoute(fastify, opts) {
  fastify.post('/api/push-document', async (request, reply) => {
    try {
      const { documentData, attachmentUrls, config } = request.body;

      // 验证请求参数
      if (!documentData || !config) {
        return reply.status(400).send({ error: '缺少必要参数: documentData 或 config' });
      }

      const { webhookUrl, secret } = config;

      if (!webhookUrl || !secret) {
        return reply.status(400).send({ error: '缺少 webhookUrl 或 secret' });
      }

      fastify.log.info('[推送单据] 开始处理', {
        documentId: documentData.documentId,
        attachmentUrlsFromRequest: attachmentUrls,
        attachmentCount: attachmentUrls?.length || 0,
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

      // 如果 attachmentUrls 为空，尝试从 documentData.fields 中提取
      let finalAttachmentUrls = attachmentUrls || [];
      
      fastify.log.info('[附件检查] attachmentUrls 参数:', { 
        type: typeof attachmentUrls, 
        isArray: Array.isArray(attachmentUrls),
        length: attachmentUrls?.length,
        value: attachmentUrls 
      });
      
      if ((!finalAttachmentUrls || finalAttachmentUrls.length === 0) && documentData.fields) {
        fastify.log.info('[附件提取] 开始从 fields 中提取，fields 数量:', documentData.fields.length);
        
        for (const field of documentData.fields) {
          fastify.log.debug('[附件提取] 检查字段:', { key: field.key, type: field.type, valueType: typeof field.value, isArray: Array.isArray(field.value) });
          
          if (field.type === 'ATTACHMENT' && Array.isArray(field.value)) {
            fastify.log.info('[附件提取] 找到 ATTACHMENT 字段，value:', field.value);
            
            // 过滤出字符串类型的 URL
            const urls = field.value.filter(item => typeof item === 'string' && item.startsWith('http'));
            if (urls.length > 0) {
              finalAttachmentUrls = urls;
              fastify.log.info('[附件提取] 从 fields 中提取到附件 URL', { count: urls.length, urls });
              break;
            } else {
              fastify.log.info('[附件提取] value 数组为空或不包含有效 URL');
            }
          }
        }
      }

      // 处理附件上传
      let uploadedAttachments = [];
      if (finalAttachmentUrls && finalAttachmentUrls.length > 0) {
        fastify.log.info('[附件上传] 开始处理', finalAttachmentUrls.length, '个附件');

        for (const url of finalAttachmentUrls) {
          try {
            // 下载文件
            fastify.log.info('[附件下载]', url);
            const fileResponse = await fetch(url);

            if (!fileResponse.ok) {
              throw new Error(`下载失败: ${fileResponse.status} ${fileResponse.statusText}`);
            }

            const fileBuffer = Buffer.from(await fileResponse.arrayBuffer());
            const contentType = fileResponse.headers.get('content-type') || 'application/octet-stream';
            
            // 从 URL 提取文件名
            const urlPath = new URL(url).pathname;
            const fileName = urlPath.split('/').pop() || 'attachment';

            fastify.log.info('[附件下载完成]', { fileName, size: fileBuffer.length, contentType });

            // 上传到 SealAI（使用 Node.js 原生 http/https 模块以正确处理 multipart/form-data）
            const attachmentUploadUrl = `${baseUrl}/api/v1/integrations/webhook/${webhookId}/attachments`;
            
            // 生成签名（附件上传时 payload 为空对象）
            const { timestamp, nonce, signature } = generateSignatureInfo({}, secret);

            // 构建 multipart/form-data
            const form = new FormData();
            form.append('files', fileBuffer, {
              filename: fileName,
              contentType: contentType,
            });

            fastify.log.info('[附件上传]', attachmentUploadUrl);

            // 使用 Promise 包装 form.submit
            const uploadResult = await new Promise((resolve, reject) => {
              const url = new URL(attachmentUploadUrl);
              const isHttps = url.protocol === 'https:';
              const client = isHttps ? https : http;
              
              const options = {
                method: 'POST',
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                headers: {
                  'x-webhook-signature': signature,
                  'x-webhook-timestamp': timestamp.toString(),
                  'x-webhook-nonce': nonce,
                  ...form.getHeaders(),
                },
                agent: isHttps ? httpsAgent : undefined,
              };

              const req = client.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                  data += chunk;
                });
                
                res.on('end', () => {
                  if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                      resolve(JSON.parse(data));
                    } catch (error) {
                      reject(new Error(`上传失败: 无法解析响应 - ${data}`));
                    }
                  } else {
                    reject(new Error(`上传失败: ${res.statusCode} - ${data}`));
                  }
                });
              });

              req.on('error', (error) => {
                reject(new Error(`上传请求失败: ${error.message}`));
              });

              // 将 form-data 流式传输到请求
              form.pipe(req);
            });
            fastify.log.info(`[附件上传结果] ${JSON.stringify(uploadResult)}`);

            // 单文件上传返回单个对象，多文件返回 { attachments: [...] }
            if (uploadResult.attachments) {
              uploadResult.attachments.forEach(attachment => {
                uploadedAttachments.push(attachment.data);
              });
            } else {
              uploadedAttachments.push(uploadResult.data);
            }
          } catch (error) {
            fastify.log.error('[附件处理失败]', url, error.message);
            return reply.status(500).send({
              error: `附件处理失败: ${url} - ${error.message}`,
            });
          }
        }

        fastify.log.info('[附件上传完成]', uploadedAttachments.length, '个附件');
      }

      // 将上传的附件替换到单据的 attachments 字段
      const finalDocumentData = JSON.parse(JSON.stringify(documentData));
      
      // 查找 attachments 字段并替换值
      for (const field of finalDocumentData.fields) {
        if (field.type === 'ATTACHMENT') {
          field.value = uploadedAttachments;
          fastify.log.info('[附件替换] 字段:', field.key, '附件数量:', uploadedAttachments.length);
          break;
        }
      }

      // 构建新的接口路径：/api/v1/integrations/webhook/{webhookId}/document
      const documentPushUrl = `${baseUrl}/api/v1/integrations/webhook/${webhookId}/document`;

      fastify.log.info(`[推送单据] 请求详情: ${documentPushUrl}`);

      // 构建请求体（不包含 webhookId）
      const requestBody = {
        documentId: finalDocumentData.documentId,
        documentSN: finalDocumentData.documentSN,
        ...(finalDocumentData.documentURL && { documentURL: finalDocumentData.documentURL }),
        startTime: finalDocumentData.startTime,
        fields: finalDocumentData.fields,
      };

      // 构建签名 payload（包含 webhookId，因为 oRPC 会将路径参数合并到 input 中）
      const signaturePayload = {
        webhookId,
        ...requestBody,
      };

      // 推送单据到 SealAI
      console.log('\n=== [推送单据] 开始推送到 SealAI ===');
      console.log('URL:', documentPushUrl);
      console.log('请求体:', JSON.stringify(requestBody, null, 2));
      console.log('签名 payload:', JSON.stringify(signaturePayload, null, 2));
      
      const { timestamp, nonce, signature } = generateSignatureInfo(signaturePayload, secret);

      const pushResponse = await fetch(documentPushUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-webhook-signature': signature,
          'x-webhook-timestamp': timestamp.toString(),
          'x-webhook-nonce': nonce,
        },
        body: JSON.stringify(requestBody),
        dispatcher: documentPushUrl.startsWith('https') ? undiciAgent : undefined
      });

      if (!pushResponse.ok) {
        const errorText = await pushResponse.text();
        throw new Error(`推送失败: ${pushResponse.status} - ${errorText}`);
      }

      const pushResult = await pushResponse.json();
      fastify.log.info('[推送单据成功]', pushResult);

      return reply.send({
        success: true,
        message: '单据推送成功',
        uploadedAttachments: uploadedAttachments.length,
        result: pushResult,
      });
    } catch (error) {
      fastify.log.error({ err: error }, '[推送单据失败] %s', error.message);
      return reply.status(500).send({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      });
    }
  });
}
