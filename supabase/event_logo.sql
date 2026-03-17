-- Add logo_url to events table
ALTER TABLE events ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE events ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '#0B3D91';
ALTER TABLE events ADD COLUMN IF NOT EXISTS secondary_color TEXT DEFAULT '#D62828';

-- To set your logo, run:
-- UPDATE events SET logo_url = 'https://your-logo-url.png' WHERE id = 1;

-- Add updated_at to events
ALTER TABLE events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
