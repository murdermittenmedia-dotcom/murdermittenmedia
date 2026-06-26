export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// Generate login URL at runtime so redirect URI reflects the current origin.
// The state param encodes both the redirectUri (required by OAuth) and the
// returnPath (the page the user was on) so the callback can redirect back.
export const getLoginUrl = (returnPath?: string) => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL || "https://api.manus.im";
  const appId = import.meta.env.VITE_APP_ID;
  const redirectUri = `${window.location.origin}/api/oauth/callback`;
  const path =
    returnPath ??
    (typeof window !== "undefined"
      ? window.location.pathname + window.location.search
      : "/");
  // Encode both redirectUri and returnPath in state as JSON (base64)
  const state = btoa(JSON.stringify({ redirectUri, returnPath: path }));

  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");

  return url.toString();
};
