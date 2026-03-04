import type { EmailSendResult } from './types.js';

// ============================================================================
// Result Formatter
// ============================================================================

export class ResultFormatter {
  /**
   * Generate summary message based on result
   */
  static generateSummaryMessage(result: EmailSendResult): string {
    if (result.sent === 0 && result.failures.length > 0) {
      return 'Email campaign completed with no successful deliveries. Check failures for details.';
    }
    if (result.sent > 0 && result.failures.length === 0) {
      return 'All selected leads were contacted successfully.';
    }
    if (result.sent > 0 && result.failures.length > 0) {
      return 'Email campaign completed with partial success. Review failures for leads that need attention.';
    }
    return '';
  }
}
