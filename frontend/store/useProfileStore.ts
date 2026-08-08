export const useProfileStore = () => ({
  token: "fake-token",
  profile: null,
  hydrate: () => {},
  loadProfile: () => {},
  saveProfile: async (data: any) => {},
  loading: false,
  error: null,
});
