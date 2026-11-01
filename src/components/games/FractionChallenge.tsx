"use client";
import { useEffect, useState } from "react";
import { CHALLENGE_LEVELS, challengeHint, challengeQ, type ChallengeLevel, type ChallengeQ } from "@/lib/fractions";
import { FracText } from "./FractionShapes";
import { NumberPad } from "./NumberPad";
import { useBest } from "./useBest";

// 🏆 Fraction Challenge (older children): fractions of amounts, adding and taking away fractions with the
// same bottom number, and equivalent fractions. Answers go in on the big number pad. 10 questions.

const COUNT = 10;
const secs = (tenths: number) => `${(tenths / 10).toFixed(1)}s`;

/** "Share 12 into 3 groups": the groups drawn as dots, shown after a wrong answer to a "1/3 of 12" question. */
function Groups({ q }: { q: Extract<ChallengeQ, { kind: "of" }> }) {
  const each = q.whole / q.f.d;
  if (q.whole > 40) return null;
  return (
    <div className="flex flex-wrap justify-center gap-2" aria-hidden>
      {Array.from({ length: q.f.d }, (_, g) => (
        <div key={g} className={`flex max-w-[6.5rem] flex-wrap justify-center gap-1 rounded-xl border-2 p-2 ${g < q.f.n ? "border-accent bg-accent-soft" : "border-line"}`}>
          {Array.from({ length: each }, (_, i) => (
            <span key={i} className={`h-3 w-3 rounded-full ${g < q.f.n ? "bg-accent" : "bg-muted/50"}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

function Question({ q }: { q: ChallengeQ }) {
  const big = "text-5xl";
  if (q.kind === "of")
    return (
      <p className="flex items-center justify-center gap-3 text-4xl font-semibold tabular-nums">
        <FracText f={q.f} className={big} /> of {q.whole} = <span className="text-muted">?</span>
      </p>
    );
  if (q.kind === "equiv")
    return (
      <p className="flex items-center justify-center gap-3 text-4xl font-semibold">
        <FracText f={q.from} className={big} /> = <FracText f={{ n: q.answer, d: q.d }} top="?" className={big} />
      </p>
    );
  return (
    <p className="flex items-center justify-center gap-3 text-4xl font-semibold">
      <FracText f={q.a} className={big} /> {q.kind === "add" ? "+" : "−"} <FracText f={q.b} className={big} /> = <FracText f={{ n: q.answer, d: q.a.d }} top="?" className={big} />
    </p>
  );
}

export function FractionChallenge() {
  const [level, setLevel] = useState<ChallengeLevel>("unit");
  const [phase, setPhase] = useState<"setup" | "play" | "done">("setup");
  const [q, setQ] = useState<ChallengeQ | null>(null);
  const [n, setN] = useState(0);
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
  const [startedAt, setStartedAt] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const { best, offer } = useBest(`fc-${level}`, (a, b) => a < b);

  useEffect(() => {
    if (phase !== "play") return;
    const id = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(id);
  }, [phase, startedAt]);

  function start() {
    setN(0);
    setAnswer("");
    setWrong(false);
    setQ(challengeQ(level));
    setStartedAt(Date.now());
    setElapsed(0);
    setNewBest(false);
    setPhase("play");
  }

  function submit() {
    if (!q || !answer) return;
    if (Number(answer) === q.answer) {
      const next = n + 1;
      setN(next);
      setWrong(false);
      if (next >= COUNT) {
        const time = Math.round((Date.now() - startedAt) / 100);
        setElapsed(time * 100);
        setNewBest(offer(time));
        setPhase("done");
      } else setQ(challengeQ(level, Math.random, q));
    } else setWrong(true);
    setAnswer("");
  }

  if (phase === "setup") {
    return (
      <div className="space-y-4">
        <p className="text-muted">{COUNT} questions. Wrong answers get a hint, then try again.</p>
        <div className="grid gap-2">
          {(Object.keys(CHALLENGE_LEVELS) as ChallengeLevel[]).map((l) => (
            <button
              key={l}
              type="button"
              aria-pressed={level === l}
              onClick={() => setLevel(l)}
              className={`min-h-12 rounded-xl border px-4 text-left ${level === l ? "border-accent bg-accent-soft font-medium text-accent" : "border-line bg-surface"}`}
            >
              {CHALLENGE_LEVELS[l]}
            </button>
          ))}
        </div>
        {best != null ? <p className="text-sm text-muted">Your fastest: {secs(best)}</p> : null}
        <button type="button" className="btn-primary w-full" onClick={start}>
          Start
        </button>
      </div>
    );
  }

  if (phase === "done") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted">All {COUNT} done!</p>
        <p className="text-5xl font-semibold tabular-nums">{secs(Math.round(elapsed / 100))}</p>
        <p className={newBest ? "font-medium text-ok" : "text-muted"}>{newBest ? "New fastest time! 🏆" : `Your fastest: ${best != null ? secs(best) : "—"}`}</p>
        <div className="flex gap-2">
          <button type="button" className="btn-secondary flex-1" onClick={() => setPhase("setup")}>
            Change level
          </button>
          <button type="button" className="btn-primary flex-1" onClick={start}>
            Play again
          </button>
        </div>
      </div>
    );
  }

  if (!q) return null;
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-muted">
        <span>
          Question <strong className="text-ink tabular-nums">{n + 1}</strong> of {COUNT}
        </span>
        <span className="tabular-nums">{secs(Math.round(elapsed / 100))}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-2">
        <div className="h-full bg-accent transition-all" style={{ width: `${(n / COUNT) * 100}%` }} />
      </div>
      <div className="py-3">
        <Question q={q} />
      </div>
      {wrong ? (
        <div className="space-y-3 rounded-2xl bg-surface-2 p-3 text-center">
          <p className="text-danger">Not quite. {challengeHint(q)}</p>
          {q.kind === "of" ? <Groups q={q} /> : null}
        </div>
      ) : null}
      <NumberPad
        value={answer}
        onChange={(v) => {
          setAnswer(v);
        }}
        onSubmit={submit}
        max={3}
        wrong={wrong && !answer}
      />
    </div>
  );
}
