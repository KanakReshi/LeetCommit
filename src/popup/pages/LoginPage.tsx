import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface LoginPageProps {
  onLogin: () => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleLogin() {
    setLoading(true);
    setError(null);
    try {
      const response = await browser.runtime.sendMessage({ type: 'LOGIN_WITH_GITHUB' });
      if (response.type === 'ERROR') {
        setError(response.message ?? 'Login failed');
      } else {
        onLogin();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 font-sans items-center justify-center">
      <div className="flex flex-col items-center gap-8 p-10 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl w-72">
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-indigo-500/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-indigo-400" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14H9V8h2v8zm4 0h-2V8h2v8z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-slate-100">LeetCommit</h1>
          <p className="text-slate-400 text-sm text-center">
            Connect GitHub to auto-commit your accepted solutions
          </p>
        </div>

        <button
          onClick={handleLogin}
          disabled={loading}
          className="flex items-center justify-center gap-3 w-full px-4 py-3 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 rounded-xl transition-colors font-medium text-sm"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          ) : (
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.014-1.703-2.782.604-3.369-1.34-3.369-1.34-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836c.85.004 1.705.115 2.504.337 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.202 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z" />
            </svg>
          )}
          {loading ? 'Connecting…' : 'Sign in with GitHub'}
        </button>

        {error && (
          <p className="text-red-400 text-xs text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
