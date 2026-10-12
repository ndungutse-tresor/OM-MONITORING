import crypto from "crypto";

const secret = () => process.env.AUTH_SECRET || "dev-secret-change-me";
export const COOKIE = "om_session";

export function sign(user) {
  return `${user}.${crypto.createHmac("sha256", secret()).update(user).digest("hex")}`;
}

export function isAuthed(request) {
  const raw = request.cookies.get(COOKIE)?.value;
  if (!raw) return false;
  const i = raw.lastIndexOf(".");
  if (i < 1) return false;
  const expected = sign(raw.slice(0, i));
  const a = Buffer.from(raw);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function unauthorized() {
  return Response.json({ error: "Not signed in" }, { status: 401 });
}
