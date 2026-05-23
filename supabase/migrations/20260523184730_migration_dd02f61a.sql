-- Create rotas table to store generated schedules (replacing localStorage)
CREATE TABLE IF NOT EXISTS rotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  assignments JSONB NOT NULL,
  fairness_metrics JSONB,
  locked_count INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(week_start)
);

-- Enable RLS
ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can do everything
CREATE POLICY "auth_select_rotas" ON rotas FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_rotas" ON rotas FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth_update_rotas" ON rotas FOR UPDATE USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_delete_rotas" ON rotas FOR DELETE USING (auth.uid() IS NOT NULL);

-- Create audit_log table to track all changes
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Policies: authenticated users can read all, but only insert their own
CREATE POLICY "auth_select_audit" ON audit_log FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "auth_insert_audit" ON audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_rotas_week_start ON rotas(week_start);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

-- Add trigger to update updated_at on rotas
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_rotas_updated_at BEFORE UPDATE ON rotas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();