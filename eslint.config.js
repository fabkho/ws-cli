import tseslint from 'typescript-eslint'

export default tseslint.config(
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.ts'],
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'warn',
      // CLI tool — console output is expected
      'no-console': 'off',
    },
  },

  {
    ignores: ['dist/', 'node_modules/'],
  },
)
