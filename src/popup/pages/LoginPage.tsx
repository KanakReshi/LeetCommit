import { useState, useEffect } from 'react';
import { GitBranch, Loader2, Copy, CheckCircle, ExternalLink, AlertCircle } from 'lucide-react';
import browser from 'webextension-polyfill';
import { GITHUB_OAUTH } from '@/constants';

interface LoginPageProps {
  onLogin: () => void;
}

type AuthStep =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'waitingForAuth'; userCode: string; verificationUri: string }
  | { kind: 'error'; message: string };

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [step, setStep] = useState<AuthStep>({ kind: 'idle' });
  const [repo, setRepo] = useState<string>(GITHUB_OAUTH.DEFAULT_REPO);
  const [copied, setCopied] = useState(false);

  // Restore an in-progress login (popup was reopened) and react to the
  // background completing the flow. The background owns the polling, so the
  // popup just watches storage for the result.
  useEffect(() => {
    browser.storage.local.get(['github', 'oauthPending', 'oauthError']).then((res: any) => {
      if (res.github?.token) { onLogin(); return; }
      if (res.oauthPending) {
        setStep({
          kind: 'waitingForAuth',
          userCode: res.oauthPending.userCode,
          verificationUri: res.oauthPending.verificationUri,
        });
        if (res.oauthPending.repo) setRepo(res.oauthPending.repo);
      } else if (res.oauthError) {
        setStep({ kind: 'error', message: res.oauthError });
      }
    });

    const onChanged = (changes: Record<string, any>, area: string) => {
      if (area !== 'local') return;
      if (changes.github?.newValue?.token) { onLogin(); return; }
      if (changes.oauthError?.newValue) {
        setStep({ kind: 'error', message: changes.oauthError.newValue });
      }
    };
    browser.storage.onChanged.addListener(onChanged);
    return () => browser.storage.onChanged.removeListener(onChanged);
  }, [onLogin]);

  async function startOAuth() {
    // Ensure the github.com host permission is granted (auto-granted on Firefox
    // 127+ from AMO; this covers temporary/dev installs and revocation). Must
    // run inside the click gesture.
    const origins = ['https://github.com/*', 'https://api.github.com/*'];
    try {
      if (!(await browser.permissions.contains({ origins }))) {
        if (!(await browser.permissions.request({ origins }))) {
          setStep({ kind: 'error', message: 'GitHub access permission is required to sign in.' });
          return;
        }
      }
    } catch {
      // permissions API unavailable — fall through and try anyway
    }

    setStep({ kind: 'loading' });

    const res: any = await browser.runtime.sendMessage({
      type: 'GITHUB_OAUTH_START',
      payload: { repo: repo.trim() || GITHUB_OAUTH.DEFAULT_REPO },
    });

    if (res?.type === 'ERROR') {
      setStep({ kind: 'error', message: res.message });
      return;
    }
    if (res?.type !== 'OAUTH_DEVICE_RESPONSE') {
      setStep({ kind: 'error', message: 'Unexpected response from background' });
      return;
    }

    const { userCode, verificationUri } = res.payload;
    setStep({ kind: 'waitingForAuth', userCode, verificationUri });
    // Opening the tab will close this popup — that's fine, the background keeps
    // polling and saves the config; reopening the popup lands on the dashboard.
    window.open(verificationUri, '_blank');
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function cancel() {
    await browser.storage.local.set({ oauthPending: null, oauthError: null });
    setStep({ kind: 'idle' });
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 items-center justify-center">
      <div className="flex flex-col gap-5 p-8 bg-slate-900 rounded-2xl w-96">
        <div>
          <h1 className="text-xl font-bold">LeetCommit</h1>
          <p className="text-slate-400 text-sm mt-1">Auto-push your accepted solutions to GitHub</p>
        </div>

        {step.kind === 'idle' && (
          <>
            <div className="space-y-1">
              <label className="text-sm text-slate-400">Repository name</label>
              <input
                className="w-full p-3 rounded-lg bg-slate-800 border border-slate-700 focus:outline-none focus:border-indigo-500"
                placeholder="LeetCode-Solutions"
                value={repo}
                onChange={(e) => setRepo(e.target.value)}
              />
              <p className="text-xs text-slate-500">The repo must already exist on your GitHub account</p>
            </div>
            <button
              onClick={startOAuth}
              className="flex items-center justify-center gap-2 p-3 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors font-medium"
            >
              <GitBranch size={18} />
              Sign in with GitHub
            </button>
          </>
        )}

        {step.kind === 'loading' && (
          <div className="flex items-center justify-center gap-2 text-slate-400 py-4">
            <Loader2 size={18} className="animate-spin" />
            <span>Connecting to GitHub…</span>
          </div>
        )}

        {step.kind === 'waitingForAuth' && (
          <>
            <div className="space-y-1">
              <p className="text-sm text-slate-400">Step 1 — Copy this code:</p>
              <div className="flex items-center gap-2">
                <span className="flex-1 text-center text-2xl font-mono font-bold tracking-widest bg-slate-800 rounded-lg py-2 px-3">
                  {step.userCode}
                </span>
                <button onClick={() => copyCode(step.userCode)} className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors" title="Copy">
                  {copied ? <CheckCircle size={16} className="text-green-400" /> : <Copy size={16} />}
                </button>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-sm text-slate-400">Step 2 — Authorize on GitHub:</p>
              <a href={step.verificationUri} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm">
                <ExternalLink size={14} />
                {step.verificationUri}
              </a>
            </div>

            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 size={14} className="animate-spin flex-shrink-0" />
              Waiting for authorization… you can close this and reopen it.
            </div>

            <button onClick={cancel} className="text-slate-500 hover:text-slate-300 text-sm transition-colors">Cancel</button>
          </>
        )}

        {step.kind === 'error' && (
          <>
            <div className="flex items-start gap-2 text-red-400 text-sm bg-red-950/40 rounded-lg p-3">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              {step.message}
            </div>
            <button onClick={() => setStep({ kind: 'idle' })} className="p-3 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors text-sm">
              Try again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
