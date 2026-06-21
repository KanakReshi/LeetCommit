import { useEffect, useState } from 'react';
import browser from 'webextension-polyfill';
import { Loader2, CheckCircle, XCircle, Globe } from 'lucide-react';

interface StorageData {
  github: {
    username: string;

    repo: string;

    branch?: string;
  } | null;

  enabled: boolean;

  totalSent: number;

  totalFailed: number;

  lastSubmission: {
    problemSlug?: string;

    title?: string;

    language?: string;

    capturedAt?: string;
  } | null;

  lastError: string | null;
}

export default function SyncStatusPage() {
  const [data, setData] = useState<StorageData | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {

  browser.storage.local
    .get([
      "github",
      "enabled",
      "lastSubmission",
      "totalSent",
      "totalFailed",
      "submissions"
    ])
    .then((res)=>{


      setData({
        github: (res.github as any) ?? null,
        enabled: Boolean(res.enabled ?? false),
        lastSubmission: (res.lastSubmission as any) ?? null,
        totalSent: Number(res.totalSent ?? 0),
        totalFailed: Number(res.totalFailed ?? 0),
        submissions: (res.submissions as any) ?? []
      } as any);
      setLoading(false);


    });


},[]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="p-6 text-slate-100 space-y-6">
      <h1 className="text-xl font-bold">Sync Status</h1>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-3">
          <Globe className="w-5 h-5" />

          <div>
            <p className="font-medium">GitHub</p>

            <p className="text-sm text-slate-400">
              {data.github ? `${data.github.username}/${data.github.repo}` : 'Not connected'}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-900 p-4 rounded-xl">
          <p className="text-slate-400 text-sm">Synced</p>

          <p className="text-2xl font-bold">{data.totalSent}</p>
        </div>

        <div className="bg-slate-900 p-4 rounded-xl">
          <p className="text-slate-400 text-sm">Failed</p>

          <p className="text-2xl font-bold">{data.totalFailed}</p>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          {data.lastError ? (
            <XCircle className="text-red-400" />
          ) : (
            <CheckCircle className="text-green-400" />
          )}

          <h2 className="font-semibold">Last Sync</h2>
        </div>

        {data.lastSubmission ? (
          <div className="text-sm space-y-1">
            <p>
              Problem: {data.lastSubmission.title ?? data.lastSubmission.problemSlug ?? 'Unknown'}
            </p>

            <p>Language: {data.lastSubmission.language ?? '-'}</p>

            <p>Time: {data.lastSubmission.capturedAt ?? '-'}</p>
          </div>
        ) : (
          <p className="text-slate-400 text-sm">No submissions synced yet</p>
        )}
      </div>

      {data.lastError && (
        <div className="bg-red-950 border border-red-800 rounded-xl p-4">
          <p className="text-red-300 text-sm">{data.lastError}</p>
        </div>
      )}
    </div>
  );
}
