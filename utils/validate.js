function parsePositiveInt(value) {
  const n = Number(String(value).trim().replace(/[^\d]/g, ''));
  if (!Number.isFinite(n)) return null;
  const i = Math.floor(n);
  if (i <= 0) return null;
  return i;
}

function isImageAttachment(attachment) {
  if (!attachment) return false;
  const contentType = attachment.contentType ? String(attachment.contentType).toLowerCase() : '';
  if (contentType.startsWith('image/')) return true;
  const name = attachment.name ? String(attachment.name).toLowerCase() : '';
  return ['.png', '.jpg', '.jpeg', '.webp', '.gif'].some((ext) => name.endsWith(ext));
}

module.exports = {
  parsePositiveInt,
  isImageAttachment
};

