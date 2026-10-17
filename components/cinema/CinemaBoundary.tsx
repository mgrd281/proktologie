"use client";

import { Component, type ReactNode } from "react";

/**
 * Fehlergrenze nur um die Kamerafahrt. Wirft dort etwas (Canvas, Ebenen,
 * Bildspeicher), steht an ihrer Stelle die ruhige Fassung – Buchung,
 * Inhalte und Kontakt darunter bleiben. Ohne diese Grenze griff die der
 * ganzen Seite (app/error.tsx), und die Buchung verschwand mit dem Film.
 */
export class CinemaBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("[kamerafahrt] Fehler abgefangen, ruhige Fassung gezeigt:", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
