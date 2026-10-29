import Link from "next/link";
import { requireTutor } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/data";
import { fmtDate, fmtTime } from "@/lib/time";
import { AddPersonForm, CalendarForm, FeedbackSettingsForm } from "@/components/SettingsForms";
import { RefreshButton } from "@/components/RefreshButton";
import { SignOutButton } from "@/components/SignOutButton";
import { removeCalendar, setCalendarPreply } from "@/app/actions/calendar";
import { listCalendarSources } from "@/lib/calendar/sync";
import { removePerson } from "@/app/actions/settings";

export default async function SettingsPage() {
  const me = await requireTutor();
  const [settings, calendars] = await Promise.all([getSettings(), listCalendarSources()]);
  const supabase = await createClient();
  const { data: people } = await supabase.from("app_users").select("email, role, display_name").in("role", ["tutor", "viewer"]).order("role");
  const { count: hidden } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("ignored", true);

  return (
    <div className="space-y-8">
      <h1 className="h1">Settings</h1>

      <section id="calendar" className="card space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="h2">Google Calendar</h2>
            <p className="text-sm text-muted">
              {settings.calendar_connected
                ? settings.last_synced_at
                  ? `Connected · last read ${fmtDate(settings.last_synced_at)} ${fmtTime(settings.last_synced_at)}`
                  : "Connected"
                : "Not connected yet"}
            </p>
          </div>
          {settings.calendar_connected ? <RefreshButton /> : null}
        </div>
        {settings.last_sync_error ? <p className="rounded-xl bg-danger-soft p-3 text-sm text-danger">{settings.last_sync_error}</p> : null}

        {calendars.length ? (
          <ul className="space-y-2">
            {calendars.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-surface-2 p-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{c.label}</span>
                  {c.is_preply ? <span className="chip-accent">All Preply</span> : null}
                </div>
                <div className="flex items-center gap-3">
                  <form action={setCalendarPreply}>
                    <input type="hidden" name="id" value={c.id} />
                    <input type="hidden" name="is_preply" value={c.is_preply ? "false" : "true"} />
                    <button className="text-xs text-muted underline">{c.is_preply ? "Not Preply" : "Mark as Preply"}</button>
                  </form>
                  <form action={removeCalendar}>
                    <input type="hidden" name="id" value={c.id} />
                    <button className="text-xs text-muted underline">Remove</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <details className="rounded-xl bg-surface-2 p-3 text-sm" open={!settings.calendar_connected}>
          <summary className="cursor-pointer font-medium">How to find your calendar link (on a computer)</summary>
          <ol className="mt-2 list-decimal space-y-1 pl-5">
            <li>
              Open <strong>calendar.google.com</strong> on your Mac.
            </li>
            <li>On the left, under “My calendars”, point at the calendar with your lessons and click the three dots ⋮.</li>
            <li>
              Click <strong>Settings and sharing</strong>.
            </li>
            <li>
              Scroll down to <strong>Integrate calendar</strong>.
            </li>
            <li>
              Find <strong>Secret address in iCal format</strong>, click the copy button next to it.
            </li>
            <li>Paste it below and press Connect.</li>
          </ol>
          <p className="mt-2">
            <strong>Preply lessons:</strong> if Preply puts lessons into their own calendar under “My calendars”, add that calendar too and tick
            “Every lesson in this calendar is a Preply lesson”. If the Preply calendar is under “Other calendars” (subscribed), Google has no secret
            address for it — copy the calendar link from Preply instead (Preply → Settings → Calendar) and paste that.
          </p>
          <p className="mt-2 text-muted">
            Keep this link private — anyone with it can see that calendar. TutoringHub stores it on the server only and never shows it again. Lessons
            from 2 weeks ago to 6 weeks ahead are read, and updated every time the app opens (or when you press Refresh).
          </p>
        </details>
        {calendars.length ? <h3 className="pt-2 font-medium">Add another calendar (e.g. Preply)</h3> : null}
        <CalendarForm first={calendars.length === 0} />
        {hidden ? <p className="text-xs text-muted">{hidden} calendar events are hidden as “not a lesson”.</p> : null}
      </section>

      <section className="card space-y-4">
        <h2 className="h2">Who can sign in</h2>
        <ul className="space-y-2">
          {(people ?? []).map((p) => (
            <li key={p.email} className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 p-3">
              <div className="min-w-0">
                <div className="truncate font-medium">{p.display_name || p.email}</div>
                <div className="truncate text-sm text-muted">
                  {p.display_name ? `${p.email} · ` : ""}
                  {p.role === "tutor" ? "Tutor — full access" : "Family — schedule only"}
                  {p.email === me.email ? " · you" : ""}
                </div>
              </div>
              {p.email !== me.email ? (
                <form action={removePerson}>
                  <input type="hidden" name="email" value={p.email} />
                  <button className="text-xs text-muted underline">Remove</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
        <AddPersonForm />
        <Link href="/schedule" className="btn-quiet px-0 text-sm">
          See exactly what family members see ›
        </Link>
      </section>

      <section className="card space-y-4">
        <h2 className="h2">Parent feedback and hours</h2>
        <FeedbackSettingsForm
          tone={settings.tone}
          allowEmoji={settings.allow_emoji}
          template={settings.prompt_template}
          lowHours={Number(settings.low_hours_threshold)}
        />
      </section>

      <section className="card space-y-2 text-sm">
        <h2 className="h2">Privacy</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Students are saved by first name or nickname only — no surnames.</li>
          <li>Saved: lesson times from your calendar, your lesson notes, parent names and contacts, packages and payments, and files you upload.</li>
          <li>Family members can only see lesson times, first names, onsite/online and place. The database itself blocks everything else.</li>
          <li>Worksheets and photos are kept in private storage and open with links that expire after 10 minutes.</li>
          <li>The ChatGPT prompt uses first names only, and no contacts or school names. Ask parents before sharing photos of work with any AI.</li>
          <li>Your calendar links are stored on the server only and never sent to the browser.</li>
        </ul>
      </section>

      <div className="pb-6">
        <p className="mb-2 text-sm text-muted">Signed in as {me.email}</p>
        <SignOutButton className="btn-secondary w-full" />
      </div>
    </div>
  );
}
