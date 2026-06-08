function newId(prefix) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${rand}`;
}

module.exports = { newId };

