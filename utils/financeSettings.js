function clampPercent(value, fallback) {
  const n = Number(value ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(100, Math.floor(n)));
}

function getWashPercentage(db) {
  return clampPercent(db?.config?.washPercentage ?? 75, 75);
}

function getSalePercentage(db) {
  return clampPercent(db?.config?.salePercentage ?? 30, 30);
}

module.exports = {
  getWashPercentage,
  getSalePercentage
};
