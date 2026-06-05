import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { ExternalLink, Video } from 'lucide-react';

interface LiveClassLink {
  link: string;
  updated_at: string;
}

/**
 * ✅ Component to display live class link when admin has configured it
 * Only shows button if link exists and is valid HTTPS URL
 */
export function LiveClassButton() {
  const { isAdmin } = useAuth();
  
  const { data: liveLink } = useQuery({
    queryKey: ['live-class-link'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'premium_pricing')
        .maybeSingle();

      if (error && error.code !== 'PGRST116') throw error;
      
      const settings = data?.value as any;
      if (settings?.live_class_link && isValidHttpsUrl(settings.live_class_link)) {
        return settings.live_class_link;
      }
      
      return null;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  if (!liveLink) return null;

  return (
    <Button
      onClick={() => {
        // ✅ Open in new tab with no referrer for security
        const newWindow = window.open(liveLink, '_blank', 'noopener,noreferrer');
        if (newWindow) newWindow.opener = null;
      }}
      variant="hero"
      className="gap-2"
    >
      <Video className="w-4 h-4" />
      Join Live Class
      <ExternalLink className="w-3 h-3 ml-1" />
    </Button>
  );
}

// ✅ Strict HTTPS URL validation
function isValidHttpsUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
