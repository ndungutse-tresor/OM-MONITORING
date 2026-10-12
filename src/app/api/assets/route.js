import { readJson, writeJson } from "@/lib/paths";
import { isAuthed, unauthorized } from "@/lib/auth";

export const dynamic = "force-dynamic";
const FILE = "assets_registry.json";
const TYPES = ["Router", "Switch", "Server", "Firewall", "Website", "Application"];

function clean(a) {
  const out = {
    id: a.id,
    name: String(a.name || "").trim(),
    type: TYPES.includes(a.type) ? a.type : "Server",
    environment: String(a.environment || "Prod"),
  };
  if (a.type === "Website" || a.type === "Application") out.url = String(a.url || "").trim();
  else out.ip = String(a.ip || "").trim();
  return out;
}

export async function GET(request) {
  if (!isAuthed(request)) return unauthorized();
  return Response.json(readJson(FILE, []));
}

export async function POST(request) {
  if (!isAuthed(request)) return unauthorized();
  const body = await request.json();
  const asset = clean({ ...body, id: `asset-${Date.now()}` });
  if (!asset.name || !(asset.ip || asset.url)) return Response.json({ error: "Name and IP/URL are required" }, { status: 400 });
  writeJson(FILE, [...readJson(FILE, []), asset]);
  return Response.json(asset, { status: 201 });
}

export async function PUT(request) {
  if (!isAuthed(request)) return unauthorized();
  const body = await request.json();
  const list = readJson(FILE, []).map((a) => (a.id === body.id ? clean(body) : a));
  writeJson(FILE, list);
  return Response.json({ ok: true });
}

export async function DELETE(request) {
  if (!isAuthed(request)) return unauthorized();
  const id = new URL(request.url).searchParams.get("id");
  writeJson(FILE, readJson(FILE, []).filter((a) => a.id !== id));
  return Response.json({ ok: true });
}
