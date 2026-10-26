import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", ".next-*/**", "node_modules/**", ".data/**", "coverage/**", "playwright-report/**", "test-results/**", "public/**"],
  },
  {
    rules: {
      // Apostrophes in JSX copy render fine; escaping them all hurts readability.
      "react/no-unescaped-entities": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", destructuredArrayIgnorePattern: "^_" }],
    },
  },
];

export default config;
