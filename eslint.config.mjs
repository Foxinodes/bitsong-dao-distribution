import typescriptPlugin from "@typescript-eslint/eslint-plugin";
import importPlugin from "eslint-plugin-import";
import promisePlugin from "eslint-plugin-promise";
import typescriptParser from "@typescript-eslint/parser";

export default [
    {
        files: ["**/*.ts"],
        ignores: [
            "node_modules",
            "dist",
        ],
        languageOptions: {
            parser: typescriptParser,
            parserOptions: {
                ecmaVersion: 2020,
                sourceType: "module",
                project: "./tsconfig.json",
            },
            globals: {
                window: "readonly",
                document: "readonly",
                navigator: "readonly",
                console: "readonly",
            },
        },
        plugins: {
            "@typescript-eslint": typescriptPlugin,
            import: importPlugin,
            promise: promisePlugin,
        },
        settings: {
            "import/resolver": {
                typescript: {
                    alwaysTryTypes: true,
                    project: "./tsconfig.json",
                },
                node: {
                    extensions: [".js", ".jsx", ".ts", ".tsx"],
                },
            },
        },
        rules: {
            "arrow-body-style": ["off"],
            "no-trailing-spaces": ["error", { skipBlankLines: true }],
            "complexity": ["off"],
            "indent": [
                "error",
                "tab",
                {
                    SwitchCase: 1,
                },
            ],
            "quotes": ["error", "single"],
            "semi": ["error", "always"],
            "no-multi-spaces": ["error"],
            "object-curly-spacing": ["error", "always"],
            "brace-style": ["error", "allman", { allowSingleLine: true }],
            "arrow-parens": ["error", "always"],
            "space-infix-ops": ["error"],
            "space-before-function-paren": [
                "error",
                {
                    anonymous: "never",
                    named: "never",
                    asyncArrow: "always",
                },
            ],
            "function-paren-newline": ["off"],
            "@typescript-eslint/no-explicit-any": "off",
            "keyword-spacing": [
                "error",
                {
                    before: true,
                    after: true,
                },
            ],
            "import/order": [
                "error",
                {
                    groups: [["builtin", "external"], "internal", ["parent", "sibling", "index"]],
                    "newlines-between": "ignore",
                },
            ],
            "promise/always-return": "error",
            "promise/no-return-wrap": "error",
            "@typescript-eslint/no-unused-vars": [
                "error",
                {
                    argsIgnorePattern: "^_",
                    varsIgnorePattern: "^_",
                },
            ],
        },
    },
];
