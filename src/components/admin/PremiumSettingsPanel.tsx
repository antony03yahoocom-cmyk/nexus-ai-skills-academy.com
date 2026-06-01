import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { DollarSign, Save, AlertCircle } from 'lucide-react';

interface PremiumSettings {
  premium_price: number;
  live_class_link?: string;
}

export function PremiumSettingsPanel() {
  const qc = useQueryClient();
  const [premiumPrice, setPremiumPrice] = useState<string>('5000');
  const [liveClassLink, setLiveClassLink] = useState<string>('');

  // ✅ Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'premium_pricing')
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      
      const defaultSettings: PremiumSettings = {
        premium_price: 5000,
        live_class_link: '',
      };
      
      return ((data?.value as unknown) as PremiumSettings) || defaultSettings;
    },
  });

  // ✅ Update settings mutation
  const { mutate: updateSettings, isPending } = useMutation({
    mutationFn: async (newSettings: PremiumSettings) => {
      // ✅ Validate inputs
      if (newSettings.premium_price <= 0) {
        throw new Error('Premium price must be greater than 0');
      }

      if (newSettings.live_class_link && !isValidUrl(newSettings.live_class_link)) {
        throw new Error('Please enter a valid URL for live class link');
      }

      const { error } = await supabase
        .from('app_settings')
        .upsert(
          {
            key: 'premium_pricing',
            value: newSettings,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'key' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['app-settings'] });
      toast.success('✅ Premium settings updated successfully');
    },
    onError: (error) => {
      toast.error(`❌ Error: ${error instanceof Error ? error.message : 'Failed to update settings'}`);
    },
  });

  const handleSave = () => {
    updateSettings({
      premium_price: parseInt(premiumPrice) || 5000,
      live_class_link: liveClassLink.trim(),
    });
  };

  // ✅ Update local state when settings load
  if (settings && !isLoading) {
    if (premiumPrice === '5000' && settings.premium_price !== 5000) {
      setPremiumPrice(String(settings.premium_price));
    }
    if (!liveClassLink && settings.live_class_link) {
      setLiveClassLink(settings.live_class_link);
    }
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Premium Plan Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ✅ Premium Price Input */}
        <div>
          <label className="block text-sm font-medium mb-2">Premium Plan Price (KES)</label>
          <div className="flex gap-2">
            <Input
              type="number"
              value={premiumPrice}
              onChange={(e) => setPremiumPrice(e.target.value)}
              placeholder="Enter price in KES"
              min="100"
              step="100"
              className="flex-1"
              disabled={isPending}
            />
            <span className="text-muted-foreground text-sm pt-2">KES {parseInt(premiumPrice || '0').toLocaleString('en-KE')}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Current: KES {settings?.premium_price?.toLocaleString('en-KE') || 5000}</p>
        </div>

        {/* ✅ Live Class Link Input */}
        <div>
          <label className="block text-sm font-medium mb-2">Live Class Link (Optional)</label>
          <Input
            type="url"
            value={liveClassLink}
            onChange={(e) => setLiveClassLink(e.target.value)}
            placeholder="e.g., https://meet.google.com/abc-defg-hij"
            disabled={isPending}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {liveClassLink ? '✅ Link configured' : 'Not configured'}
          </p>
        </div>

        {/* ✅ Security Warning */}
        <div className="flex gap-2 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
          <AlertCircle className="w-4 h-4 text-yellow-600 shrink-0 mt-0.5" />
          <div className="text-xs text-yellow-700">
            <p className="font-medium">Security Notice:</p>
            <p>Only paste HTTPS URLs from trusted video conference providers (Google Meet, Zoom, Microsoft Teams).</p>
          </div>
        </div>

        {/* ✅ Save Button */}
        <Button
          onClick={handleSave}
          disabled={isPending || isLoading}
          className="w-full"
          variant="hero"
        >
          <Save className="w-4 h-4 mr-2" />
          {isPending ? 'Saving...' : 'Save Settings'}
        </Button>
      </CardContent>
    </Card>
  );
}

// ✅ URL validation helper
function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}
