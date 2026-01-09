module.exports = {
  // TypeScript/TSX 파일
  '*.{ts,tsx}': (filenames) => {
    return `eslint --fix --max-warnings=0 ${filenames.join(' ')}`;
  },
  // JavaScript/JSX 파일
  '*.{js,jsx,cjs,mjs}': (filenames) => {
    return `eslint --fix --max-warnings=0 ${filenames.join(' ')}`;
  },
};
