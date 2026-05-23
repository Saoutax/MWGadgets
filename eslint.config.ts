import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default [
    {
        ignores: ['dist/**', 'node_modules/**'],
    },
    {
        files: ['**/*.js', '**/*.ts', '**/*.tsx'],
        plugins: {
            import: importPlugin,
        },
        settings: {
            'import/resolver': {
                typescript: { alwaysTryTypes: true },
            },
        },
        rules: {
            indent: ['error', 4, { SwitchCase: 1, ignoredNodes: ['ConditionalExpression > ObjectExpression'] }],
            quotes: ['error', 'single'],
            semi: ['error', 'always'],
            'linebreak-style': ['error', 'unix'],
            'object-curly-spacing': ['error', 'always'],
            curly: ['error', 'all'],
            'no-trailing-spaces': 'error',
            'dot-notation': 'error',
            'no-duplicate-imports': 'error',
            'prefer-const': 'warn',
            'no-template-curly-in-string': 'error',
            'no-unmodified-loop-condition': 'warn',
            'no-unreachable-loop': 'error',
            'import/order': [
                'warn',
                {
                    groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
                    alphabetize: { order: 'asc', caseInsensitive: false },
                },
            ],
        },
    },

    ...tseslint.configs.recommended,

    {
        files: ['**/*.js'],
        languageOptions: {
            sourceType: 'module',
            globals: {
                ...globals.browser,
                ...globals.node,
                $: 'readonly',
                mw: 'readonly',
                OO: 'readonly',
            },
        },
        rules: {
            ...js.configs.recommended.rules,
            'no-unused-vars': 'error',
        },
    },

    {
        files: ['**/*.ts', '**/*.tsx'],
        rules: {
            '@typescript-eslint/no-unused-vars': 'error',
        },
    },
];
