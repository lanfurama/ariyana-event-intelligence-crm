-- Migration: Smart venue booking - venues, bookings, booking_spaces, quotes, quote_items
-- Created: 2026-07-16
-- Spec: docs/superpowers/specs/2026-07-16-smart-venue-booking-design.md (section 4)
-- Runner notes: executed by runMigrationGeneric.ts (naive splitter) - no dollar-quoting,
--   no triggers, no DO blocks, no apostrophes outside string literals, no semicolons in comments.
-- Requires btree_gist (varchar equality inside the GiST exclusion constraint).
--   If CREATE EXTENSION fails with a permission error, run it once as a superuser, then re-run.

CREATE EXTENSION IF NOT EXISTS btree_gist;

-- Space inventory
CREATE TABLE IF NOT EXISTS venues (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(255) NOT NULL UNIQUE,
    floor VARCHAR(50),
    area_sqm NUMERIC(8,1),
    ceiling_height_m NUMERIC(4,1),
    capacities JSONB NOT NULL DEFAULT '{}',
    description TEXT,
    images JSONB NOT NULL DEFAULT '[]',
    base_rates JSONB NOT NULL DEFAULT '{}',
    amenities JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    display_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Global sequence backing booking codes (ARY-YYYY-NNNN). No per-year reset:
-- uniqueness comes from the sequence, the year part is informational.
CREATE SEQUENCE IF NOT EXISTS booking_code_seq START 1;

-- One rental / event. May span multiple spaces and days via booking_spaces.
CREATE TABLE IF NOT EXISTS bookings (
    id VARCHAR(255) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    lead_id VARCHAR(255) REFERENCES leads(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    event_type VARCHAR(100),
    status VARCHAR(20) NOT NULL DEFAULT 'inquiry' CHECK (status IN ('inquiry', 'hold', 'quoted', 'confirmed', 'completed', 'cancelled')),
    expected_guests INTEGER,
    layout VARCHAR(50),
    notes TEXT,
    source VARCHAR(20) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'portal', 'email_ai')),
    created_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Venue x time-range lines under a booking. Event times are TIMESTAMPTZ
-- (Vercel runs UTC, operations are Asia/Ho_Chi_Minh - naive timestamps would shift).
-- block_start_at / block_end_at = event range widened by setup / teardown buffers.
-- They are physical columns maintained by BookingModel because timestamptz +/- interval
-- is STABLE (not IMMUTABLE) and therefore illegal inside a constraint expression.
-- booking_status is a denormalized copy of bookings.status, synced in the same
-- transaction by BookingModel - exclusion constraints cannot reference another table.
CREATE TABLE IF NOT EXISTS booking_spaces (
    id SERIAL PRIMARY KEY,
    booking_id VARCHAR(255) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    venue_id VARCHAR(255) NOT NULL REFERENCES venues(id),
    start_at TIMESTAMPTZ NOT NULL,
    end_at TIMESTAMPTZ NOT NULL,
    setup_minutes INTEGER NOT NULL DEFAULT 0 CHECK (setup_minutes >= 0),
    teardown_minutes INTEGER NOT NULL DEFAULT 0 CHECK (teardown_minutes >= 0),
    block_start_at TIMESTAMPTZ NOT NULL,
    block_end_at TIMESTAMPTZ NOT NULL,
    booking_status VARCHAR(20) NOT NULL DEFAULT 'inquiry',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CHECK (end_at > start_at),
    CHECK (block_start_at <= start_at),
    CHECK (block_end_at >= end_at)
);

-- The core invariant: two confirmed bookings can never overlap on the same venue.
-- Half-open ranges: back-to-back bookings (12:00 end, 12:00 start) do not conflict.
-- hold / quoted overlaps are allowed on purpose (MICE 1st / 2nd option practice) and
-- surface as API warnings instead.
ALTER TABLE booking_spaces ADD CONSTRAINT booking_spaces_no_confirmed_overlap
    EXCLUDE USING gist (
        venue_id WITH =,
        tstzrange(block_start_at, block_end_at) WITH &&
    ) WHERE (booking_status = 'confirmed');

-- Quotes: schema lands now for stability, API + UI arrive in Phase 2.
CREATE TABLE IF NOT EXISTS quotes (
    id VARCHAR(255) PRIMARY KEY,
    booking_id VARCHAR(255) NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    version INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'expired')),
    currency VARCHAR(10) NOT NULL DEFAULT 'VND',
    subtotal NUMERIC(14,0) NOT NULL DEFAULT 0,
    discount_pct NUMERIC(5,2) NOT NULL DEFAULT 0,
    vat_pct NUMERIC(5,2) NOT NULL DEFAULT 8,
    total NUMERIC(14,0) NOT NULL DEFAULT 0,
    valid_until DATE,
    sent_at TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS quote_items (
    id SERIAL PRIMARY KEY,
    quote_id VARCHAR(255) NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL DEFAULT 'other' CHECK (kind IN ('venue', 'fnb', 'av', 'service', 'other')),
    description VARCHAR(500) NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_price NUMERIC(14,0) NOT NULL DEFAULT 0,
    amount NUMERIC(14,0) NOT NULL DEFAULT 0,
    sort_order INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_booking_spaces_booking_id ON booking_spaces(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_spaces_venue_window ON booking_spaces(venue_id, block_start_at, block_end_at);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_lead_id ON bookings(lead_id);
CREATE INDEX IF NOT EXISTS idx_quotes_booking_id ON quotes(booking_id);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);

-- Seed venues. ALL capacities and rates are PLACEHOLDER round numbers based on
-- public information about Ariyana Convention Centre - correct them in the Venues UI.
INSERT INTO venues (id, name, slug, floor, area_sqm, ceiling_height_m, capacities, description, images, base_rates, amenities, is_active, display_order) VALUES
('venue-grand-ballroom', 'Grand Ballroom', 'grand-ballroom', 'GF', 2000.0, 12.0, '{"theatre": 2500, "classroom": 1400, "banquet": 1200, "cocktail": 2000}', 'Flagship pillar-free ballroom for congresses, gala dinners and large exhibitions (placeholder figures - edit in the Venues UI)', '[]', '{"hourly": 30000000, "half_day": 120000000, "full_day": 200000000}', '["Stage", "LED wall", "AV system", "Simultaneous interpretation booths", "Wi-Fi"]', true, 1),
('venue-summit-hall', 'Summit Hall', 'summit-hall', '2F', 700.0, 6.0, '{"theatre": 500, "classroom": 300, "banquet": 350, "cocktail": 500, "boardroom": 60}', 'Signature summit room that hosted the APEC 2017 leaders meeting (placeholder figures - edit in the Venues UI)', '[]', '{"hourly": 12000000, "half_day": 50000000, "full_day": 90000000}', '["AV system", "VIP holding room", "Wi-Fi"]', true, 2),
('venue-hoi-an-1', 'Hoi An 1', 'hoi-an-1', '1F', 150.0, 4.0, '{"theatre": 120, "classroom": 70, "banquet": 80, "cocktail": 100, "ushape": 45, "boardroom": 50}', 'Mid-size meeting room for workshops and breakouts (placeholder figures - edit in the Venues UI)', '[]', '{"hourly": 4000000, "half_day": 15000000, "full_day": 25000000}', '["Projector", "Wi-Fi"]', true, 3),
('venue-hoi-an-2', 'Hoi An 2', 'hoi-an-2', '1F', 150.0, 4.0, '{"theatre": 120, "classroom": 70, "banquet": 80, "cocktail": 100, "ushape": 45, "boardroom": 50}', 'Mid-size meeting room for workshops and breakouts (placeholder figures - edit in the Venues UI)', '[]', '{"hourly": 4000000, "half_day": 15000000, "full_day": 25000000}', '["Projector", "Wi-Fi"]', true, 4),
('venue-my-son-1', 'My Son 1', 'my-son-1', '1F', 100.0, 4.0, '{"theatre": 80, "classroom": 45, "ushape": 30, "boardroom": 35}', 'Breakout meeting room (placeholder figures - edit in the Venues UI)', '[]', '{"hourly": 3000000, "half_day": 10000000, "full_day": 18000000}', '["Projector", "Wi-Fi"]', true, 5),
('venue-my-son-2', 'My Son 2', 'my-son-2', '1F', 100.0, 4.0, '{"theatre": 80, "classroom": 45, "ushape": 30, "boardroom": 35}', 'Breakout meeting room (placeholder figures - edit in the Venues UI)', '[]', '{"hourly": 3000000, "half_day": 10000000, "full_day": 18000000}', '["Projector", "Wi-Fi"]', true, 6),
('venue-prefunction-foyer', 'Pre-function Foyer', 'prefunction-foyer', 'GF', 1000.0, 8.0, '{"cocktail": 800}', 'Exhibition and registration space adjoining the Grand Ballroom (placeholder figures - edit in the Venues UI)', '[]', '{"half_day": 40000000, "full_day": 70000000}', '["Exhibition power grid", "Wi-Fi"]', true, 7),
('venue-ariyana-lawn', 'Ariyana Lawn', 'ariyana-lawn', 'Outdoor', 1500.0, NULL, '{"theatre": 1200, "banquet": 600, "cocktail": 1000}', 'Beachside outdoor lawn for gala dinners and receptions (placeholder figures - edit in the Venues UI)', '[]', '{"half_day": 45000000, "full_day": 80000000}', '["Open air", "Power supply"]', true, 8)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE venues IS 'Rentable spaces of the convention centre (seeded with placeholder figures)';
COMMENT ON TABLE bookings IS 'Venue rental bookings - one row per rental or event';
COMMENT ON TABLE booking_spaces IS 'Venue x time-range lines under a booking, guarded by a GiST exclusion constraint for confirmed overlaps';
COMMENT ON TABLE quotes IS 'Versioned quotes per booking (Phase 2 surface)';
COMMENT ON TABLE quote_items IS 'Line items of a quote in VND';
