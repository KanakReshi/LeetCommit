import type { SubmissionPayload } from "./leetcode";
import type { GitHubConfig } from "./github";


export interface StorageSchema {


    enabled:boolean;


    github: GitHubConfig | null;


    totalDetected:number;


    totalSent:number;


    totalFailed:number;


    lastSubmission:
        SubmissionPayload | null;


    lastError:
        string | null;


    failedQueue:
        SubmissionPayload[];


    debug:boolean;

}




export const DEFAULT_STORAGE:StorageSchema = {


    enabled:true,


    github:null,


    totalDetected:0,


    totalSent:0,


    totalFailed:0,


    lastSubmission:null,


    lastError:null,


    failedQueue:[],


    debug:false

};