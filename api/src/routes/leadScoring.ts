import { Router } from 'express';
import { LeadScoringService } from '../services/leadScoringService.js';

const router = Router();

// POST /api/lead-scoring/:id/calculate - Calculate score for a single lead
router.post('/:id/calculate', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await LeadScoringService.calculateLeadScore(id);

        // Update lead with new score
        const { LeadModel } = await import('../models/LeadModel.js');
        await LeadModel.update(id, {
            lead_score: result.score,
            last_score_update: new Date().toISOString(),
        });

        res.json({
            success: true,
            leadId: id,
            score: result.score,
            factors: result.factors,
            reasoning: result.reasoning,
        });
    } catch (error: any) {
        console.error('Error calculating lead score:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to calculate lead score'
        });
    }
});

// POST /api/lead-scoring/batch - Calculate scores for multiple leads
router.post('/batch', async (req, res) => {
    try {
        const { leadIds } = req.body as { leadIds: string[] };

        if (!Array.isArray(leadIds) || leadIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'leadIds array is required'
            });
        }

        const scores = await LeadScoringService.batchCalculateScores(leadIds);

        res.json({
            success: true,
            total: leadIds.length,
            scores: Object.fromEntries(scores),
        });
    } catch (error: any) {
        console.error('Error batch calculating scores:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to batch calculate scores'
        });
    }
});

// GET /api/lead-scoring/top - Get top scored leads
router.get('/top', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit as string) || 10;
        const topLeads = await LeadScoringService.getTopScoredLeads(limit);

        res.json({
            success: true,
            leads: topLeads,
        });
    } catch (error: any) {
        console.error('Error fetching top scored leads:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch top scored leads'
        });
    }
});

// GET /api/lead-scoring/distribution - Get score distribution statistics
router.get('/distribution', async (req, res) => {
    try {
        const distribution = await LeadScoringService.getScoreDistribution();

        res.json({
            success: true,
            distribution,
        });
    } catch (error: any) {
        console.error('Error fetching score distribution:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to fetch score distribution'
        });
    }
});

export default router;
