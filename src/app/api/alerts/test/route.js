import { isAuthed, unauthorized } from "@/lib/auth";
import { sendMail } from "@/lib/alerts";

export async function POST(request) {
  if (!isAuthed(request)) return unauthorized();
  try {
    await sendMail({
      subject: "[Old Mutual Monitor] Test email",
      text: "This is a test alert from the Old Mutual infrastructure monitor. Email delivery works.",
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 500 });
  }
}
