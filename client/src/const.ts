export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

function getReturnPath(returnPath?: string) {
  return returnPath ?? (typeof window !== "undefined" ? window.location.pathname + window.location.search : "/");
}

/** Murder Mitten branded local auth entry point. */
export const getLoginUrl = (returnPath?: string) => {
  const path = getReturnPath(returnPath);
  return `/login?returnTo=${encodeURIComponent(path)}`;
};

/** Existing OAuth provider flow, opened from the branded login screen. */
export const getOAuthLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL || "https://api.manus.im";
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const path = getReturnPath(returnPath);
  const state = btoa(JSON.stringify({ redirectUri, returnPath: path }));

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  return url.toString();
};
