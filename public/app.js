/**
 * SealAI Webhook 集成 Demo - 前端逻辑
 */

// 存储键名
const STORAGE_KEY = 'sealai-webhook-demo';

// 全局状态
let config = {
  webhookUrl: '',
  secret: '',
};

let history = [];
let currentDocumentId = null;
let pollingInterval = null;

/**
 * 生成单号：YYMMDD + 8位随机数
 * 例如：26020212345678
 */
function generateDocumentSN() {
  const now = new Date();
  const year = String(now.getFullYear()).slice(-2); // 26
  const month = String(now.getMonth() + 1).padStart(2, '0'); // 02
  const day = String(now.getDate()).padStart(2, '0'); // 02
  const random = String(Math.floor(Math.random() * 100000000)).padStart(8, '0'); // 8位随机数
  return `${year}${month}${day}${random}`;
}

// 示例单据模板生成函数
function generateExampleDocument(withAttachments = false) {
  const doc = {
    type: 'document',
    documentId: `DOC-${Date.now()}`,
    documentSN: generateDocumentSN(),
    documentURL: 'https://example.com/document/001',
    startTime: Math.floor(Date.now() / 1000),
    fields: [
      {
        key: 'title',
        label: '申请标题',
        type: 'TEXT',
        value: withAttachments ? '办公设备采购申请（带附件）' : '办公用品采购申请',
      },
      {
        key: 'amount',
        label: '申请金额',
        type: 'AMOUNT',
        value: {
          amount: withAttachments ? 15000 : 5000,
          currency: 'CNY',
        },
      },
      {
        key: 'applicant',
        label: '申请人',
        type: 'PERSON',
        value: {
          id: 'user001',
          name: '张三',
          email: 'zhangsan@example.com',
          department: '采购部',
        },
      },
      {
        key: 'description',
        label: '申请说明',
        type: 'TEXT',
        value: withAttachments 
          ? '采购办公设备，包括显示器、键盘等，详见附件清单'
          : '采购办公用品，包括打印纸、文具等',
      },
      {
        key: 'attachments',
        label: '附件',
        type: 'ATTACHMENT',
        value: withAttachments ? [
          'https://httpbin.org/image/jpeg',
          'https://httpbin.org/image/png'
        ] : [],
      },
    ],
  };
  
  return doc;
}

/**
 * 页面加载时初始化
 */
window.addEventListener('DOMContentLoaded', () => {
  loadFromStorage();
  updateReceiveUrl();
  refreshHistory();
  // 已禁用自动轮询，如需轮询请手动调用 startPolling()
  // startPolling();
  
  console.log('[初始化] 页面加载完成');
});

/**
 * 从 localStorage 加载数据
 */
function loadFromStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      const parsed = JSON.parse(data);
      config = parsed.config || config;
      history = parsed.history || [];
      
      // 恢复配置到表单
      document.getElementById('webhookUrl').value = config.webhookUrl || '';
      document.getElementById('secret').value = config.secret || '';
    }
  } catch (error) {
    console.error('[存储] 加载失败', error);
  }
}

/**
 * 保存到 localStorage
 */
function saveToStorage() {
  try {
    const data = {
      config,
      history,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[存储] 保存失败', error);
  }
}

/**
 * 更新接收地址显示
 */
function updateReceiveUrl() {
  const receiveUrlElement = document.getElementById('receiveUrl');
  const url = `${window.location.origin}/api/receive-result`;
  receiveUrlElement.textContent = url;
}

/**
 * 保存配置
 */
function saveConfig() {
  const webhookUrl = document.getElementById('webhookUrl').value.trim();
  const secret = document.getElementById('secret').value.trim();
  
  if (!webhookUrl || !secret) {
    showStatus('configStatus', '请填写所有配置项', 'error');
    return;
  }
  
  config = { webhookUrl, secret };
  saveToStorage();
  
  showStatus('configStatus', '配置已保存', 'success');
  
  console.log('[配置] 已保存', config);
}

/**
 * 显示状态消息
 */
function showStatus(elementId, message, type = 'success') {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.className = `status-message ${type}`;
  
  setTimeout(() => {
    element.textContent = '';
    element.className = 'status-message';
  }, 3000);
}

/**
 * 加载示例单据
 * @param {boolean} withAttachments - 是否包含附件
 */
function loadExampleDocument(withAttachments = false) {
  const documentJson = document.getElementById('documentJson');
  const exampleDoc = generateExampleDocument(withAttachments);
  documentJson.value = JSON.stringify(exampleDoc, null, 2);
  
  console.log(`[示例] 已加载示例单据${withAttachments ? '（带附件）' : '（无附件）'}`);
}

/**
 * 清空表单
 */
function clearForm() {
  document.getElementById('documentJson').value = '';
  document.getElementById('pushResult').style.display = 'none';
  
  console.log('[表单] 已清空');
}

/**
 * 推送单据
 */
async function pushDocument() {
  if (!config.webhookUrl || !config.secret) {
    alert('请先保存配置');
    return;
  }
  
  const documentJsonText = document.getElementById('documentJson').value.trim();
  
  if (!documentJsonText) {
    alert('请输入单据 JSON');
    return;
  }
  
  let documentData;
  try {
    documentData = JSON.parse(documentJsonText);
  } catch (error) {
    alert('单据 JSON 格式错误：' + error.message);
    return;
  }
  
  // 从单据 JSON 的 attachments 字段中提取附件 URL
  let attachmentUrls = [];
  for (const field of documentData.fields || []) {
    if (field.type === 'ATTACHMENT' && Array.isArray(field.value)) {
      // 如果 value 是字符串数组，直接使用
      attachmentUrls = field.value.filter(url => typeof url === 'string' && url.length > 0);
      break;
    }
  }
  
  console.log('[推送] 开始推送单据', {
    documentId: documentData.documentId,
    attachmentCount: attachmentUrls.length,
  });
  
  // 显示加载状态
  const resultBox = document.getElementById('pushResult');
  const resultContent = document.getElementById('pushResultContent');
  resultBox.style.display = 'block';
  resultContent.textContent = '正在推送...';
  
  try {
    const response = await fetch('/api/push-document', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentData,
        attachmentUrls,
        config,
      }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('[推送] 成功', result);
      resultContent.textContent = JSON.stringify(result, null, 2);
      
      // 添加到历史记录
      addToHistory({
        id: Date.now().toString(),
        timestamp: Date.now(),
        documentId: documentData.documentId,
        documentSN: documentData.documentSN,
        status: 'success',
        response: result,
        documentData,
      });
      
      // 清空表单
      setTimeout(() => {
        clearForm();
      }, 2000);
    } else {
      console.error('[推送] 失败', result);
      resultContent.textContent = `错误：${JSON.stringify(result, null, 2)}`;
      
      // 添加失败记录
      addToHistory({
        id: Date.now().toString(),
        timestamp: Date.now(),
        documentId: documentData.documentId,
        documentSN: documentData.documentSN,
        status: 'failed',
        response: result,
        documentData,
      });
    }
  } catch (error) {
    console.error('[推送] 异常', error);
    resultContent.textContent = `请求失败：${error.message}`;
    
    // 添加失败记录
    addToHistory({
      id: Date.now().toString(),
      timestamp: Date.now(),
      documentId: documentData.documentId,
      documentSN: documentData.documentSN,
      status: 'failed',
      response: { error: error.message },
      documentData,
    });
  }
}

/**
 * 添加到历史记录
 */
function addToHistory(record) {
  history.unshift(record);
  
  // 限制历史记录数量
  if (history.length > 100) {
    history = history.slice(0, 100);
  }
  
  saveToStorage();
  refreshHistory();
}

/**
 * 刷新历史记录表格
 */
function refreshHistory() {
  const tbody = document.getElementById('historyBody');
  
  if (history.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-message">暂无记录</td></tr>';
    return;
  }
  
  tbody.innerHTML = history.map(record => {
    const time = new Date(record.timestamp).toLocaleString('zh-CN');
    const statusClass = `status-${record.status}`;
    const statusText = record.status === 'success' ? '成功' : '失败';
    
    return `
      <tr>
        <td>${time}</td>
        <td>${record.documentId}</td>
        <td>${record.documentSN}</td>
        <td><span class="status-badge ${statusClass}">${statusText}</span></td>
        <td class="action-buttons">
          <button class="btn btn-success btn-sm" onclick="openApprovalModal('${record.documentId}', 'approve')">
            审批通过
          </button>
          <button class="btn btn-danger btn-sm" onclick="openApprovalModal('${record.documentId}', 'reject')">
            审批拒绝
          </button>
          <button class="btn btn-secondary btn-sm" onclick="deleteHistoryRecord('${record.id}')">
            删除
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 清空历史记录
 */
function clearHistory() {
  if (!confirm('确定要清空所有历史记录吗？')) {
    return;
  }
  
  history = [];
  saveToStorage();
  refreshHistory();
  
  console.log('[历史] 已清空');
}

/**
 * 删除历史记录
 */
function deleteHistoryRecord(id) {
  history = history.filter(record => record.id !== id);
  saveToStorage();
  refreshHistory();
  
  console.log('[历史] 已删除记录', id);
}

/**
 * 打开审批模态框
 */
function openApprovalModal(documentId) {
  currentDocumentId = documentId;
  
  document.getElementById('modalDocumentId').textContent = documentId;
  document.getElementById('approverName').value = '张三';
  document.getElementById('approverEmail').value = 'zhangsan@example.com';
  
  document.getElementById('approvalModal').style.display = 'flex';
  
  console.log('[模态框] 已打开', documentId);
}

/**
 * 关闭审批模态框
 */
function closeApprovalModal() {
  document.getElementById('approvalModal').style.display = 'none';
  currentDocumentId = null;
  
  console.log('[模态框] 已关闭');
}

/**
 * 提交审批结果
 */
async function submitApproval(decision) {
  if (!currentDocumentId) {
    alert('单据ID错误');
    return;
  }
  
  if (!config.webhookUrl || !config.secret) {
    alert('请先保存配置');
    closeApprovalModal();
    return;
  }
  
  const approverName = document.getElementById('approverName').value.trim();
  const approverEmail = document.getElementById('approverEmail').value.trim();
  
  if (!approverName || !approverEmail) {
    alert('请填写审批人信息');
    return;
  }
  
  console.log('[审批] 提交审批结果', {
    documentId: currentDocumentId,
    decision,
    approver: { name: approverName, email: approverEmail },
  });
  
  try {
    const response = await fetch('/api/push-manual-result', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        documentId: currentDocumentId,
        decision,
        approver: {
          id: `user_${Date.now()}`,
          name: approverName,
          email: approverEmail,
        },
        config,
      }),
    });
    
    const result = await response.json();
    
    if (response.ok) {
      console.log('[审批] 成功', result);
      alert(`审批结果已推送：${decision === 'approve' ? '通过' : '拒绝'}`);
      closeApprovalModal();
    } else {
      console.error('[审批] 失败', result);
      alert(`推送失败：${result.error}`);
    }
  } catch (error) {
    console.error('[审批] 异常', error);
    alert(`请求失败：${error.message}`);
  }
}

/**
 * 获取接收的审批结果
 */
async function fetchResults() {
  try {
    const response = await fetch('/api/receive-result');
    const data = await response.json();
    
    if (response.ok && data.results) {
      updateResultsTable(data.results);
    }
  } catch (error) {
    console.error('[轮询] 获取结果失败', error);
  }
}

/**
 * 更新结果表格
 */
function updateResultsTable(results) {
  const tbody = document.getElementById('resultsBody');
  
  if (results.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-message">暂无结果</td></tr>';
    return;
  }
  
  tbody.innerHTML = results.map(result => {
    const time = new Date(result.receivedAt).toLocaleString('zh-CN');
    const decisionClass = `decision-${result.decision}`;
    const decisionText = {
      approve: '通过',
      reject: '拒绝',
      review: '待审核',
    }[result.decision] || result.decision;
    
    return `
      <tr>
        <td>${time}</td>
        <td>${result.documentId}</td>
        <td><span class="status-badge ${decisionClass}">${decisionText}</span></td>
        <td>${result.comment || '-'}</td>
        <td>
          ${result.approvalUrl ? `<a href="${result.approvalUrl}" target="_blank">查看详情</a>` : '-'}
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * 开始轮询
 */
function startPolling() {
  // 立即执行一次
  fetchResults();
  
  // 每5秒轮询一次
  pollingInterval = setInterval(() => {
    fetchResults();
  }, 5000);
  
  console.log('[轮询] 已启动（每5秒）');
}

/**
 * 停止轮询
 */
function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
    console.log('[轮询] 已停止');
  }
}

// 页面卸载时停止轮询
window.addEventListener('beforeunload', () => {
  stopPolling();
});
