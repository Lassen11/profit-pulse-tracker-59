-- Update handle_new_user function to include middle_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name, middle_name, position, department)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'middle_name', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'position', ''),
    COALESCE(NEW.raw_user_meta_data ->> 'department', '')
  );
  RETURN NEW;
END;
$function$;