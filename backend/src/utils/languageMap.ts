/**
 * Maps LeetCode language identifiers to file extensions.
 */
export const LANGUAGE_EXTENSION_MAP: Record<string, string> = {
  cpp: '.cpp',
  java: '.java',
  python: '.py',
  python3: '.py',
  c: '.c',
  csharp: '.cs',
  javascript: '.js',
  typescript: '.ts',
  php: '.php',
  swift: '.swift',
  kotlin: '.kt',
  dart: '.dart',
  golang: '.go',
  ruby: '.rb',
  scala: '.scala',
  rust: '.rs',
  racket: '.rkt',
  erlang: '.erl',
  elixir: '.ex',
  bash: '.sh',
  mysql: '.sql',
  mssql: '.sql',
  oraclesql: '.sql',
  postgresql: '.sql',
};

/**
 * Returns the corresponding file extension for a LeetCode language string.
 * Defaults to .txt if the language is unknown.
 */
export function getExtensionForLanguage(language: string): string {
  const normalized = language.toLowerCase().trim();
  return LANGUAGE_EXTENSION_MAP[normalized] || '.txt';
}

export function getCommentPrefix(language: string): string {
  const normalized = language.toLowerCase().trim();
  const hashLangs = ['python', 'python3', 'ruby', 'bash', 'sh'];
  const dashLangs = ['mysql', 'mssql', 'oraclesql', 'postgresql', 'sql'];
  
  if (hashLangs.includes(normalized)) return '#';
  if (dashLangs.includes(normalized)) return '--';
  return '//'; // Default for C, C++, Java, JS, TS, Rust, Go, Swift, etc.
}
