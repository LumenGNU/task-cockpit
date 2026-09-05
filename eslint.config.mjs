// @ts-check
import eslint from '@eslint/js';
import globals from 'globals';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default defineConfig(
    globalIgnores(['**/~*']),
    eslint.configs.recommended,
    tseslint.configs.recommended, // без typed — для всех файлов
    {
        // typed-проверки только там, где есть tsc-контекст
        files: ['**/*.ts'],
        extends: [tseslint.configs.recommendedTypeChecked],
        languageOptions: {
            globals: {
                ...globals.node, // Добавляет process, console и т.д.
            },
            parserOptions: {
                projectService: true,
                tsconfigRootDir: import.meta.dirname,
            },
        },
    },
    {
        files: ['**/*.{mjs,cjs}'],  // без typed-проверок
        languageOptions: {
            globals: {
                ...globals.node,
            },
        },
    },
    {
        files: ['**/*.{ts,mjs,cjs}'],
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            curly: 'warn',
            eqeqeq: ['warn', 'always', { null: 'ignore' }],
            '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],
            '@typescript-eslint/no-namespace': ['error', { allowDeclarations: true }],
            '@typescript-eslint/no-unused-vars': ['warn', {
                vars: 'all',
                args: 'after-used',
                caughtErrors: 'all',
                ignoreRestSiblings: false,
                ignoreUsingDeclarations: false,
                reportUsedIgnorePattern: false,
                varsIgnorePattern: '^_',
                argsIgnorePattern: '^_',
                caughtErrorsIgnorePattern: '^_'
            }],
            '@stylistic/quotes': ['warn', 'single'],
            '@stylistic/semi': ['warn', 'always'],
            '@stylistic/comma-dangle': ['warn', 'never'],
            '@stylistic/member-delimiter-style': ['warn', {
                multiline: { delimiter: 'semi', requireLast: true },
                singleline: { delimiter: 'semi', requireLast: true },
            }],
            // '@stylistic/indent': ['warn', 4, {
            //     "assignmentOperator": "off"
            // }],
            '@stylistic/no-trailing-spaces': 'warn',
            '@stylistic/no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1, maxBOF: 1 }],
            // '@stylistic/no-multi-spaces': ['warn', { ignoreEOLComments: true }],
            // '@stylistic/brace-style': ['warn', 'stroustrup', { allowSingleLine: true }],
        },
    },
);
