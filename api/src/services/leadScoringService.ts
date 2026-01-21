import { GoogleGenerativeAI } from '@google/generative-ai';
import { LeadModel } from '../models/LeadModel.js';
import { EmailLogModel } from '../models/EmailLogModel.js';
import { EmailReplyModel } from '../models/EmailReplyModel.js';
import type { Lead } from '../types/index.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });

interface LeadScoringFactors {
    emailEngagement: number; // 0-25 points
    eventHistory: number; // 0-25 points
    contactQuality: number; // 0-25 points
    companySize: number; // 0-25 points
}

export class LeadScoringService {
    /**
     * Calculate lead score for a single lead using AI analysis
     */
    static async calculateLeadScore(leadId: string): Promise<{ score: number; factors: LeadScoringFactors; reasoning: string }> {
        const lead = await LeadModel.getById(leadId);
        if (!lead) {
            throw new Error('Lead not found');
        }

        // Gather interaction data
        const emailLogs = await EmailLogModel.getByLeadId(leadId);
        const emailReplies = await EmailReplyModel.getByLeadId(leadId);

        // Build context for AI
        const context = this.buildScoringContext(lead, emailLogs, emailReplies);

        // Ask AI to score the lead
        const prompt = `You are a lead scoring AI for an event venue sales CRM (Ariyana Resort & Spa, Vietnam).

Analyze this lead and assign a quality score from 0-100 based on their potential value.

SCORING CRITERIA (0-100):
1. Email Engagement (0-25 points):
   - No emails sent: 5 points
   - Emails sent but no reply: 10 points
   - Lead replied once: 18 points
   - Multiple replies/active conversation: 25 points

2. Event History (0-25 points):
   - No events: 0 points
   - 1-2 total events: 8 points
   - 3-5 total events: 15 points
   - 6+ total events: 20 points
   - Has Vietnam events: +5 bonus points

3. Contact Quality (0-25 points):
   - Generic contact info: 5 points
   - Has valid email/phone: 12 points
   - Has decision maker title (Director, Manager, CEO): 20 points
   - Has LinkedIn profile: +5 bonus points

4. Company/Event Size (0-25 points):
   - Small (<50 delegates): 8 points
   - Medium (50-200 delegates): 15 points
   - Large (200-500 delegates): 22 points
   - Very Large (500+ delegates): 25 points
   - Unknown size: 10 points

LEAD DATA:
${context}

RESPOND WITH VALID JSON ONLY:
{
  "score": <total_score_0_to_100>,
  "factors": {
    "emailEngagement": <0_to_25>,
    "eventHistory": <0_to_25>,
    "contactQuality": <0_to_25>,
    "companySize": <0_to_25>
  },
  "reasoning": "<brief_explanation_of_scoring>"
}`;

        try {
            const result = await model.generateContent(prompt);
            const responseText = result.response.text();

            // Parse AI response
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Invalid AI response format');
            }

            const scoringResult = JSON.parse(jsonMatch[0]);

            // Validate score range
            const finalScore = Math.min(100, Math.max(0, scoringResult.score));

            return {
                score: finalScore,
                factors: scoringResult.factors,
                reasoning: scoringResult.reasoning,
            };
        } catch (error) {
            console.error('AI scoring error:', error);
            throw new Error('Failed to calculate lead score');
        }
    }

    /**
     * Calculate scores for multiple leads in batch
     */
    static async batchCalculateScores(leadIds: string[]): Promise<Map<string, number>> {
        const scores = new Map<string, number>();

        for (const leadId of leadIds) {
            try {
                const result = await this.calculateLeadScore(leadId);
                scores.set(leadId, result.score);

                // Update lead in database
                await LeadModel.update(leadId, {
                    lead_score: result.score,
                    last_score_update: new Date().toISOString(),
                });
            } catch (error) {
                console.error(`Failed to score lead ${leadId}:`, error);
                scores.set(leadId, 0);
            }
        }

        return scores;
    }

    /**
     * Build context string for AI analysis
     */
    private static buildScoringContext(lead: Lead, emailLogs: any[], emailReplies: any[]): string {
        return `
Company: ${lead.company_name}
Industry: ${lead.industry}
Country: ${lead.country}

Contact Person:
- Name: ${lead.key_person_name}
- Title: ${lead.key_person_title || 'N/A'}
- Email: ${lead.key_person_email || 'N/A'}
- Phone: ${lead.key_person_phone || 'N/A'}
- LinkedIn: ${lead.key_person_linkedin || 'N/A'}

Event History:
- Total Events: ${lead.total_events || 0}
- Vietnam Events: ${lead.vietnam_events || 0}
- Delegates: ${lead.number_of_delegates || 'Unknown'}

Email Interaction:
- Emails Sent: ${emailLogs.length}
- Replies Received: ${emailReplies.length}
- Last Contacted: ${lead.last_contacted || 'Never'}
- Status: ${lead.status}

Notes: ${lead.notes || 'None'}
`.trim();
    }

    /**
     * Get top scored leads
     */
    static async getTopScoredLeads(limit: number = 10): Promise<Lead[]> {
        const leads = await LeadModel.getAll();
        return leads
            .filter(lead => lead.lead_score !== null && lead.lead_score !== undefined)
            .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
            .slice(0, limit);
    }

    /**
     * Get score distribution statistics
     */
    static async getScoreDistribution(): Promise<{
        high: number; // 70-100
        medium: number; // 40-69
        low: number; // 0-39
        unscored: number;
    }> {
        const leads = await LeadModel.getAll();

        const distribution = {
            high: 0,
            medium: 0,
            low: 0,
            unscored: 0,
        };

        leads.forEach(lead => {
            const score = lead.lead_score;
            if (score === null || score === undefined) {
                distribution.unscored++;
            } else if (score >= 70) {
                distribution.high++;
            } else if (score >= 40) {
                distribution.medium++;
            } else {
                distribution.low++;
            }
        });

        return distribution;
    }
}
