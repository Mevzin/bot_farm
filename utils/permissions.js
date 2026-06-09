function getConfiguredRoleIds(db) {
  return {
    leader: db?.config?.roleIds?.leader || db?.config?.adminRoleIds?.master || '',
    administration: db?.config?.roleIds?.administration || db?.config?.adminRoleIds?.admin || '',
    management: db?.config?.roleIds?.management || '',
    member: db?.config?.roleIds?.member || db?.config?.memberRoleId || '',
    recruiter: db?.config?.roleIds?.recruiter || db?.config?.approverRoleId || ''
  };
}

function hasRole(interaction, roleId) {
  const roles = interaction.member?.roles;
  if (!roleId) return false;
  if (!roles || !roles.cache) return false;
  return roles.cache.has(roleId);
}

function isAdministrator(interaction) {
  return Boolean(interaction.inGuild() && interaction.memberPermissions?.has('Administrator'));
}

function isMemberLeader({ interaction, db }) {
  if (!interaction.inGuild()) return false;
  if (isAdministrator(interaction)) return true;
  return hasRole(interaction, getConfiguredRoleIds(db).leader);
}

function isMemberAdministration({ interaction, db }) {
  if (!interaction.inGuild()) return false;
  if (isMemberLeader({ interaction, db })) return true;
  return hasRole(interaction, getConfiguredRoleIds(db).administration);
}

function isMemberManagement({ interaction, db }) {
  if (!interaction.inGuild()) return false;
  if (isMemberAdministration({ interaction, db })) return true;
  return hasRole(interaction, getConfiguredRoleIds(db).management);
}

function isMemberRecruiter({ interaction, db }) {
  if (!interaction.inGuild()) return false;
  if (isMemberAdministration({ interaction, db })) return true;
  return hasRole(interaction, getConfiguredRoleIds(db).recruiter);
}

function isMemberMaster({ interaction, db }) {
  return isMemberLeader({ interaction, db });
}

function isMemberAdmin({ interaction, db }) {
  return isMemberAdministration({ interaction, db });
}

function isMemberApprover({ interaction, db }) {
  return isMemberRecruiter({ interaction, db });
}

function isFinanceManager({ interaction, db }) {
  if (!interaction.inGuild()) return false;
  return isMemberManagement({ interaction, db });
}

module.exports = {
  getConfiguredRoleIds,
  isMemberLeader,
  isMemberAdministration,
  isMemberManagement,
  isMemberRecruiter,
  isFinanceManager,
  isMemberMaster,
  isMemberAdmin,
  isMemberApprover
};
