-- Create table for department bonus points system
CREATE TABLE department_bonus_points (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  case_category INTEGER NOT NULL DEFAULT 0,
  urgency INTEGER NOT NULL DEFAULT 0,
  assistance INTEGER NOT NULL DEFAULT 0,
  qualification INTEGER NOT NULL DEFAULT 0,
  marketing INTEGER NOT NULL DEFAULT 0,
  crm INTEGER NOT NULL DEFAULT 0,
  improvements INTEGER NOT NULL DEFAULT 0,
  overtime INTEGER NOT NULL DEFAULT 0,
  leadership_bonus INTEGER NOT NULL DEFAULT 0,
  minus_points INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  user_id UUID NOT NULL,
  UNIQUE(employee_id, month)
);

-- Enable RLS
ALTER TABLE department_bonus_points ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can view all bonus points"
  ON department_bonus_points
  FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert bonus points"
  ON department_bonus_points
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update all bonus points"
  ON department_bonus_points
  FOR UPDATE
  USING (true);

CREATE POLICY "Authenticated users can delete all bonus points"
  ON department_bonus_points
  FOR DELETE
  USING (true);

-- Create trigger for updated_at
CREATE TRIGGER update_department_bonus_points_updated_at
  BEFORE UPDATE ON department_bonus_points
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create index for faster queries
CREATE INDEX idx_department_bonus_points_employee_month ON department_bonus_points(employee_id, month);
CREATE INDEX idx_department_bonus_points_month ON department_bonus_points(month);