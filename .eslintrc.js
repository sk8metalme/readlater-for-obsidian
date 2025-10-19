module.exports = {
  env: {
    browser: true,
    es2021: true,
    webextensions: true,
    node: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'indent': 'off',  // Disable indentation checks for now due to mixed styles
    'linebreak-style': ['error', 'unix'],
    'quotes': 'off',  // Allow both single and double quotes
    'semi': 'off',    // Allow semicolon inconsistencies
    'no-unused-vars': 'warn',  // Warn but don't error on unused vars
    'no-console': 'off',  // Allow console statements
    'no-undef': 'warn',  // Warn but don't error on undefined variables
    'no-empty': 'warn',  // Warn but don't error on empty blocks
    'no-useless-escape': 'warn'  // Warn but don't error on unnecessary escapes
  },
  globals: {
    chrome: 'readonly',
    ErrorHandler: 'readonly',
    AggregatedFileManager: 'readonly',
    ArticleTableManager: 'readonly',
    AggregatedMarkdownGenerator: 'readonly'
  }
};