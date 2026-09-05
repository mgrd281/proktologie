import type { ReactNode } from "react";

export function AuthCard({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <div className="rise-in w-full max-w-[420px] rounded-3xl border border-white/10 bg-white/[0.04] p-7 backdrop-blur-sm md:p-9">
      <p className="flex items-center gap-3 text-[11px] font-semibold tracking-[0.24em] text-accent uppercase">
        {eyebrow}
        <span aria-hidden="true" className="h-px w-10 bg-accent/45" />
      </p>
      <h1 className="font-display mt-4 text-[30px] leading-[1.1] font-medium text-cream">{title}</h1>
      <div className="mt-7">{children}</div>
    </div>
  );
}

export const darkInput =
  "w-full min-h-12 rounded-xl border border-white/15 bg-white/[0.06] px-4 text-[15px] text-cream placeholder:text-cream/50 transition-colors focus:border-accent";
export const darkLabel = "mb-1.5 block text-[13px] font-medium text-cream/85";
export const darkPrimary =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 text-[15px] font-semibold text-deep transition-colors hover:bg-[#76a81f] disabled:opacity-50";
export const darkSecondary =
  "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border border-white/25 px-6 text-[15px] font-medium text-cream transition-colors hover:border-accent hover:text-accent disabled:opacity-50";
