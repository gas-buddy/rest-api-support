import type { FetchError, FetchRequest } from './types/index';

const RETRY_COUNTER = Symbol('Retry counter for network errors');

interface FetchRequestPlus extends FetchRequest {
  [RETRY_COUNTER]: number;
}

export async function autoRetry(request: FetchRequest, error: Error) {
  const requestPlus = request as FetchRequestPlus;
  const count = requestPlus[RETRY_COUNTER] || 0;
  if (count < 3 && ['ECONNREFUSED', 'EAI_AGAIN'].includes((error as FetchError).errno)) {
    await new Promise((accept) => {
      setTimeout(accept, [50, 100, 250][count]);
    });
    requestPlus[RETRY_COUNTER] = count + 1;
    return true;
  }
  return false;
}

export function retryCount(request: FetchRequest) {
  const requestPlus = request as FetchRequestPlus;
  return requestPlus[RETRY_COUNTER] || 0;
}
