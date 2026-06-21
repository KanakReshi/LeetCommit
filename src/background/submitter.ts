/**
 * Submission submitter with retry queue.
 *
 * - Sends accepted submissions directly to GitHub.
 * - No backend/server/database required.
 * - Failed submissions are stored locally.
 * - Implements retry with exponential backoff.
 */

import type { SubmissionPayload } from '@/types/leetcode';

import { sendSubmissionToGithub } from '../utils/github';
import { getStorage, setStorage, incrementCounter } from '@/utils/storage';

import { RETRY_CONFIG } from '@/constants';
import { createLogger } from '@/utils/logger';


const log = createLogger('Submitter');



/**
 * Process detected LeetCode submission
 */
export async function submitSubmission(
    payload: SubmissionPayload
): Promise<void> {


    await incrementCounter('totalDetected');

    await setStorage({
        lastSubmission: payload,
        lastError: null
    });



    const success = await attemptSendWithRetries(payload);



    if(success){

        await incrementCounter('totalSent');

        log.info(
            'Submission synced successfully to GitHub'
        );


    }else{


        await incrementCounter('totalFailed');

        await addToFailedQueue(payload);


        log.warn(
            'Submission added to retry queue'
        );

    }

}




/**
 * Retry failed submissions
 */
export async function retryFailed(): Promise<number>{


    const {
        failedQueue = []
    } = await getStorage([
        'failedQueue'
    ]);



    if(failedQueue.length === 0){

        log.info(
            'No failed submissions'
        );

        return 0;
    }



    let successCount = 0;


    const remaining: SubmissionPayload[] = [];



    for(const submission of failedQueue){


        const success =
            await attemptSendWithRetries(submission);



        if(success){

            successCount++;

            await incrementCounter(
                'totalSent'
            );


        }else{

            remaining.push(submission);

        }

    }




    await setStorage({

        failedQueue: remaining,

        totalFailed: remaining.length

    });



    return successCount;

}




/**
 * Retry wrapper
 */
async function attemptSendWithRetries(
    payload: SubmissionPayload
): Promise<boolean>{



    for(
        let attempt = 0;
        attempt < RETRY_CONFIG.MAX_RETRIES;
        attempt++
    ){



        if(attempt > 0){


            const delay =
                Math.min(

                    RETRY_CONFIG.BASE_DELAY_MS *
                    Math.pow(2, attempt - 1),

                    RETRY_CONFIG.MAX_DELAY_MS

                );



            log.info(
                `Retry ${attempt + 1}/${RETRY_CONFIG.MAX_RETRIES} after ${delay}ms`
            );



            await sleep(delay);

        }



        try{


            const result =
                await sendSubmissionToGithub(payload);



            if(result.success){

                return true;

            }



            await setStorage({

                lastError:
                    result.message ?? 
                    'GitHub sync failed'

            });



        }catch(error){



            log.error(
                'GitHub sync error',
                error
            );


            await setStorage({

                lastError:
                    String(error)

            });


        }


    }



    return false;

}





/**
 * Add failed submission to local queue
 */
async function addToFailedQueue(
    payload: SubmissionPayload
): Promise<void>{


    const {
        failedQueue = []
    } = await getStorage([
        'failedQueue'
    ]);



    const updated = [

        ...failedQueue,

        payload

    ];



    await setStorage({

        failedQueue:
            updated.slice(-100)

    });


}






function sleep(
    ms:number
):Promise<void>{

    return new Promise(
        resolve =>
            setTimeout(resolve,ms)
    );

}