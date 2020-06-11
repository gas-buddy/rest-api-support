module.exports = {
  root: true,
  extends: 'gasbuddy',
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  settings: {
    'import/resolver': {
      node: {
        extensions: ['.ts', '.js']
      }
    }
  },
  rules: {
    "import/extensions": [
      'error',
      'ignorePackages',
      {
        js: 'never',
        ts: 'never',
      }
    ]
  }
};
