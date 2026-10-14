import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = [
  ...nextVitals,
  ...nextTs,
  {
    /*
     * Seit eslint-config-next 16 kommen zwei Regeln des React Compilers mit.
     * Das Projekt nutzt den Compiler nicht; die gemeldeten Stellen (Refs im
     * Render, setState im Effekt) sind bewusst so gebaut und laufen. Als
     * Warnung sichtbar, aber kein Bauabbruch – Umbau nur mit eigenem Anlass.
     */
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  {
    ignores: ["node_modules/**", ".next/**", "out/**", "next-env.d.ts", "cockpit/**"],
  },
];

export default eslintConfig;
