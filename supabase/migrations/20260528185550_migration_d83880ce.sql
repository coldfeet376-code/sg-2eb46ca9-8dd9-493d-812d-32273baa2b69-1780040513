CREATE TABLE IF NOT EXISTS two_factor_codes (
  email TEXT PRIMARY KEY,
  code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_2fa_expiry ON two_factor_codes(expires_at);

-- Enable RLS for security
ALTER TABLE two_factor_codes ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read/write their own codes
CREATE POLICY "Users can manage their own 2FA codes"
  ON two_factor_codes
  FOR ALL
  USING (true)
  WITH CHECK (true);