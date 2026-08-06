import type { Express, Request, Response } from "express";
import crypto from "node:crypto";
import { prisma } from "../context.js";
import { signToken } from "../lib/auth.js";
import { appUrl } from "../lib/mailer.js";

/* Google / Facebook sign-in using the OAuth authorization-code flow.
   The provider redirects back here, we exchange the code server-side (so the
   client secret never reaches the browser), then hand the app our own JWT.

   Configure per provider in .env; a provider without credentials simply
   reports that it is unavailable instead of failing at redirect time. */

type ProviderKey = "google" | "facebook";

type Profile = { email: string; name: string; avatar?: string };

const config = {
  google: {
    clientId: () => process.env.GOOGLE_CLIENT_ID,
    clientSecret: () => process.env.GOOGLE_CLIENT_SECRET,
    authUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    profileUrl: "https://www.googleapis.com/oauth2/v2/userinfo",
    scope: "openid email profile",
  },
  facebook: {
    clientId: () => process.env.FACEBOOK_APP_ID,
    clientSecret: () => process.env.FACEBOOK_APP_SECRET,
    authUrl: "https://www.facebook.com/v19.0/dialog/oauth",
    tokenUrl: "https://graph.facebook.com/v19.0/oauth/access_token",
    profileUrl:
      "https://graph.facebook.com/me?fields=id,name,email,picture.type(large)",
    scope: "email public_profile",
  },
} as const;

const apiUrl = () => process.env.API_URL ?? `http://localhost:${process.env.PORT ?? 4000}`;

const redirectUri = (provider: ProviderKey) =>
  `${apiUrl()}/auth/${provider}/callback`;

export const isConfigured = (provider: ProviderKey) =>
  Boolean(config[provider].clientId() && config[provider].clientSecret());

/** Short-lived signed state, so the callback can't be replayed or forged. */
const stateSecret = () => process.env.JWT_SECRET ?? "dev-secret";

const makeState = (next: string) => {
  const payload = Buffer.from(
    JSON.stringify({ next, ts: Date.now() })
  ).toString("base64url");
  const sig = crypto
    .createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
};

const readState = (state: string): { next: string } | null => {
  const [payload, sig] = state.split(".");
  if (!payload || !sig) return null;
  const expected = crypto
    .createHmac("sha256", stateSecret())
    .update(payload)
    .digest("base64url");
  if (sig !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString());
    if (Date.now() - data.ts > 10 * 60 * 1000) return null; // 10 min
    return { next: typeof data.next === "string" ? data.next : "/" };
  } catch {
    return null;
  }
};

const fetchProfile = async (
  provider: ProviderKey,
  accessToken: string
): Promise<Profile> => {
  const res = await fetch(config[provider].profileUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("Could not read your profile from the provider.");
  const data = (await res.json()) as {
    email?: string;
    name?: string;
    picture?: string | { data?: { url?: string } };
  };
  if (!data.email)
    throw new Error(
      "Your account did not share an email address, which we need to create your Tredella account."
    );
  const avatar =
    typeof data.picture === "string" ? data.picture : data.picture?.data?.url;
  return { email: data.email, name: data.name ?? data.email, avatar };
};

const upsertUser = async (profile: Profile) => {
  const email = profile.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // keep the avatar fresh, but never touch an existing password
    if (profile.avatar && existing.avatar !== profile.avatar) {
      return prisma.user.update({
        where: { id: existing.id },
        data: { avatar: profile.avatar },
      });
    }
    return existing;
  }
  // Social accounts have no local password; a random one keeps the column
  // non-null while remaining unusable for password login.
  return prisma.user.create({
    data: {
      email,
      name: profile.name,
      avatar: profile.avatar ?? null,
      password: crypto.randomBytes(32).toString("hex"),
      role: "BUYER",
    },
  });
};

export const registerSocialAuthRoutes = (app: Express) => {
  app.get("/auth/providers", (_req, res) => {
    res.json({
      google: isConfigured("google"),
      facebook: isConfigured("facebook"),
    });
  });

  app.get("/auth/:provider", (req: Request, res: Response) => {
    const provider = req.params.provider as ProviderKey;
    if (!config[provider]) return res.status(404).send("Unknown provider.");
    if (!isConfigured(provider))
      return res.redirect(
        `${appUrl()}/login?error=${encodeURIComponent(`${provider} sign-in is not configured yet.`)}`
      );

    const next = typeof req.query.next === "string" ? req.query.next : "/";
    const params = new URLSearchParams({
      client_id: config[provider].clientId()!,
      redirect_uri: redirectUri(provider),
      response_type: "code",
      scope: config[provider].scope,
      state: makeState(next),
    });
    res.redirect(`${config[provider].authUrl}?${params}`);
  });

  app.get("/auth/:provider/callback", async (req: Request, res: Response) => {
    const provider = req.params.provider as ProviderKey;
    const fail = (message: string) =>
      res.redirect(`${appUrl()}/login?error=${encodeURIComponent(message)}`);

    if (!config[provider]) return res.status(404).send("Unknown provider.");

    const { code, state } = req.query as { code?: string; state?: string };
    if (!code || !state) return fail("Sign-in was cancelled.");

    const parsed = readState(state);
    if (!parsed) return fail("Your sign-in link expired. Please try again.");

    try {
      const body = new URLSearchParams({
        client_id: config[provider].clientId()!,
        client_secret: config[provider].clientSecret()!,
        redirect_uri: redirectUri(provider),
        grant_type: "authorization_code",
        code,
      });
      const tokenRes = await fetch(config[provider].tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });
      if (!tokenRes.ok) throw new Error("Token exchange failed.");
      const { access_token } = (await tokenRes.json()) as {
        access_token?: string;
      };
      if (!access_token) throw new Error("No access token returned.");

      const profile = await fetchProfile(provider, access_token);
      const user = await upsertUser(profile);
      const token = signToken({ userId: user.id, role: user.role as "BUYER" });

      const params = new URLSearchParams({
        token,
        next: parsed.next,
        user: JSON.stringify({
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        }),
      });
      res.redirect(`${appUrl()}/auth/callback?${params}`);
    } catch (error) {
      console.error(`[auth:${provider}]`, error);
      fail(
        error instanceof Error
          ? error.message
          : "Sign-in failed. Please try again."
      );
    }
  });
};
