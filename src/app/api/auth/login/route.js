import { COOKIE, sign } from "@/lib/auth";

export async function POST(request) {
  const { username, password } = await request.json();
  const u = process.env.ADMIN_USER || "admin";
  const p = process.env.ADMIN_PASS || "admin123";
  if (username !== u || password !== p) {
    return Response.json({ error: "Wrong username or password" }, { status: 401 });
  }
  const res = Response.json({ ok: true });
  res.headers.append(
    "Set-Cookie",
    `${COOKIE}=${sign(username)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 12}`
  );
  return res;
}
