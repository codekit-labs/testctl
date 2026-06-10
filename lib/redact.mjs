// Pure: best-effort PII redaction for text that leaves the machine (webhook payloads,
// shared reports). Conservative — masks the obvious leakers (emails, long digit runs like
// phones / cards / IBANs / long IDs) without nuking small numbers (amounts, line numbers).

export function redactPII(text) {
  if (text == null) return text;
  return String(text)
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, '[email]')        // emails
    .replace(/(?:\+?\d[\s-]?){9,}\d/g, '[number]');             // 10+ digit runs (phones/cards/IBANs/ids)
}

// Apply redaction across the string fields of a notify-style payload (non-mutating).
export function redactNotifyPayload(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  return {
    ...payload,
    text: redactPII(payload.text),
    failed: Array.isArray(payload.failed)
      ? payload.failed.map((f) => ({ ...f, error: f.error == null ? f.error : redactPII(f.error) }))
      : payload.failed,
  };
}
