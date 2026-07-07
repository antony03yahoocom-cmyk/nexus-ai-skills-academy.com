import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

/**
 * WhatsAppPrompt — shown once per session to authenticated users who don't
 * have a WhatsApp number saved on their profile. Non-blocking (can be skipped
 * for the session) but re-appears on next login until the number is provided.
 */
const WhatsAppPrompt = () => {
  const { user, profile, refreshProfile, loading } = useAuth();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (loading || !user || !profile) return;
    const hasWa = !!(profile as any).whatsapp_number?.trim();
    const dismissed = sessionStorage.getItem("wa_prompt_dismissed") === "1";
    if (!hasWa && !dismissed) setOpen(true);
  }, [user, profile, loading]);

  const save = async () => {
    const trimmed = value.trim();
    if (!trimmed) {
      toast.error("Please enter a valid WhatsApp number.");
      return;
    }
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({ whatsapp_number: trimmed, whatsapp_opted_in: true, phone: trimmed })
      .eq("user_id", user.id);
    setSaving(false);
    if (error) {
      toast.error(error.message || "Couldn't save your WhatsApp number.");
      return;
    }
    toast.success("WhatsApp number saved — you'll now get important updates.");
    await refreshProfile();
    setOpen(false);
  };

  const skip = () => {
    sessionStorage.setItem("wa_prompt_dismissed", "1");
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) skip(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="w-12 h-12 rounded-2xl bg-[#25D366]/10 flex items-center justify-center mb-2">
            <MessageCircle className="w-6 h-6 text-[#25D366]" />
          </div>
          <DialogTitle>Add your WhatsApp number</DialogTitle>
          <DialogDescription>
            We use WhatsApp to send you course updates, assignment feedback, live class reminders, and community announcements. It only takes a second.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <Label htmlFor="wa-number">WhatsApp Number</Label>
          <Input
            id="wa-number"
            type="tel"
            placeholder="+2547..."
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">Include your country code (e.g. +254 for Kenya).</p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={skip} disabled={saving}>Skip for now</Button>
          <Button variant="hero" onClick={save} disabled={saving}>
            {saving ? "Saving..." : "Save number"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default WhatsAppPrompt;
