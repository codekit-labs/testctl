// Pure: should we retry, given the last result's ok and how many retries we've already done?
export function shouldRetry(ok, retriesDone, maxRetries) {
  return !ok && retriesDone < maxRetries;
}
