-- Add termination_date column to profiles table
ALTER TABLE public.profiles
ADD COLUMN termination_date DATE;

-- Add comment to explain the column
COMMENT ON COLUMN public.profiles.termination_date IS 'Date when the employee was terminated/archived';

-- Create index for better query performance when filtering by termination date
CREATE INDEX idx_profiles_termination_date ON public.profiles(termination_date);