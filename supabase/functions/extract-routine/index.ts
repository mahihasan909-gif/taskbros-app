// Supabase Edge Function: extract-routine
// Takes a routine photo already uploaded to the `routine-photos` storage bucket,
// asks Gemini (vision) to read the weekly class/work schedule out of it, and
// writes the result as routine_slots rows for the calling user.
//
// Deploy: supabase functions deploy extract-routine
// Secret:  supabase secrets set GEMINI_API_KEY=...

import { createClient } from "jsr:@supabase/supabase-js@2";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Spreading a large Uint8Array into String.fromCharCode(...) blows the call
// stack for real photo files, so convert in small chunks instead.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = "";
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
    }

    const { photo_path } = await req.json();
    if (!photo_path) {
      return new Response(JSON.stringify({ error: "photo_path is required" }), { status: 400 });
    }

    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
    }

    if (!photo_path.startsWith(`${user.id}/`)) {
      return new Response(JSON.stringify({ error: "Not your photo" }), { status: 403 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    await admin.from("profiles").update({ routine_scan_status: "processing" }).eq("id", user.id);

    const { data: fileData, error: downloadError } = await admin.storage
      .from("routine-photos")
      .download(photo_path);

    if (downloadError || !fileData) {
      await admin.from("profiles").update({ routine_scan_status: "failed" }).eq("id", user.id);
      return new Response(JSON.stringify({ error: "Could not read uploaded photo" }), { status: 500 });
    }

    const arrayBuffer = await fileData.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    const mediaType = fileData.type || "image/jpeg";

    const prompt = `This image is a weekly class or work routine/timetable. Read it carefully and extract every busy time block per day.

Respond with ONLY a JSON array, no prose, no markdown fences, in this exact shape:
[{"day":"sat","start_time":"08:00","end_time":"13:00","label":"Class"}]

Rules:
- Valid day values: sat, sun, mon, tue, wed, thu, fri.
- Use 24-hour HH:MM time.
- label should be a short description (e.g. "Class", "Office", "Lab", subject name if visible).
- If a day has no entries in the image, omit it.
- If the image is unreadable or not a routine, return an empty array [].`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { inline_data: { mime_type: mediaType, data: base64 } },
                { text: prompt },
              ],
            },
          ],
        }),
      }
    );

    if (!geminiRes.ok) {
      const text = await geminiRes.text();
      await admin.from("profiles").update({ routine_scan_status: "failed" }).eq("id", user.id);
      return new Response(JSON.stringify({ error: `Gemini API error: ${text}` }), { status: 502 });
    }

    const geminiJson = await geminiRes.json();
    const rawText = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? "[]";
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    const slots: { day: string; start_time: string; end_time: string; label: string }[] = JSON.parse(
      jsonMatch ? jsonMatch[0] : rawText
    );

    const validDays = new Set(["sat", "sun", "mon", "tue", "wed", "thu", "fri"]);
    const rows = slots
      .filter((s) => validDays.has(s.day) && s.start_time && s.end_time)
      .map((s) => ({
        user_id: user.id,
        day: s.day,
        start_time: `${s.start_time}:00`,
        end_time: `${s.end_time}:00`,
        label: s.label || "Busy",
        is_busy: true,
      }));

    await admin.from("routine_slots").delete().eq("user_id", user.id);
    if (rows.length > 0) {
      await admin.from("routine_slots").insert(rows);
    }

    await admin.from("profiles").update({ routine_scan_status: "done" }).eq("id", user.id);

    return new Response(JSON.stringify({ inserted: rows.length }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
