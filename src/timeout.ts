import type { AbortController, FetchPerRequestOptions, FetchRequest } from './types/index';

export function addTimeout(
  request: FetchRequest,
  options: FetchPerRequestOptions | undefined,
  AbortController: new () => AbortController,
  timeout?: number,
): { timer?: any; abortController?: AbortController } {
  if (!AbortController && !options?.abortControllerFactory) {
    return {};
  }
  const abortController = options?.abortControllerFactory
    ? options.abortControllerFactory()
    : new AbortController();
  const timer = timeout ? setTimeout(() => abortController.abort(), timeout) : undefined;
  request.signal = abortController.signal;
  return { timer, abortController };
}
