/** Web stub — Firebase/Firestore not used when Supabase is the source of truth. */
module.exports = new Proxy(
  {},
  {
    get(_t, prop) {
      if (prop === '__esModule') return true;
      if (prop === 'default') return {};
      if (typeof prop === 'symbol') return undefined;
      return function firebaseWebStub() {
        return null;
      };
    },
  }
);
