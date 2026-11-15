"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { DIFFICULTIES, type Difficulty } from "../lib/constants";

export const DIFFICULTY_STYLES: Record<Difficulty, string> = {
  Beginner: "bg-emerald-500/15 text-emerald-300 border-emerald-500/35 hover:bg-emerald-500/25",
  Intermediate: "bg-sky-500/15 text-sky-300 border-sky-500/35 hover:bg-sky-500/25",
  Advanced: "bg-amber-500/15 text-amber-300 border-amber-500/35 hover:bg-amber-500/25",
  "World Class/Pro": "bg-rose-500/15 text-rose-300 border-rose-500/35 hover:bg-rose-500/25",
};

export const DIFFICULTY_SHORT_LABELS: Record<Difficulty, string> = {
  Beginner: "Beginner",
  Intermediate: "Intermediate",
  Advanced: "Advanced",
  "World Class/Pro": "World Class",
};

interface DifficultyBadgeProps {
  difficulty: Difficulty;
  overridden?: boolean;
  onSelectDifficulty: (next: Difficulty) => void;
  size?: "sm" | "md";
  align?: "left" | "right";
}

export function DifficultyBadge({
  difficulty,
  overridden = false,
  onSelectDifficulty,
  size = "sm",
  align = "right",
}: DifficultyBadgeProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  const sizeClasses =
    size === "md"
      ? "px-2.5 py-1 text-xs gap-1.5"
      : "px-2 py-0.5 text-[11px] gap-1";

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        title={
          overridden
            ? `Difficulty: ${difficulty} (manually set — click to change)`
            : `Estimated difficulty: ${difficulty} (click to override)`
        }
        className={`inline-flex items-center rounded-full border font-medium transition-colors cursor-pointer ${sizeClasses} ${DIFFICULTY_STYLES[difficulty]}`}
      >
        {overridden && (
          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-85" aria-hidden="true" />
        )}
        <span>{DIFFICULTY_SHORT_LABELS[difficulty]}</span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className={`absolute bottom-full mb-1.5 z-50 w-44 rounded-xl border border-zinc-700/90 bg-zinc-900/95 p-1 shadow-2xl backdrop-blur-md ${
            align === "right" ? "right-0" : "left-0"
          }`}
        >
          <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
            Set Difficulty
          </div>
          {DIFFICULTIES.map((level) => {
            const active = level === difficulty;
            return (
              <button
                key={level}
                type="button"
                onClick={() => {
                  setOpen(false);
                  if (level !== difficulty) {
                    onSelectDifficulty(level);
                  }
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-xs transition-colors cursor-pointer ${
                  active
                    ? "bg-zinc-800 text-white font-semibold"
                    : "text-zinc-300 hover:bg-zinc-800/70 hover:text-white"
                }`}
              >
                <span>{level}</span>
                {active && <Check className="h-3.5 w-3.5 text-amber-400" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
