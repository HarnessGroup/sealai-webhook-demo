/**
 * Webhook 签名工具
 * 
 * 实现 HMAC-SHA256 签名算法，用于验证 Webhook 请求的合法性
 */

import crypto from 'crypto';

/**
 * 生成时间戳（Unix 秒级）
 * @returns {number} Unix 时间戳（秒）
 */
export function generateTimestamp() {
  return Math.floor(Date.now() / 1000);
}

/**
 * 生成 Nonce（32 位随机十六进制字符串）
 * @returns {string} 随机 Nonce
 */
export function generateNonce() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * 生成 HMAC-SHA256 签名
 * 
 * @param {number} timestamp - Unix 时间戳（秒）
 * @param {string} nonce - 随机字符串
 * @param {object} payload - 请求体对象
 * @param {string} secret - 密钥
 * @returns {string} 十六进制签名字符串
 */
export function generateSignature(timestamp, nonce, payload, secret) {
  // 构造签名字符串：timestamp.nonce.payload
  const payloadString = JSON.stringify(payload);
  const signatureContent = `${timestamp}.${nonce}.${payloadString}`;
  
  // 调试日志
  console.log('[签名生成] 详细信息:');
  console.log('  timestamp:', timestamp);
  console.log('  nonce:', nonce);
  console.log('  payload:', payloadString);
  console.log('  secret 前10位:', secret.substring(0, 10));
  console.log('  signatureContent:', signatureContent);
  
  // 使用 HMAC-SHA256 计算签名
  const signature = crypto
    .createHmac('sha256', secret)
    .update(signatureContent)
    .digest('hex');
  
  console.log('  生成的签名:', signature);
  
  return signature;
}

/**
 * 生成完整的签名信息（包含 timestamp, nonce, signature）
 * 
 * @param {object} payload - 请求体对象
 * @param {string} secret - 密钥
 * @returns {object} { timestamp, nonce, signature }
 */
export function generateSignatureInfo(payload, secret) {
  const timestamp = generateTimestamp();
  const nonce = generateNonce();
  const signature = generateSignature(timestamp, nonce, payload, secret);
  
  return {
    timestamp,
    nonce,
    signature,
  };
}
