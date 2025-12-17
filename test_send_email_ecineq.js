/**
 * Test script to send email to youngbuffaok2@gmail.com
 * with lead data from "Society for the Study of Economic Inequality -ECINEQ-"
 * 
 * Usage:
 *   node test_send_email_ecineq.js
 * 
 * Make sure to set up email configuration in .env file first
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Lead data from ECINEQ
const leadData = {
  company_name: "Society for the Study of Economic Inequality -ECINEQ-",
  industry: "Economics",
  country: "Italy",
  city: "Rome",
  website: "https://www.ecineq.org/",
  key_person_name: "Flaviana Palmisano",
  key_person_title: "Secretariat",
  key_person_email: "flaviana.palmisano@uniroma1.it",
  number_of_delegates: 250,
  past_events_history: "Rome, Italy | DISTINCT COUNTRIES: 1 (italy)"
};

// Build email content
const salutation = leadData.key_person_name ? `Dear ${leadData.key_person_name},` : 'Dear Event Organizer,';
const location = [leadData.city, leadData.country].filter(Boolean).join(', ');
const industryLine = leadData.industry 
  ? `As a key organization in the ${leadData.industry} sector,` 
  : 'As a leading international association,';
const historyLine = leadData.past_events_history
  ? `We have reviewed your past events (${leadData.past_events_history}) and believe Danang offers a compelling rotation option in Asia.`
  : 'We believe Danang offers a compelling rotation option in Asia for your future meetings.';
const delegatesLine = leadData.number_of_delegates
  ? `Our convention centre can comfortably host ${leadData.number_of_delegates}+ delegates with premium meeting facilities, breakout rooms, and exhibition space.`
  : 'Our convention centre offers premium meeting facilities, breakout rooms, and exhibition space tailored for international congresses.';

const textBody = [
  salutation,
  '',
  `${industryLine} we would like to invite ${leadData.company_name} to consider Danang, Vietnam for an upcoming edition.`,
  '',
  historyLine,
  delegatesLine,
  location ? `We understand your community engages stakeholders across ${location} and would love to partner with you on a future edition.` : '',
  '',
  'Ariyana Convention Centre Danang is the award-winning venue that proudly hosted APEC 2017. Our experienced international team is ready to support your bidding process and tailor a proposal to your requirements.',
  '',
  'May we arrange a short call to discuss how we can support your next event in Vietnam?',
  '',
  'Warm regards,',
  'Sales & Marketing Team',
  'Ariyana Convention Centre Danang',
  process.env.EMAIL_FROM || 'marketing@furamavietnam.com',
]
  .filter(Boolean)
  .join('\n');

const htmlBody = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background-color: #1e40af; color: white; padding: 20px; text-align: center; }
    .content { padding: 20px; background-color: #f9fafb; }
    .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    .highlight { color: #1e40af; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>Ariyana Convention Centre Danang</h2>
    </div>
    <div class="content">
      <p>${salutation}</p>
      <p>${industryLine} we would like to invite <strong>${leadData.company_name}</strong> to consider Danang, Vietnam for an upcoming edition.</p>
      <p>${historyLine}</p>
      <p>${delegatesLine}</p>
      ${location ? `<p>We understand your community engages stakeholders across <strong>${location}</strong> and would love to partner with you on a future edition.</p>` : ''}
      <p><strong>Ariyana Convention Centre Danang</strong> is the award-winning venue that proudly hosted <strong>APEC 2017</strong>. Our experienced international team is ready to support your bidding process and tailor a proposal to your requirements.</p>
      <p>May we arrange a short call to discuss how we can support your next event in Vietnam?</p>
      <p>Warm regards,<br>
      Sales & Marketing Team<br>
      Ariyana Convention Centre Danang<br>
      <a href="mailto:${process.env.EMAIL_FROM || 'marketing@furamavietnam.com'}">${process.env.EMAIL_FROM || 'marketing@furamavietnam.com'}</a></p>
    </div>
    <div class="footer">
      <p>This is a test email sent to: youngbuffaok2@gmail.com</p>
      <p>Lead: ${leadData.company_name}</p>
    </div>
  </div>
</body>
</html>
`;

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Send email
async function sendTestEmail() {
  try {
    console.log('📧 Preparing to send test email...');
    console.log('   To: youngbuffaok2@gmail.com');
    console.log('   Lead: Society for the Study of Economic Inequality -ECINEQ-');
    
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM 
        ? `"Ariyana Convention Centre" <${process.env.EMAIL_FROM}>`
        : '"Ariyana Convention Centre" <marketing@furamavietnam.com>',
      to: 'youngbuffaok2@gmail.com',
      subject: `Proposal to host ${leadData.company_name} event at Ariyana Convention Centre`,
      text: textBody,
      html: htmlBody,
    });
    
    console.log('✅ Email sent successfully!');
    console.log('   Message ID:', info.messageId);
    console.log('   Response:', info.response);
  } catch (error) {
    console.error('❌ Error sending email:', error);
    console.error('   Make sure SMTP credentials are set in .env file');
  }
}

// Run
sendTestEmail();

