import nodemailer from 'nodemailer';
import { EMAIL_CONFIG } from './config.js';

// ============================================================================
// Email Transporter Management
// ============================================================================

export class EmailTransporter {
  private static instance: nodemailer.Transporter | null = null;
  private static initError: string | null = null;

  static getInstance(): nodemailer.Transporter | null {
    if (this.instance) {
      return this.instance;
    }

    if (!EMAIL_CONFIG.HOST || !EMAIL_CONFIG.USER || !EMAIL_CONFIG.PASSWORD) {
      this.initError = 'Email credentials are not fully configured. Please set EMAIL_HOST, EMAIL_HOST_USER, and EMAIL_HOST_PASSWORD.';
      return null;
    }

    this.instance = nodemailer.createTransport({
      host: EMAIL_CONFIG.HOST,
      port: EMAIL_CONFIG.PORT,
      secure: EMAIL_CONFIG.PORT === 465,
      auth: {
        user: EMAIL_CONFIG.USER,
        pass: EMAIL_CONFIG.PASSWORD,
      },
      connectionTimeout: 0,
      greetingTimeout: 0,
      socketTimeout: 0,
      pool: true,
      maxConnections: 1,
      maxMessages: 3,
    });

    return this.instance;
  }

  static getInitError(): string | null {
    return this.initError;
  }
}

export function getTransporter(): nodemailer.Transporter | null {
  return EmailTransporter.getInstance();
}
