// Config ESLint v9 (flat config). Estilo deliberadamente leve — focada
// em pegar bugs reais, nao em estilo (deixa pro prettier).
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/', 'node_modules/', 'PlanoTerapeutico/', 'files/'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'no-undef': 'error',
      'no-redeclare': 'error',
    },
  },
  {
    // Vitest + JSX
    files: ['**/*.test.js', '**/*.test.jsx', 'src/**/*.jsx'],
    languageOptions: {
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
];
