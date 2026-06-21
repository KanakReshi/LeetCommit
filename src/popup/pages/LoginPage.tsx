import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import browser from 'webextension-polyfill';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const [username, setUsername] = useState('');

  const [token, setToken] = useState('');

  const [repo, setRepo] = useState('');

  async function handleLogin() {
    setLoading(true);

    setError(null);

    try {
      const response: any = await browser.runtime.sendMessage({
        type: 'UPDATE_CONFIG',

        payload: {
          github: {
            username,

            token,

            repo,

            branch: 'main',
          },

          enabled: true,
        },
      });

      if (response.type === 'ERROR') {
        setError(response.message ?? 'Failed');

        return;
      }

      onLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 items-center justify-center">
      <div className="flex flex-col gap-4 p-8 bg-slate-900 rounded-2xl w-96">
        <h1 className="text-xl font-bold">LeetCommit</h1>

        <input
          className="p-3 rounded bg-slate-800"
          placeholder="GitHub Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />

        <input
          className="p-3 rounded bg-slate-800"
          placeholder="GitHub Repository"
          value={repo}
          onChange={(e) => setRepo(e.target.value)}
        />

        <input
          className="p-3 rounded bg-slate-800"
          placeholder="GitHub Token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />

        <button onClick={handleLogin} disabled={loading} className="p-3 rounded bg-indigo-600">
          {loading ? <Loader2 className="animate-spin" /> : 'Connect GitHub'}
        </button>

        {error && <p className="text-red-400 text-sm">{error}</p>}
      </div>
    </div>
  );
}
