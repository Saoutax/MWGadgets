import js from "@eslint/js";
import markdown from "@eslint/markdown";
import importPlugin from "eslint-plugin-import";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
    {
        ignores: ["dist/**", "node_modules/**"],
    },
    {
        files: ["**/*.js"],
        plugins: {
            import: importPlugin,
        },
        languageOptions: {
            sourceType: "module",
            globals: {
                ...globals.browser,
                ...globals.node,
                $: "readonly",
                mw: "readonly",
                OO: "readonly",
            },
        },
        settings: {
            "import/resolver": {
                typescript: { alwaysTryTypes: true },
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            indent: ["error", 4],
            quotes: ["error", "double"],
            semi: ["error", "always"],
            "linebreak-style": ["error", "unix"],
            "object-curly-spacing": ["error", "always"],
            curly: ["error", "all"],
            "no-trailing-spaces": "error",
            "dot-notation": "error",
            "no-duplicate-imports": "error",
            "no-unused-vars": "error",
            "prefer-const": "warn",
            "no-template-curly-in-string": "error",
            "no-unmodified-loop-condition": "warn",
            "no-unreachable-loop": "error",
            "import/order": [
                "warn",
                {
                    groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
                    alphabetize: { order: "asc", caseInsensitive: false },
                },
            ],
        },
    },

    ...tseslint.configs.recommended,

    {
        files: ["**/*.ts", "**/*.tsx"],
        plugins: {
            import: importPlugin,
        },
        settings: {
            "import/resolver": {
                typescript: { alwaysTryTypes: true },
            },
        },
        rules: {
            indent: ["error", 4],
            quotes: ["error", "double"],
            semi: ["error", "always"],
            "object-curly-spacing": ["error", "always"],
            "import/order": [
                "warn",
                {
                    groups: ["builtin", "external", "internal", "parent", "sibling", "index"],
                    alphabetize: { order: "asc", caseInsensitive: false },
                },
            ],
            "no-unused-vars": "off",
            "@typescript-eslint/no-unused-vars": "error",
        },
    },

    {
        files: ["**/*.md"],
        language: "markdown/gfm",
        plugins: { markdown },
        rules: {
            ...markdown.configs.recommended.rules,
            "markdown/heading-increment": "off",
        },
    },
];
