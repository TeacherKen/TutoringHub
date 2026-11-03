"use client";
import { useState } from "react";
import { play } from "@/lib/sounds";

/**
 * A page header with a row of choices in one glass pill (All / Packages / Per class), and the list
 * below showing only what's picked (each item says what it is with data-kind).
 */
export function FilterGroup({
  label,
  options,
  title,
  action,
  children,
  className = "",
}: {
  label: string;
  options: { value: string; label: string }[];
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  const [show, setShow] = useState(options[0].value);
  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4 px-1.5 pt-1">
        {title}
        <div className="flex flex-wrap items-center gap-2.5">
          <div role="group" aria-label={label} className="glass flex gap-0.5 rounded-[15px] p-0.5">
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={show === o.value}
                onClick={() => {
                  play("flip");
                  setShow(o.value);
                }}
                className={`seg press ${show === o.value ? "is-on" : ""}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {action}
        </div>
      </header>
      <div data-show={show} className={className}>
        {children}
      </div>
    </>
  );
}
