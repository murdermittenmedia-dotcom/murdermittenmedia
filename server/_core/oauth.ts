import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

function sendErrorPage(res: Response, title: string, message: string, retryUrl?: string) {
  res.status(500).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — Murder Mitten Media</title>
  <style>
    body { background: #080808; color: #fff; font-family: sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { max-width: 420px; padding: 2rem; border: 1px solid #333; border-radius: 8px; text-align: center; }
    h1 { color: #D10000; font-size: 1.5rem; margin-bottom: 0.5rem; }
    p { color: #aaa; margin-bottom: 1.5rem; line-height: 1.6; }
    a { display: inline-block; background: #D10000; color: #fff; padding: 0.6rem 1.5rem; border-radius: 4px; text-decoration: none; font-weight: 600; margin: 0.25rem; }
    a.secondary { background: transparent; border: 1px solid #555; color: #aaa; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${title}</h1>
    <p>${message}</p>
    ${retryUrl ? `<a href="${retryUrl}">Try Again</a>` : ""}
    <a class="secondary" href="/">Go Home</a>
  </div>
</body>
</html>`);
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      sendErrorPage(res, "Login Failed", "Missing login parameters. Please try again.");
      return;
    }

    // Extract the returnPath from state so we can redirect back after login
    const returnPath = sdk.getReturnPathFromState(state);

    try {
      console.log("[OAuth] Starting callback with code and state");
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      console.log("[OAuth] Token exchange successful");
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      console.log("[OAuth] Got user info:", { openId: userInfo.openId, email: userInfo.email });

      if (!userInfo.openId) {
        console.error("[OAuth] Missing openId in userInfo");
        sendErrorPage(res, "Login Failed", "Could not retrieve your account info. Please try again.");
        return;
      }

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
      });
      console.log("[OAuth] User upserted:", userInfo.openId);

      // Check if the user is banned — redirect to /banned before issuing any session
      const existingUser = await db.getUserByOpenId(userInfo.openId);
      if (existingUser?.isBanned) {
        console.log("[OAuth] User is banned:", userInfo.openId);
        res.redirect(302, "/banned");
        return;
      }

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });
      console.log("[OAuth] Session token created");

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });
      console.log("[OAuth] Cookie set with options:", cookieOptions);

      // Redirect to the page the user was on before login, or home
      const safeReturnPath = returnPath && returnPath.startsWith("/") ? returnPath : "/";
      console.log("[OAuth] Redirecting to:", safeReturnPath);
      res.redirect(302, safeReturnPath);
    } catch (error: any) {
      console.error("[OAuth] Callback failed", error);
      const status = error?.response?.status ?? error?.status;
      if (status === 429) {
        sendErrorPage(
          res,
          "Too Many Requests",
          "The login service is temporarily rate-limited. Please wait a moment and try again.",
          `/?retry=1`
        );
      } else {
        sendErrorPage(
          res,
          "Login Failed",
          "Something went wrong during sign-in. Please try again in a moment.",
          `/?retry=1`
        );
      }
    }
  });
}
