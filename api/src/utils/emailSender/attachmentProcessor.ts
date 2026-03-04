import type { NodemailerAttachment } from './types.js';

// ============================================================================
// Attachment Processing
// ============================================================================

export class AttachmentProcessor {
  /**
   * Convert attachments to nodemailer format
   */
  static convertToNodemailerFormat(
    attachments: Array<{ name: string; file_data: string; type?: string }>
  ): NodemailerAttachment[] {
    return attachments
      .filter(att => {
        if (!att.file_data || att.file_data.trim() === '') {
          console.warn(`[AttachmentProcessor] Skipping attachment "${att.name}" - no file data`);
          return false;
        }
        return true;
      })
      .map(att => {
        let base64Data = att.file_data.trim();
        if (base64Data.includes(',')) {
          base64Data = base64Data.split(',')[1];
        }

        if (!base64Data || base64Data.trim() === '') {
          throw new Error(`Attachment "${att.name}" has invalid base64 data`);
        }

        try {
          const buffer = Buffer.from(base64Data, 'base64');
          console.log(`[AttachmentProcessor] Attachment "${att.name}": ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
          return {
            filename: att.name,
            content: buffer,
            contentType: att.type || 'application/octet-stream',
          };
        } catch (bufferError: any) {
          console.warn(`[AttachmentProcessor] Buffer conversion failed for ${att.name}, using base64 string:`, bufferError.message);
          return {
            filename: att.name,
            content: base64Data,
            encoding: 'base64' as const,
            contentType: att.type || 'application/octet-stream',
          };
        }
      });
  }

  /**
   * Extract file attachments (exclude links)
   */
  static extractFileAttachments(
    attachments?: Array<{ name: string; type: string; file_data?: string }>
  ): NodemailerAttachment[] {
    if (!attachments) return [];

    const result: NodemailerAttachment[] = [];

    for (const att of attachments) {
      if (att.type === 'link') continue;

      const base64Data = att.file_data?.includes(',')
        ? att.file_data.split(',')[1]
        : att.file_data;

      if (!base64Data) continue;

      try {
        const buffer = Buffer.from(base64Data, 'base64');
        result.push({
          filename: att.name,
          content: buffer,
          contentType: att.type || 'application/octet-stream',
        });
      } catch {
        result.push({
          filename: att.name,
          content: base64Data,
          encoding: 'base64' as const,
          contentType: att.type || 'application/octet-stream',
        });
      }
    }

    return result;
  }

  /**
   * Extract link attachments and convert to HTML
   */
  static extractLinksAsHtml(
    attachments?: Array<{ name: string; type: string; file_data?: string }>
  ): string {
    if (!attachments) return '';

    const links = attachments.filter(att => att.type === 'link');
    if (links.length === 0) return '';

    const linksHtml = links.map(link => {
      const linkName = link.file_data || link.name;
      const linkUrl = link.name;
      return `
        <div style="margin: 4px 0; padding: 12px 16px; background-color: #f0f0f0; border: 1px solid #d1d5db; border-radius: 6px; display: inline-block; max-width: 100%;">
          <span style="font-size: 18px; margin-right: 8px; vertical-align: middle;">📁</span>
          <a href="${linkUrl}" target="_blank" style="color: #374151; text-decoration: underline; font-size: 14px; vertical-align: middle;">${linkName}</a>
        </div>
      `;
    }).join('');

    return `<div style="margin-top: 2px;">${linksHtml}</div>`;
  }
}
