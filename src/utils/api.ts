import type { SubmissionPayload } from '@/types/leetcode';
import { StorageService } from '@/services/StorageService';
import { createLogger } from './logger';
const log=createLogger('GitHubSync');

export async function sendSubmission(payload: SubmissionPayload): Promise<{success:boolean;message:string}> {
 const token = await StorageService.getToken();
 if(!token.accessToken) return {success:false,message:'Add GitHub token first'};
 try {
  const owner = token.githubUsername;
  const repo = token.repo || 'leetcode-solutions';
  const path = `solutions/${payload.problem.questionId}.${extension(payload.submission.language)}`;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
  const content = btoa(unescape(encodeURIComponent(payload.submission.code)));
  const r = await fetch(url,{method:'PUT',headers:{Authorization:`Bearer ${token.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({message:`Solve ${payload.problem.titleSlug}`,content})});
  if(!r.ok) return {success:false,message:await r.text()};
  return {success:true,message:'Committed to GitHub'};
 } catch(e){log.error(e);return {success:false,message:String(e)}}
}
function extension(l:string){return l?.toLowerCase().includes('python')?'py':l?.toLowerCase().includes('java')?'java':'cpp'}
