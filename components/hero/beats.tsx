import { Icon } from "@/components/ui/Icon";
import type { HeroBeatContent } from "@/content/hero";

/**
 * Beat-spezifische rechte Bildflächen des cinematischen Heros.
 * Bewusst abstrakt und ruhig – keinerlei klinisches Bildmaterial.
 * Beats 1–2 rendern hier nichts: dort steht das persistente Porträt.
 */
export function BeatVisual({ beat }: { beat: HeroBeatContent }) {
  switch (beat.id) {
    case "beschwerden":
      return (
        <div className="relative">
          <CurveBackdrop />
          <ul className="relative grid grid-cols-2 gap-4">
            {beat.items?.map((item) => (
              <li
                key={item.title}
                className="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
              >
                <p className="font-display text-lg font-medium text-white">
                  {item.title}
                </p>
                <p className="mt-1.5 text-xs leading-relaxed text-cream/60">
                  {item.note}
                </p>
              </li>
            ))}
          </ul>
        </div>
      );

    case "diagnostik":
      return (
        <div className="relative flex items-center justify-center py-6">
          <svg
            viewBox="0 0 320 320"
            className="absolute h-80 w-80"
            aria-hidden="true"
            focusable="false"
          >
            <g fill="none" stroke="#86BC23" strokeOpacity="0.18">
              <circle cx="160" cy="160" r="150" />
              <circle cx="160" cy="160" r="105" strokeDasharray="3 7" />
              <circle cx="160" cy="160" r="60" strokeOpacity="0.3" />
            </g>
            <g stroke="#527A32" strokeOpacity="0.5">
              <path d="M160 0v40M160 280v40M0 160h40M280 160h40" />
            </g>
          </svg>
          <ul className="relative w-72 space-y-3.5">
            {beat.items?.map((item) => (
              <li
                key={item.title}
                className="flex items-start gap-3.5 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
              >
                <span className="mt-1 flex size-2 shrink-0 rounded-full bg-accent" />
                <span>
                  <span className="block text-sm font-medium text-white">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-cream/60">
                    {item.note}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      );

    case "behandlung":
      return (
        <div className="relative">
          <CurveBackdrop />
          <ol className="relative space-y-4">
            {beat.items?.map((item, index) => (
              <li
                key={item.title}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm"
                style={{ marginLeft: `${index * 2.5}rem` }}
              >
                <span className="font-display text-2xl font-light text-accent/80">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>
                  <span className="block font-medium text-white">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-xs text-cream/60">
                    {item.note}
                  </span>
                </span>
              </li>
            ))}
          </ol>
        </div>
      );

    case "praxis":
      return (
        <div className="relative flex items-center justify-center py-10">
          <svg
            viewBox="0 0 360 280"
            className="h-72 w-full"
            aria-hidden="true"
            focusable="false"
          >
            <g stroke="#527A32" strokeOpacity="0.5" strokeWidth="1.2" fill="none">
              <path d="M0 70 C 90 55, 200 90, 360 60" />
              <path d="M0 150 C 110 130, 240 170, 360 140" />
              <path d="M0 230 C 120 210, 250 250, 360 220" />
              <path d="M80 0 C 95 100, 65 190, 90 280" />
              <path d="M200 0 C 215 95, 185 195, 210 280" />
              <path d="M300 0 C 315 105, 285 190, 310 280" />
            </g>
            <circle cx="205" cy="145" r="34" fill="#86BC23" fillOpacity="0.12" />
          </svg>
          <span className="absolute top-[46%] left-[55%] flex -translate-x-1/2 -translate-y-1/2 flex-col items-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-accent text-deep shadow-xl">
              <Icon name="pin" size={22} />
            </span>
            <span className="mt-2 rounded-full border border-white/15 bg-deep/80 px-3.5 py-1 text-[11px] font-medium tracking-[0.16em] text-cream/85 uppercase backdrop-blur-sm">
              Hamburg-Eimsbüttel
            </span>
          </span>
        </div>
      );

    default:
      return null;
  }
}

/** Ruhige organische Linien als gemeinsamer Hintergrund einiger Beats. */
function CurveBackdrop() {
  return (
    <svg
      viewBox="0 0 480 360"
      className="absolute -inset-x-8 -inset-y-10 h-[calc(100%+5rem)] w-[calc(100%+4rem)]"
      aria-hidden="true"
      focusable="false"
      preserveAspectRatio="none"
    >
      <g fill="none" strokeWidth="1.5">
        <path
          d="M-20 300 C 100 220, 240 320, 340 230 S 520 160, 540 190"
          stroke="#86BC23"
          strokeOpacity="0.12"
        />
        <path
          d="M-20 340 C 120 260, 260 360, 370 270 S 530 210, 550 240"
          stroke="#527A32"
          strokeOpacity="0.3"
        />
      </g>
    </svg>
  );
}
