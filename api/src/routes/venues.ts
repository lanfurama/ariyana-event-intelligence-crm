import type { Request, Response } from 'express';
import express from 'express';
import { VenueModel } from '../models/VenueModel.js';
import type { Venue } from '../types/index.js';
import { slugifyVenueName } from '../utils/bookingHelpers.js';

const router = express.Router();

// GET /api/venues - list venues (active only unless ?include_inactive=true)
router.get('/', async (req: Request, res: Response) => {
  try {
    const includeInactive = req.query.include_inactive === 'true';
    const venues = await VenueModel.getAll(includeInactive);
    res.json(venues);
  } catch (error: any) {
    console.error('Error fetching venues:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch venues' });
  }
});

// GET /api/venues/:id - get one venue
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const venue = await VenueModel.getById(req.params.id);
    if (!venue) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    res.json(venue);
  } catch (error: any) {
    console.error('Error fetching venue:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch venue' });
  }
});

// POST /api/venues - create a venue
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, slug } = req.body;
    if (!name || typeof name !== 'string' || name.trim() === '') {
      return res.status(400).json({ error: 'name is required' });
    }

    const venue = await VenueModel.create({
      id: `venue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: name.trim(),
      slug:
        typeof slug === 'string' && slug.trim() !== ''
          ? slugifyVenueName(slug)
          : slugifyVenueName(name),
      floor: req.body.floor,
      area_sqm: req.body.area_sqm,
      ceiling_height_m: req.body.ceiling_height_m,
      capacities: req.body.capacities || {},
      description: req.body.description,
      images: req.body.images || [],
      base_rates: req.body.base_rates || {},
      amenities: req.body.amenities || [],
      is_active: req.body.is_active !== undefined ? req.body.is_active : true,
      display_order: req.body.display_order || 0,
    });

    res.status(201).json(venue);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A venue with this slug already exists' });
    }
    console.error('Error creating venue:', error);
    res.status(500).json({ error: error.message || 'Failed to create venue' });
  }
});

// PUT /api/venues/:id - update a venue
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const updates: Partial<Venue> = {};

    if (req.body.name !== undefined) {
      if (typeof req.body.name !== 'string' || req.body.name.trim() === '') {
        return res.status(400).json({ error: 'name must be a non-empty string' });
      }
      updates.name = req.body.name.trim();
    }
    if (req.body.slug !== undefined) {
      if (typeof req.body.slug !== 'string' || req.body.slug.trim() === '') {
        return res.status(400).json({ error: 'slug must be a non-empty string' });
      }
      updates.slug = slugifyVenueName(req.body.slug);
    }
    if (req.body.floor !== undefined) updates.floor = req.body.floor;
    if (req.body.area_sqm !== undefined) updates.area_sqm = req.body.area_sqm;
    if (req.body.ceiling_height_m !== undefined)
      updates.ceiling_height_m = req.body.ceiling_height_m;
    if (req.body.capacities !== undefined) updates.capacities = req.body.capacities;
    if (req.body.description !== undefined) updates.description = req.body.description;
    if (req.body.images !== undefined) updates.images = req.body.images;
    if (req.body.base_rates !== undefined) updates.base_rates = req.body.base_rates;
    if (req.body.amenities !== undefined) updates.amenities = req.body.amenities;
    if (req.body.is_active !== undefined) updates.is_active = req.body.is_active;
    if (req.body.display_order !== undefined) updates.display_order = req.body.display_order;

    const updated = await VenueModel.update(req.params.id, updates);
    if (!updated) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    res.json(updated);
  } catch (error: any) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'A venue with this slug already exists' });
    }
    console.error('Error updating venue:', error);
    res.status(500).json({ error: error.message || 'Failed to update venue' });
  }
});

// DELETE /api/venues/:id - delete a venue (blocked while bookings reference it)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const deleted = await VenueModel.delete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Venue not found' });
    }
    res.status(204).send();
  } catch (error: any) {
    if (error.code === '23503') {
      return res.status(409).json({
        error: 'Venue is referenced by bookings - set is_active to false instead of deleting',
      });
    }
    console.error('Error deleting venue:', error);
    res.status(500).json({ error: error.message || 'Failed to delete venue' });
  }
});

export default router;
