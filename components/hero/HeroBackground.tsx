/**
 * Hintergrund-Ebene des cinematischen Heros („Klinik-Ambiente").
 *
 * Bewusst als eigene, austauschbare Ebene gebaut: Hier wird später die
 * scroll-getriebene Lenis-/Canvas-Bildsequenz montiert, ohne den Rest des
 * Heros anzufassen. Der Scroll-Fortschritt liegt auf der Stage bereits als
 * CSS-Variable `--hp` (0–1) und wird pro Frame aktualisiert – ein künftiges
 * <canvas> ersetzt einfach den Inhalt dieser Komponente und liest den
 * Fortschritt über einen eigenen Callback in HeroCinematic.
 *
 * Bis dahin: ruhige, markige Ambiente-Komposition in Deep Green.
 */
export function HeroBackground() {
  return (
    <div aria-hidden="true" data-hero-background className="absolute inset-0">
      {/* Grundfläche mit leichtem Verlauf – wirkt wie gedämpftes Raumlicht */}
      <div className="absolute inset-0 bg-gradient-to-br from-deep via-[#1b2c21] to-deep" />

      {/* Weiche Lichtinseln */}
      <div
        className="absolute -top-1/4 right-[-10%] h-[70%] w-[55%] rounded-full opacity-60"
        style={{
          background:
            "radial-gradient(closest-side, rgba(82,122,50,0.22), transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-[-20%] left-[-10%] h-[60%] w-[45%] rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(closest-side, rgba(184,217,76,0.10), transparent 70%)",
        }}
      />

      {/* Organische Linien – gleiche Formsprache wie Beats und og-image */}
      <svg
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMax slice"
        className="absolute inset-0 h-full w-full"
        focusable="false"
      >
        <g fill="none" strokeWidth="1.5">
          <path
            d="M-40 700 C 300 580, 700 760, 1000 620 S 1500 520, 1520 560"
            stroke="#B8D94C"
            strokeOpacity="0.10"
          />
          <path
            d="M-40 780 C 340 650, 760 830, 1060 690 S 1500 600, 1520 640"
            stroke="#527A32"
            strokeOpacity="0.28"
          />
          <path
            d="M-40 860 C 380 740, 800 900, 1120 770 S 1500 690, 1520 720"
            stroke="#527A32"
            strokeOpacity="0.16"
          />
        </g>
      </svg>

      {/* Sanfte Vignette unten, gibt der Bühne Tiefe */}
      <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/25 to-transparent" />
    </div>
  );
}
