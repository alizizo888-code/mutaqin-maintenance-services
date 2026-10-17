// Fail-closed team/role adapter: this demo mode grants no staff permissions.
const result = async () => null;
const noPrivilege = async () => false;
const known = {
  getMyRole: result,
  getMyRoles: async () => [],
  claimGroupOwnership: noPrivilege,
  setAdminRoles: noPrivilege,
  inviteToGroup: noPrivilege,
  setRole: noPrivilege,
  removeFromGroup: noPrivilege,
  isAdmin: async () => false,
};
export const social = new Proxy(known, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === 'then') return undefined;
    return async () => null;
  },
});
