import {StorageService} from '../services/StorageService';
export async function loginWithGithub(){return;}
export async function refreshSession(){return (await StorageService.getToken()).accessToken;}
