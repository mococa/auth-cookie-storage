import jwt from "jwt-decode";
import cookie, { CookieSerializeOptions } from "cookie";
import { add, isAfter } from "date-fns";

export interface AuthCookieStorageProps {
  /**
   * Cookie prefix for better spotting.
   *
   * Such as the App name
   *
   *
   * Example: youtube
   */
  prefix: string;

  /**
   * Cookie string to get the tokens
   * already serialized by default
   */
  cookie_string?: string;
}

export interface SetTokenProps {
  /**
   * ID Token
   *
   * Where it's stored basic information for the authenticated user
   */
  id_token: string;

  /**
   * Access token
   *
   * Where it's stored basic authenticator factors about the user
   */
  access_token: string;

  /**
   * Refresh token
   */
  refresh_token: string;

  /**
   * Whether the cookies will persist or not after closing the browser
   */
  persist?: boolean;
}

const DAY = 60 * 60 * 24;

export interface CognitoDefaultProps {
  sub: string;
  email_verified: boolean;
  iss: string;
  aud: string;
  event_id: string;
  token_use: string;
  auth_time: number;
  exp: number;
  iat: number;
  email: string;
  origin_jti: string;
  "cognito:username": string;
}

export class AuthCookieStorage<T extends Partial<CognitoDefaultProps>> {
  prefix: string;

  id_token: string;
  access_token: string;
  refresh_token: string;
  persist: boolean;

  user: T;

  cookie_string?: string;

  constructor({ prefix, cookie_string }: AuthCookieStorageProps) {
    this.prefix = prefix;

    if (!cookie_string) return;

    this.cookie_string = cookie_string;

    this.getTokens(cookie_string);

    return this;
  }

  clearTokens() {
    if (typeof window === "undefined") {
      console.error("Trying to remove cookie in a server-side environment");
      return;
    }

    const cookies_to_delete = {
      access_token: `${this.prefix}:access_token`,
      id_token: `${this.prefix}:id_token`,
      refresh_token: `${this.prefix}:refresh_token`,
      keep: `${this.prefix}:keep`,
    };

    Object.values(cookies_to_delete).forEach((cookie_name) => {
      const updated_cookie = cookie.serialize(cookie_name, "", {
        expires: new Date(),
        path: "/",
      });

      document.cookie = updated_cookie;
    });

    return this;
  }

  getTokens(cookie_string = this.cookie_string) {
    if (!cookie_string && !this.cookie_string) return this;

    this.cookie_string = cookie_string;

    const cookies = cookie.parse(this.cookie_string || "", {});

    const {
      [`${this.prefix}:id_token`]: id_token,
      [`${this.prefix}:refresh_token`]: refresh_token,
      [`${this.prefix}:access_token`]: access_token,
      [`${this.prefix}:keep`]: keep,
    } = cookies;

    this.access_token = access_token;
    this.id_token = id_token;
    this.refresh_token = refresh_token;
    this.persist = Boolean(keep);

    return this;
  }

  setTokens({ access_token, id_token, refresh_token, persist }: SetTokenProps) {
    const client_side = typeof window !== "undefined";

    if (!client_side)
      throw new Error("Trying to set cookie in a server-side environment");

    const cookies_options: CookieSerializeOptions = {
      expires: persist ? add(new Date(), { years: 1 }) : undefined,
      maxAge: persist ? 365 * DAY : undefined,
    };

    const cookies: Record<string, string> = {
      id_token: cookie.serialize(
        `${this.prefix}:id_token`,
        id_token,
        cookies_options
      ),

      access_token: cookie.serialize(
        `${this.prefix}:access_token`,
        access_token,
        cookies_options
      ),

      refresh_token: cookie.serialize(
        `${this.prefix}:refresh_token`,
        refresh_token,
        cookies_options
      ),
    };

    if (persist)
      cookies.keep = cookie.serialize(
        `${this.prefix}:keep`,
        "true",
        cookies_options
      );

    this.access_token = access_token;
    this.id_token = id_token;
    this.refresh_token = refresh_token;
    this.persist = Boolean(persist);

    Object.values(cookies).forEach((polytag_cookie) => {
      document.cookie = polytag_cookie;
    });

    return this;
  }

  decode() {
    try {
      this.user = jwt<T>(this.id_token);
    } catch (error) {
      this.user = {} as T;
    }

    return this;
  }

  isExpired() {
    const { exp } = this.decode().user;
    if (!exp) return false;

    const expired = isAfter(new Date(), new Date(exp * 1000));

    return expired;
  }
}
