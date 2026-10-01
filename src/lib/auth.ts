import { createHmac, timingSafeEqual } from "node:crypto";
import { NextRequest } from "next/server";

const cookieName = "one_admin_session";
const password = process.env.ADMIN_PASSWORD;
export function adminConfigured() { return !!password; }
export function sessionToken() { return createHmac("sha256", password || "").update("ONE. Adserver admin session v1").digest("hex"); }
export function validPassword(value: string) {
  if (!password) return false;
  const a=Buffer.from(value);const b=Buffer.from(password);
  return a.length===b.length && timingSafeEqual(a,b);
}
export function isAdmin(request: NextRequest) {
  if (!password && process.env.NODE_ENV === "development") return true;
  if (!password) return false;
  const actual=request.cookies.get(cookieName)?.value || "";
  const expected=sessionToken();
  return actual.length===expected.length && timingSafeEqual(Buffer.from(actual),Buffer.from(expected));
}
export {cookieName};
