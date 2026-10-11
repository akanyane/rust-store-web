import { deleteCookie, getCookies, setCookie } from "@std/http";
import type { Tokens } from "./types.ts";

export const SESSION_COOKIE = "rs_session";
export const REFRESH_COOKIE = "rs_refresh";
export const FLASH_COOKIE = "rs_flash";

/** A sessão dura 1 hora e o refresh token 15 dias (iguais aos da API). */
export const SESSION_MAX_AGE = 60 * 60;
export const REFRESH_MAX_AGE = 15 * 24 * 60 * 60;
const FLASH_MAX_AGE = 60;

export interface SessionCookies {
  session?: string;
  refresh?: string;
}

export function readSessionCookies(headers: Headers): SessionCookies {
  const cookies = getCookies(headers);
  return {
    session: cookies[SESSION_COOKIE] || undefined,
    refresh: cookies[REFRESH_COOKIE] || undefined,
  };
}

export function readCookie(headers: Headers, name: string): string | undefined {
  return getCookies(headers)[name] || undefined;
}

/** `httpOnly` e `SameSite=Lax` sempre; `Secure` quando o acesso é por HTTPS. */
function options(name: string, maxAge: number, secure: boolean) {
  return {
    name,
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    secure,
    maxAge,
  };
}

export function writeSessionCookies(
  headers: Headers,
  tokens: Tokens,
  secure: boolean,
): void {
  setCookie(headers, {
    ...options(SESSION_COOKIE, SESSION_MAX_AGE, secure),
    value: tokens.session_token,
  });
  setCookie(headers, {
    ...options(REFRESH_COOKIE, REFRESH_MAX_AGE, secure),
    value: tokens.refresh_token,
  });
}

export function clearSessionCookies(headers: Headers): void {
  deleteCookie(headers, SESSION_COOKIE, { path: "/" });
  deleteCookie(headers, REFRESH_COOKIE, { path: "/" });
}

export function writeFlashCookie(
  headers: Headers,
  value: string,
  secure: boolean,
): void {
  setCookie(headers, {
    ...options(FLASH_COOKIE, FLASH_MAX_AGE, secure),
    value,
  });
}

export function clearFlashCookie(headers: Headers): void {
  deleteCookie(headers, FLASH_COOKIE, { path: "/" });
}
