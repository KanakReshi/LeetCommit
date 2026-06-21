import type { SubmissionPayload } from "./leetcode";
import type { GitHubConfig } from "./github";


export type ExtensionMessage =

    | {
        type: "SUBMISSION_ACCEPTED";
        payload: SubmissionPayload;
    }

    | {
        type: "GET_STATUS";
    }

    | {
        type: "GET_CONFIG";
    }

    | {
        type: "UPDATE_CONFIG";
        payload: {
            github?: GitHubConfig;
            enabled?: boolean;
        };
    }

    | {
        type: "RETRY_FAILED";
    }

    | {
        type: "LOGOUT";
    };




export type ExtensionResponse =


    | {
        type: "OK";
        message?: string;
    }


    | {
        type: "ERROR";
        message: string;
    }


    | {
        type: "STATUS_RESPONSE";

        payload: {

            totalDetected: number;
            totalSent: number;
            totalFailed: number;

            lastSubmission:
                SubmissionPayload | null;

            lastError:
                string | null;

            enabled:boolean;

        };
    }



    | {
        type:"CONFIG_RESPONSE";

        payload:{
            github:
                GitHubConfig | null;

            enabled:boolean;
        }
    };