import { defineConfig } from "vitest/config";

export default defineConfig({
    // tsconfig.json uses the classic JSX runtime ("jsx": "react") and every component
    // imports React. Stated here rather than inferred from tsconfig, so a future
    // tsconfig change cannot silently break every component test.
    // (esbuild's transform API spells these jsxFactory/jsxFragment, not the
    // jsxFactory/jsxFragmentFactory that tsconfig uses.)
    esbuild: {
        jsx: "transform",
        jsxFactory: "React.createElement",
        jsxFragment: "React.Fragment"
    },
    test: {
        globals: true,
        environment: "jsdom",
        setupFiles: ["./vitest.setup.ts"],
        include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
        // `import "./x.scss"` becomes an empty module. Styles are not under test.
        css: false,
        clearMocks: true,
        restoreMocks: true,
        coverage: {
            provider: "v8",
            reporter: ["text", "lcov"],
            include: ["src/**"],
            exclude: [
                "src/testing/**",
                "src/**/*.test.*",
                "src/main/**",
                "src/renderer/index.tsx"
            ]
            // No thresholds. A global percentage rewards writing tests for whatever is
            // uncovered - here the markup and the Electron glue, which docs/testing-strategy.md
            // deliberately excludes. Coverage is evidence, not a gate.
        }
    }
});
