/**
 * Error type wrapping provider SDK errors with provider attribution.
 */
export class AiProviderError extends Error {
  constructor(
    public readonly provider: 'gemini' | 'openai',
    public override readonly cause: unknown,
    message: string,
  ) {
    super(message);
  }
}

/**
 * Extract retry-after delay (seconds) from a provider rate-limit error.
 * Moved verbatim from api/src/routes/{gemini,gpt}.ts.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const extractRetryDelay = (error: any): number | null => {
  try {
    const errorMessage = error.message || JSON.stringify(error);
    const retryMatch = errorMessage.match(/Please retry in ([\d.]+)s/i);
    if (retryMatch && retryMatch[1]) {
      return Math.ceil(parseFloat(retryMatch[1]));
    }

    // Check error.details
    if (error.details) {
      for (const detail of error.details) {
        if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && detail.retryDelay) {
          const delayStr = detail.retryDelay;
          const secondsMatch = delayStr.match(/(\d+)s/);
          if (secondsMatch) {
            return parseInt(secondsMatch[1]);
          }
        }
      }
    }

    // Check error.error.details (nested structure from Google API)
    if (error.error?.details) {
      for (const detail of error.error.details) {
        if (detail['@type'] === 'type.googleapis.com/google.rpc.RetryInfo' && detail.retryDelay) {
          const delayStr = detail.retryDelay;
          const secondsMatch = delayStr.match(/(\d+)s/);
          if (secondsMatch) {
            return parseInt(secondsMatch[1]);
          }
        }
      }
    }

    // Try parsing from error.error.message
    if (error.error?.message) {
      const errorMsg = error.error.message;
      const retryMatch = errorMsg.match(/Please retry in ([\d.]+)s/i);
      if (retryMatch && retryMatch[1]) {
        return Math.ceil(parseFloat(retryMatch[1]));
      }
    }
  } catch (e) {
    console.error('Error parsing retry delay:', e);
  }
  return null;
};
