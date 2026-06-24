import type { SubmissionPayload } from '@/types/leetcode';
import { getStorage } from './storage';

interface GithubResponse {
  success: boolean;
  message?: string;
}

/**
 * Sync LeetCode submission to GitHub
 */
export async function sendSubmissionToGithub(payload: SubmissionPayload): Promise<GithubResponse> {
  const { github } = await getStorage('github');

  if (!github) {
    return {
      success: false,
      message: 'GitHub configuration missing',
    };
  }

  const { username, token, repo, branch = 'main' } = github;

  if (!token || !repo || !username) {
    return {
      success: false,
      message: 'Invalid GitHub configuration',
    };
  }

  const formattedTitle = payload.problem.title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
  const category = payload.problem.categoryTitle || 'Algorithms';
  const questionNumber = payload.problem.questionId;

  const baseFolder = `${category}/${questionNumber}-${formattedTitle}`;
  const codeFilePath = `${baseFolder}/${formattedTitle}.${getExtension(payload.submission.language)}`;
  const readmeFilePath = `${baseFolder}/README.md`;

  const codeContent = btoa(unescape(encodeURIComponent(payload.submission.code || '')));

  const diffColor =
    payload.problem.difficulty === 'Easy'
      ? 'success'
      : payload.problem.difficulty === 'Medium'
        ? 'warning'
        : 'critical';
  const readmeMarkdown =
    `<h2><a href="https://leetcode.com/problems/${payload.problem.titleSlug}">${payload.problem.questionId}. ${payload.problem.title}</a></h2>\n\n` +
    `<h3><img src="https://img.shields.io/badge/Difficulty-${payload.problem.difficulty}-${diffColor}?style=for-the-badge" alt="Difficulty"></h3>\n\n` +
    `--- \n\n` +
    (payload.problem.descriptionHtml || 'No description available.');
  const readmeContent = btoa(unescape(encodeURIComponent(readmeMarkdown)));

  const rP = Number((payload.submission.runtimePercentile || 0).toFixed(2));
  const mP = Number((payload.submission.memoryPercentile || 0).toFixed(2));
  let commitMessage = `Time: ${payload.submission.runtime} (${rP}%) | Memory: ${payload.submission.memory} (${mP}%) - LeetCommit`;

  try {
    const codePushed = await uploadFileToGithub(
      token,
      username,
      repo,
      branch,
      codeFilePath,
      codeContent,
      commitMessage
    );

    if (codePushed) {
      // Add 1 second delay to avoid GitHub API 409 Conflict on rapid consecutive commits
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    commitMessage = `Added README.md file for ${payload.problem.title}`;
    await uploadFileToGithub(
      token,
      username,
      repo,
      branch,
      readmeFilePath,
      readmeContent,
      commitMessage
    );

    return { success: true };
  } catch (error) {
    console.error('GITHUB API SYNC ERROR:', error);
    return {
      success: false,
      message: String(error),
    };
  }
}

async function uploadFileToGithub(
  token: string,
  username: string,
  repo: string,
  branch: string,
  path: string,
  contentBase64: string,
  message: string
): Promise<boolean> {
  const encodedPath = path.split('/').map(encodeURIComponent).join('/');
  const url = `https://api.github.com/repos/${username}/${repo}/contents/${encodedPath}`;

  let sha: string | undefined;
  let existingContent: string | undefined;
  try {
    const getRes = await fetch(`${url}?ref=${branch}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
      existingContent = data.content;
    }
  } catch {
    // Ignore error if file doesn't exist
  }

  // Normalize base64 because GitHub wraps it with newlines
  if (existingContent) {
    const normalizedExisting = existingContent.replace(/\n/g, '');
    const normalizedNew = contentBase64.replace(/\n/g, '');
    if (normalizedExisting === normalizedNew) {
      return false;
    }
  }

  const putRes = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message,
      content: contentBase64,
      branch,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!putRes.ok) {
    const error = await putRes.text();
    throw new Error(`GitHub API error on ${path}: ${error}`);
  }

  return true;
}

function getExtension(language: string) {
  switch (language.toLowerCase().trim()) {
    // C/C++/C#
    case 'c':
      return 'c';
    case 'cpp':
    case 'c++':
      return 'cpp';
    case 'csharp':
    case 'c#':
      return 'cs';

    // Java Family
    case 'java':
      return 'java';
    case 'kotlin':
      return 'kt';

    // Python
    case 'python':
    case 'python3':
      return 'py';

    // JavaScript/TypeScript
    case 'javascript':
    case 'js':
      return 'js';
    case 'typescript':
    case 'ts':
      return 'ts';

    // Go
    case 'go':
    case 'golang':
      return 'go';

    // Rust
    case 'rust':
      return 'rs';

    // Ruby
    case 'ruby':
      return 'rb';

    // PHP
    case 'php':
      return 'php';

    // Swift
    case 'swift':
      return 'swift';

    // Scala
    case 'scala':
      return 'scala';

    // Bash/Shell
    case 'bash':
    case 'shell':
    case 'sh':
      return 'sh';

    // SQL
    case 'sql':
    case 'mysql':
    case 'postgresql':
    case 'mssqlserver':
      return 'sql';
    
    //MySQL

    // R
    case 'r':
      return 'r';

    // Perl
    case 'perl':
      return 'pl';

    // Lua
    case 'lua':
      return 'lua';

    // Scheme
    case 'scheme':
      return 'scm';

    // Racket
    case 'racket':
      return 'rkt';

    // Erlang
    case 'erlang':
      return 'erl';

    // Elixir
    case 'elixir':
      return 'ex';

    // Clojure
    case 'clojure':
      return 'clj';

    // Groovy
    case 'groovy':
      return 'groovy';

    // Dart
    case 'dart':
      return 'dart';

    // Haskell
    case 'haskell':
      return 'hs';

    // Lisp
    case 'lisp':
      return 'lisp';

    // F#
    case 'fsharp':
    case 'f#':
      return 'fs';

    // OCaml
    case 'ocaml':
      return 'ml';

    // VB.NET
    case 'vbnet':
    case 'vb.net':
      return 'vb';

    // PowerShell
    case 'powershell':
      return 'ps1';

    // MATLAB
    case 'matlab':
      return 'm';

    // Objective-C
    case 'objective-c':
    case 'objc':
      return 'm';

    // Mojo
    case 'mojo':
      return 'mojo';

    // Solidity
    case 'solidity':
      return 'sol';

    default:
      return 'txt';
  }
}
