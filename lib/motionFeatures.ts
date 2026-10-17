/**
 * Motion-Funktionspaket für LazyMotion – als eigene Datei, damit es erst
 * nachgeladen wird, wenn eine animierte Komponente erscheint, und den
 * ersten Seitenaufbau nicht belastet (siehe MOTION_SYSTEM.md und den
 * Hinweis zu „framer-motion" in components/booking/StepFrame.tsx).
 */
export { domAnimation as default } from "framer-motion";
