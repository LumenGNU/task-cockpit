import eslint from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default defineConfig(
    globalIgnores(['**/~*']),

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
        plugins: {
            '@stylistic': stylistic,
        },
        rules: {
            curly: 'warn',
            eqeqeq: 'warn',
            '@typescript-eslint/naming-convention': ['warn', {
                selector: 'import',
                format: ['camelCase', 'PascalCase'],
            }],
            '@typescript-eslint/consistent-type-definitions': ['warn', 'interface'],



            '@typescript-eslint/no-namespace': ['error', { 'allowDeclarations': true }],

            //
            '@stylistic/quotes': ['warn', 'single'],
            '@stylistic/semi': ['warn', 'always'],
            '@stylistic/comma-dangle': ['warn', 'always-multiline'],
            '@stylistic/indent': ['warn', 4],

            '@stylistic/padded-blocks': ['warn', 'start', { allowSingleLineBlocks: true }],

            '@stylistic/no-trailing-spaces': 'warn',
            '@stylistic/no-multiple-empty-lines': ['warn', { max: 2, maxEOF: 1, maxBOF: 0 }],
            '@stylistic/no-multi-spaces': ['warn', { ignoreEOLComments: true }],

            '@stylistic/padding-line-between-statements': [
                'warn',
                {
                    blankLine: 'always', prev: '*', next: ['return', 'break', 'continue', 'throw']
                }
            ],

            '@stylistic/brace-style': ['warn', 'stroustrup', { 'allowSingleLine': true }],

        },
    },

    {
        files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
        extends: [tseslint.configs.disableTypeChecked],
    },
);
