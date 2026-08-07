// Supabase Edge Function: generate-schedule
// Reads every member's weekly busy-slot routine + past task history for a room,
// asks Groq (Llama) to build a fair 7-day chore rotation around everyone's free
// time, then writes the result to task_assignments and updates task_history_summary.
//
// Deploy: supabase functions deploy generate-schedule
// Secret:  supabase secrets set GROQ_API_KEY=...

import { createClient } from "jsr:@supabase/supabase-js@2";

const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const DAY_ORDER = ["sat", "sun", "mon", "tue", "wed", "thu", "fri"] as const;

function nextDates(): Record<(typeof DAY_ORDER)[number], string> {
  const today = new Date();
  const jsDay = today.getDay(); // 0=Sun..6=Sat
  const orderIndexOfToday = DAY_ORDER.indexOf(
    (["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const)[jsDay]
  );
  const result = {} as Record<(typeof DAY_ORDER)[number], string>;
  DAY_ORDER.forEach((day, i) => {
    const offset = (i - orderIndexOfToday + 7) % 7;
    const d = new Date(today);
    d.setDate(today.getDate() + offset);
    result[day] = d.toISOString().slice(0, 10);
  });
  return result;
}

Deno.serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), { status: 401 });
    }

    const { room_id } = await req.json();
    if (!room_id) {
      return new Response(JSON.stringify({ error: "room_id is required" }), { status: 400 });
    }

    // Client bound to the caller's JWT, used only to verify identity + leader role.
    const callerClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
    } = await callerClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: callerMembership } = await admin
      .from("room_members")
      .select("role")
      .eq("room_id", room_id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (!callerMembership || callerMembership.role !== "leader") {
      return new Response(JSON.stringify({ error: "Only the room leader can generate the schedule" }), {
        status: 403,
      });
    }

    const { data: members } = await admin
      .from("room_members")
      .select("user_id, profiles(full_name, person_type)")
      .eq("room_id", room_id);

    const memberIds = (members ?? []).map((m: any) => m.user_id);

    const { data: routineSlots } = await admin
      .from("routine_slots")
      .select("user_id, day, start_time, end_time, label")
      .in("user_id", memberIds);

    const { data: history } = await admin
      .from("task_history_summary")
      .select("user_id, task_type, times_assigned")
      .eq("room_id", room_id);

    const peopleSummary = (members ?? [])
      .map((m: any) => {
        const busy = (routineSlots ?? [])
          .filter((s: any) => s.user_id === m.user_id)
          .map((s: any) => `${s.day} ${s.start_time.slice(0, 5)}-${s.end_time.slice(0, 5)} (${s.label})`)
          .join("; ");
        const hist = (history ?? [])
          .filter((h: any) => h.user_id === m.user_id)
          .map((h: any) => `${h.task_type}:${h.times_assigned}`)
          .join(", ");
        return `- ${m.profiles.full_name} (id: ${m.user_id}, ${m.profiles.person_type}): busy=[${busy || "none"}] history=[${hist || "none"}]`;
      })
      .join("\n");

    const prompt = `You are scheduling household chores for a bachelor mess (shared room) for the next 7 days, starting Saturday.

Members and their weekly busy schedule (class/work hours) plus how many times they've done each chore type before:
${peopleSummary}

Chore types to rotate fairly across free people: "Grocery run", "Cook dinner", "Clean kitchen", "Clean common room", "Dishes".

Rules:
- Only assign a chore to someone during a time they are NOT busy that day.
- Spread chores fairly — prefer people with fewer past times_assigned for that chore type.
- Not everyone needs a chore every day; 1-2 chores per day total is enough.
- Skip a person entirely on days they have no free time.

Respond with ONLY a JSON array, no prose, no markdown fences, in this exact shape:
[{"day":"sat","user_id":"<uuid>","task_title":"Grocery run","time_slot":"After 6:00 PM"}]

Valid day values: sat, sun, mon, tue, wed, thu, fri.`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!groqRes.ok) {
      const text = await groqRes.text();
      return new Response(JSON.stringify({ error: `Groq API error: ${text}` }), { status: 502 });
    }

    const groqJson = await groqRes.json();
    const rawText = groqJson.choices?.[0]?.message?.content ?? "[]";
    const jsonMatch = rawText.match(/\[[\s\S]*\]/);
    const assignments: { day: string; user_id: string; task_title: string; time_slot?: string }[] = JSON.parse(
      jsonMatch ? jsonMatch[0] : rawText
    );

    const dates = nextDates();

    await admin.from("task_assignments").delete().eq("room_id", room_id).eq("status", "pending").eq("source", "ai");

    const rows = assignments
      .filter((a) => memberIds.includes(a.user_id) && dates[a.day as keyof typeof dates])
      .map((a) => ({
        room_id,
        assigned_to: a.user_id,
        day: a.day,
        date: dates[a.day as keyof typeof dates],
        task_title: a.task_title,
        time_slot: a.time_slot ?? null,
        source: "ai" as const,
        status: "pending" as const,
      }));

    if (rows.length > 0) {
      await admin.from("task_assignments").insert(rows);

      for (const row of rows) {
        const { data: existing } = await admin
          .from("task_history_summary")
          .select("times_assigned")
          .eq("room_id", room_id)
          .eq("user_id", row.assigned_to)
          .eq("task_type", row.task_title)
          .maybeSingle();

        await admin.from("task_history_summary").upsert({
          room_id,
          user_id: row.assigned_to,
          task_type: row.task_title,
          times_assigned: (existing?.times_assigned ?? 0) + 1,
          last_assigned_on: row.date,
        });
      }
    }

    return new Response(JSON.stringify({ inserted: rows.length }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
