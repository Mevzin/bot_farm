function getAdminRoleIds(db) {
  return {
    master: db?.config?.adminRoleIds?.master || '',
    admin: db?.config?.adminRoleIds?.admin || ''
  };
}

function isMemberAdmin({ interaction, db }) {
  if (!interaction.inGuild()) return false;
  if (interaction.memberPermissions?.has('Administrator')) return true;

  const roles = interaction.member?.roles;
  const { master, admin } = getAdminRoleIds(db);
  if (!roles || !roles.cache) return false;
  if (master && roles.cache.has(master)) return true;
  if (admin && roles.cache.has(admin)) return true;
  return false;
}

function isMemberApprover({ interaction, db }) {
  if (!interaction.inGuild()) return false;
  if (isMemberAdmin({ interaction, db })) return true;
  const approverRoleId = db?.config?.approverRoleId || '';
  const roles = interaction.member?.roles;
  if (!approverRoleId) return false;
  if (!roles || !roles.cache) return false;
  return roles.cache.has(approverRoleId);
}

module.exports = {
  isMemberAdmin,
  isMemberApprover
};
