function parsePositiveInt(value) {
  const n = Number(String(value).trim().replace(/[^\d]/g, ''));
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  return i;
}

function parsePercentage(value) {
  const n = Number(String(value).trim().replace(/[^\d]/g, ''));
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0 || i >= 100) return null;
  return i;
}

function isImageAttachment(attachment) {
  if (!attachment) return false;
  const contentType = attachment.contentType ? String(attachment.contentType).toLowerCase() : '';
  if (contentType.startsWith('image/')) return true;
  const name = attachment.name ? String(attachment.name).toLowerCase() : '';
  return ['.png', '.jpg', '.jpeg', '.webp'].some((ext) => name.endsWith(ext));
}

function normalizeImageUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    if (!['http:', 'https:'].includes(url.protocol)) return '';
    return url.toString();
  } catch {
    return '';
  }
}

module.exports = {
  parsePositiveInt,
  parsePercentage,
  isImageAttachment,
  normalizeImageUrl
};
