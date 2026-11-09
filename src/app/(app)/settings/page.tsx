import { ConfirmButton } from "@/components/ConfirmButton";
import Link from "next/link";
import { PushToggle } from "@/components/PushToggle";
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
import { BackupPanel } from "@/components/BackupPanel";
import { PriceListForm } from "@/components/PriceListForm";
import { cleanPriceOptions } from "@/lib/prices";
import { listBackups } from "@/lib/backup";
import { aiBudget, aiKey } from "@/lib/aiCall";
import { usd } from "@/lib/aiCost";
import { AiPicturesSwitch } from "@/components/AiSettings";
import { SoundFeel } from "@/components/SoundFeel";

const FEATURE_NAMES: Record<string, string> = {
  lesson_summary: "Lesson summaries",
  parent_message: "Parent messages",
  monthly_report: "Monthly reports",
  worksheet: "Worksheets",
};

export default async function SettingsPage() {
  const me = await requireTutor();
  const [settings, calendars, backups, ai] = await Promise.all([getSettings(), listCalendarSources(), listBackups().catch(() => []), aiBudget()]);
  const supabase = await createClient();
  const { data: people } = await supabase.from("app_users").select("email, role, display_name").in("role", ["tutor", "viewer"]).order("role");
  const { count: hidden } = await supabase.from("lessons").select("id", { count: "exact", head: true }).eq("ignored", true);

  return (
    <div className="flex flex-col gap-[22px]">
      <header className="px-1.5 pt-1">
        <h1 className="font-display text-[36px] font-semibold leading-tight sm:text-[44px]">Settings</h1>
      </header>

      {/* Two columns of cards on a laptop; one column on a phone */}
      <div className="space-y-5 lg:block lg:columns-2 lg:gap-5 lg:space-y-0 [&>section]:break-inside-avoid lg:[&>section]:mb-5">
      <SoundFeel />

      <section id="notifications" className="glass rounded-[26px] p-5 sm:p-6 space-y-3">
        <div>
          <h2 className="font-display text-[22px] font-semibold">🔔 Phone notifications</h2>
          <p className="text-sm text-muted">A pop-up when a family opens their page or sends you a message. Turn it on on each device you want it on (on iPhone: open TutoringHub from the home-screen icon first).</p>
        </div>
        <PushToggle />
      </section>


      <section id="calendar" className="glass rounded-[26px] p-5 sm:p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="font-display text-[22px] font-semibold">Google Calendar</h2>
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
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
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
                    <ConfirmButton className="min-h-10 px-2 text-xs text-muted underline" message="Remove this calendar? Lessons from it will stop syncing.">
                      Remove
                    </ConfirmButton>
                  </form>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        <details className="glass rounded-2xl p-4 text-sm" open={!settings.calendar_connected}>
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

      <section className="glass rounded-[26px] p-5 sm:p-6 space-y-4">
        <h2 className="font-display text-[22px] font-semibold">Who can sign in</h2>
        <ul className="space-y-2">
          {(people ?? []).map((p) => (
            <li key={p.email} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
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
                  <ConfirmButton className="min-h-10 px-2 text-xs text-muted underline" message={`Remove ${p.email}? They won't be able to sign in any more.`}>
                    Remove
                  </ConfirmButton>
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

      <section id="ai" className="glass rounded-[26px] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-display text-[22px] font-semibold">AI (Claude)</h2>
          <p className="text-sm text-muted">
            Writes parent messages, lesson summaries and worksheets. Names never go to the AI: they&apos;re swapped for placeholders and put back afterwards.
          </p>
        </div>
        {!aiKey() ? (
          <p className="rounded-xl bg-[var(--warn-soft)] p-3 text-sm text-warn">
            Off. To turn it on, add your Anthropic key in Vercel: Project → Settings → Environment Variables → <b>ANTHROPIC_API_KEY</b>, then redeploy.
          </p>
        ) : null}
        {ai.metered ? (
          <div className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="font-medium">
                This month: {usd(ai.spent)} <span className="text-muted">of {usd(ai.limit)}</span>
              </p>
              <p className="text-sm text-muted">Starts again {ai.resetsOn}</p>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-valuemin={0} aria-valuemax={ai.limit} aria-valuenow={Math.round(ai.spent * 100) / 100}>
              <div className={`h-full rounded-full ${ai.ok ? "bg-accent" : "bg-danger"}`} style={{ width: `${Math.min(100, (ai.spent / ai.limit) * 100)}%` }} />
            </div>
            {Object.keys(ai.byFeature).length ? (
              <ul className="text-sm text-muted">
                {Object.entries(ai.byFeature).map(([f, v]) => (
                  <li key={f}>
                    {FEATURE_NAMES[f] ?? f}: {v.uses} · {usd(v.cost)}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-xs text-muted">
              At {usd(ai.limit)} the AI rests until the credit renews, and the ChatGPT buttons still work. (The Claude Console limit is your safety net on top.)
            </p>
          </div>
        ) : (
          <p className="rounded-xl bg-[var(--warn-soft)] p-3 text-sm text-warn">Run database update 0020 to turn on the AI meter.</p>
        )}
        <AiPicturesSwitch initial={settings.ai_pictures === true} ready={settings.ai_pictures !== undefined} />
      </section>

      <section className="glass rounded-[26px] p-5 sm:p-6 space-y-4">
        <h2 className="font-display text-[22px] font-semibold">Parent feedback and hours</h2>
        <FeedbackSettingsForm
          tone={settings.tone}
          allowEmoji={settings.allow_emoji}
          template={settings.prompt_template}
          lowHours={Number(settings.low_hours_threshold)}
          renewWeeks={Number(settings.renew_weeks ?? 2)}
          autoDone={Boolean(settings.auto_done)}
          promptpayId={settings.promptpay_id ?? null}
          trackFrom={settings.track_from}
        />
      </section>

      <section id="prices" className="glass rounded-[26px] p-5 sm:p-6 space-y-4">
        <div>
          <h2 className="font-display text-[22px] font-semibold">Price list</h2>
          <p className="text-sm text-muted">The packages you offer. Renewal messages and PromptPay QR codes use these prices.</p>
        </div>
        {settings.price_options === undefined ? (
          <p className="rounded-xl bg-warn-soft p-3 text-sm text-warn">Run database update 0015 to save a price list.</p>
        ) : null}
        <PriceListForm initial={cleanPriceOptions(settings.price_options)} />
      </section>

      <section id="backup" className="glass rounded-[26px] p-5 sm:p-6 space-y-4">
        <h2 className="font-display text-[22px] font-semibold">Backups and export</h2>
        <BackupPanel files={backups} ready={settings.last_backup_at !== undefined} />
      </section>

      <section className="glass rounded-[26px] p-5 sm:p-6 space-y-2 text-sm">
        <h2 className="font-display text-[22px] font-semibold">Privacy</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted">
          <li>Students are saved by first name or nickname only — no surnames.</li>
          <li>Saved: lesson times from your calendar, your lesson notes, parent names and contacts, packages and payments, and files you upload.</li>
          <li>Family members can only see lesson times, first names, onsite/online and place. The database itself blocks everything else.</li>
          <li>Worksheets and photos are kept in private storage and open with links that expire after 10 minutes.</li>
          <li>The ChatGPT prompt uses first names only, and no contacts or school names. Ask parents before sharing photos of work with any AI.</li>
          <li>Built-in AI (Claude): no names at all — students, parents and family are swapped for placeholders like {"{child1}"} before anything is sent. Pictures of work are only sent if you switch that on above.</li>
          <li>Your calendar links are stored on the server only and never sent to the browser.</li>
        </ul>
      </section>

      </div>

      <div className="pb-6 lg:max-w-sm">
        <p className="mb-2 text-sm text-muted">Signed in as {me.email}</p>
        <SignOutButton className="btn-secondary w-full" />
      </div>
    </div>
  );
}
