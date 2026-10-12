import { isAuthed, unauthorized } from "@/lib/auth";
import { getHistory } from "@/lib/alerts";

export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!isAuthed(request)) return unauthorized();
  return Response.json(getHistory().slice(0, 20));
}
