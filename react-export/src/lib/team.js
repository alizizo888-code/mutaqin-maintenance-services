// No trusted team service is present in the Whacka export.
const LOCAL_GROUP_ID = 'local-demo';
const known = {
  groupId: async () => LOCAL_GROUP_ID,
  currentMember: async () => null,
};
export const team = new Proxy(known, {
  get(target, key) {
    if (key in target) return target[key];
    if (key === 'then') return undefined;
    return async () => null;
  },
});
