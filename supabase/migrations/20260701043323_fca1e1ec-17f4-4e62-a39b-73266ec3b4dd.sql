
-- project-files: allow owners to UPDATE and DELETE their own files (path first segment = user id)
CREATE POLICY "Owners can update their project files"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'project-files' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'project-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Owners can delete their project files"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'project-files' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- whatsapp_message_log: allow users to read their own log rows
CREATE POLICY "Users can view their own whatsapp log"
ON public.whatsapp_message_log FOR SELECT TO authenticated
USING (user_id = auth.uid());
