
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_wa text;
BEGIN
  v_wa := COALESCE(
    NEW.raw_user_meta_data->>'whatsapp_number',
    NEW.raw_user_meta_data->>'phone',
    ''
  );
  INSERT INTO public.profiles (user_id, full_name, phone, whatsapp_number, whatsapp_opted_in, trial_start_date)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    v_wa,
    NULLIF(v_wa, ''),
    v_wa <> '',
    now()
  );
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user');
  RETURN NEW;
END;
$function$;
