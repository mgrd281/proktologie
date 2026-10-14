import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    // Regeln des React Compilers (neu in eslint-config-next 16) – das Cockpit
    // nutzt den Compiler nicht. Sichtbar als Warnung, kein Bauabbruch.
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/purity": "warn",
    },
  },
  { ignores: ["node_modules/**", ".next/**", "next-env.d.ts", "drizzle/**", "lib/db/auth-schema.ts"] },
];

export default config;
