import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
    globalIgnores(["**/~*"]),

    eslint.configs.recommended,
    tseslint.configs.recommendedTypeChecked,

    {
        languageOptions: {
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },

    {
        rules: {
            curly: "warn",
            eqeqeq: "warn",
            "@typescript-eslint/naming-convention": ["warn", {
                selector: "import",
                format: ["camelCase", "PascalCase"],
            }],
            "@typescript-eslint/consistent-type-definitions": ["warn", "interface"]
        },
    },

    {
        files: ["**/*.js", "**/*.mjs", "**/*.cjs"],
        extends: [tseslint.configs.disableTypeChecked],
    },
);
