import "server-only";

export interface SessionCookieConfig {
  name: string;
  secure: boolean;
}

/**
 * Cookie settings for the app's base URL. Over https the cookie is Secure and
 * uses the __Host- prefix, which browsers only accept when it is Secure,
 * host-only and path=/, so a subdomain can't plant or override it. Plain
 * http (local dev, e2e) can't carry either, so both are dropped there.
 */
export function sessionCookieConfig(appUrl: string): SessionCookieConfig {
  const secure = new URL(appUrl).protocol === "https:";
  return { name: secure ? "__Host-hearth_session" : "hearth_session", secure };
}
