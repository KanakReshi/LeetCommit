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

  const filePath = `LeetCode/${payload.problem.title}.${getExtension(payload.submission.language)}`;

  const content = btoa(unescape(encodeURIComponent(payload.submission.code)));

  try {
    const response = await fetch(
      `https://api.github.com/repos/${username}/${repo}/contents/${filePath}`,
      {
        method: 'PUT',

        headers: {
          Authorization: `Bearer ${token}`,

          'Content-Type': 'application/json',
        },

        body: JSON.stringify({
          message: `Add solution ${payload.problem.title}`,

          content,

          branch,
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();

      return {
        success: false,

        message: error,
      };
    }

    return {
      success: true,
    };
  } catch (error) {
    return {
      success: false,

      message: String(error),
    };
  }
}

function getExtension(language: string) {
  switch (language.toLowerCase()) {
    case 'cpp':
    case 'c++':
      return 'cpp';

    case 'java':
      return 'java';

    case 'python':
    case 'python3':
      return 'py';

    case 'javascript':
      return 'js';

    case 'typescript':
      return 'ts';

    default:
      return 'txt';
  }
}
