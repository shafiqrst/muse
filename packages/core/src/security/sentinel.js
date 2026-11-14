import fs from 'fs';
import path from 'path';

/**
 * The Sentinel: Human-in-the-Loop Security & Guardrail
 */
export class SentinelGuard {
  constructor(options = {}) {
    this.workspaceRoot = options.workspaceRoot || process.cwd();
    this.auditLogPath = path.join(this.workspaceRoot, '.mose', 'audit_trail.jsonl');
    this.confirmCallback = options.confirmCallback || null;
    this.initAuditLog();
  }

  initAuditLog() {
    const dir = path.dirname(this.auditLogPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  static SENSITIVE_PATTERNS = [
    { type: 'payment', keywords: ['buy', 'purchase', 'checkout', 'pay', 'order', 'stripe', 'card', 'billing'] },
    { type: 'communication', keywords: ['send_email', 'post', 'publish', 'tweet', 'send_message', 'whatsapp'] },
    { type: 'destructive', keywords: ['delete', 'destroy', 'format', 'drop', 'wipe', 'remove', 'rmdir', 'unlink'] },
    { type: 'auth', keywords: ['password', 'credential', 'token', 'secret', 'api_key', 'private_key'] }
  ];

  classifyAction(actionName, params = {}) {
    const serialized = JSON.stringify(params).toLowerCase();
    const actionLower = actionName.toLowerCase();

    for (const rule of SentinelGuard.SENSITIVE_PATTERNS) {
      for (const kw of rule.keywords) {
        if (actionLower.includes(kw) || serialized.includes(kw)) {
          return {
            isSensitive: true,
            riskLevel: rule.type === 'payment' ? 'CRITICAL' : 'HIGH',
            category: rule.type,
            reason: `Action '${actionName}' matches protected rule: ${rule.type}`
          };
        }
      }
    }

    return {
      isSensitive: false,
      riskLevel: 'LOW',
      category: 'safe',
      reason: 'Safe or read-only action'
    };
  }

  async verifyAction(actionName, params) {
    const classification = this.classifyAction(actionName, params);
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: actionName,
      params,
      riskLevel: classification.riskLevel,
      category: classification.category
    };

    if (!classification.isSensitive) {
      auditEntry.status = 'auto_approved';
      this.recordAudit(auditEntry);
      return { approved: true, auto: true };
    }

    let approved = false;
    if (this.confirmCallback) {
      approved = await this.confirmCallback({
        action: actionName,
        params,
        riskLevel: classification.riskLevel,
        reason: classification.reason
      });
    }

    auditEntry.status = approved ? 'user_approved' : 'user_rejected';
    this.recordAudit(auditEntry);
    return { approved, auto: false, reason: classification.reason };
  }

  recordAudit(entry) {
    try {
      fs.appendFileSync(this.auditLogPath, JSON.stringify(entry) + '\n', 'utf8');
    } catch {}
  }
}
