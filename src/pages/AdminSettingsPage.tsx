import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Camera, Save, Settings, User, ShieldPlus, Send, MessageCircle, Users, BookOpen, Newspaper, Trash2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const AdminSettingsPage = () => {
  const { user, profile, refreshProfile } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);
  const [sendingNudges, setSendingNudges] = useState(false);
  const [platformAnnouncement, setPlatformAnnouncement] = useState("");
  const [whatsappGroupUrl, setWhatsappGroupUrl] = useState("https://chat.whatsapp.com/GdHfJutCYlX7xitn3gC71o");
  const [liveClassUrl, setLiveClassUrl] = useState("");
  const [trialLessonLimit, setTrialLessonLimit] = useState("5");
  const [trialDurationDays, setTrialDurationDays] = useState("7");
  const [supportEmail, setSupportEmail] = useState("support@nexusaiskillsacademy.com");
  const [defaultCurrency, setDefaultCurrency] = useState("KES");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [allowRegistrations, setAllowRegistrations] = useState(true);
  const [savingPlatform, setSavingPlatform] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["platform_announcement", "whatsapp_group_url", "live_class_url", "trial_lesson_limit", "trial_duration_days", "support_email", "default_currency", "maintenance_mode", "allow_registrations"]);

      if (error) {
        console.error("loadSettings error:", error);
        return;
      }

      data?.forEach((setting) => {
        if (setting.key === "platform_announcement" && typeof setting.value === "string") {
          setPlatformAnnouncement(setting.value);
        }
        if (setting.key === "whatsapp_group_url" && typeof setting.value === "string") {
          setWhatsappGroupUrl(setting.value);
        }
        if (setting.key === "live_class_url" && typeof setting.value === "string") {
          setLiveClassUrl(setting.value);
        }
        if (setting.key === "trial_lesson_limit") {
          setTrialLessonLimit(String(setting.value ?? "5"));
        }
        if (setting.key === "trial_duration_days") {
          setTrialDurationDays(String(setting.value ?? "7"));
        }
        if (setting.key === "support_email" && typeof setting.value === "string") {
          setSupportEmail(setting.value);
        }
        if (setting.key === "default_currency" && typeof setting.value === "string") {
          setDefaultCurrency(setting.value);
        }
        if (setting.key === "maintenance_mode") {
          setMaintenanceMode(Boolean(setting.value));
        }
        if (setting.key === "allow_registrations") {
          setAllowRegistrations(Boolean(setting.value));
        }
      });
    };

    loadSettings();
  }, []);

  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim()) { toast.error("Enter an email"); return; }
    setAddingAdmin(true);
    try {
      const { data, error } = await supabase.functions.invoke("add-admin", {
        body: { email: newAdminEmail.trim() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success(`${newAdminEmail.trim()} is now an admin`);
      setNewAdminEmail("");
    } catch (err: any) {
      toast.error(err.message || "Failed to add admin");
    } finally { setAddingAdmin(false); }
  };

  const handleSavePlatformSettings = async () => {
    const parsedTrialLessonLimit = Number.parseInt(trialLessonLimit, 10);
    const parsedTrialDurationDays = Number.parseInt(trialDurationDays, 10);
    if (!Number.isFinite(parsedTrialLessonLimit) || parsedTrialLessonLimit < 1) {
      toast.error("Trial lesson limit must be at least 1");
      return;
    }
    if (!Number.isFinite(parsedTrialDurationDays) || parsedTrialDurationDays < 1) {
      toast.error("Trial duration must be at least 1 day");
      return;
    }

    const trimmedLiveClassUrl = liveClassUrl.trim();
    if (trimmedLiveClassUrl && !/^https:\/\/meet\.google\.com\//i.test(trimmedLiveClassUrl)) {
      toast.error("Live class URL must be a valid Google Meet link starting with https://meet.google.com/");
      return;
    }

    setSavingPlatform(true);
    try {
      const { error } = await supabase.from("app_settings").upsert([
        { key: "platform_announcement", value: platformAnnouncement },
        { key: "whatsapp_group_url", value: whatsappGroupUrl },
        { key: "live_class_url", value: trimmedLiveClassUrl },
        { key: "trial_lesson_limit", value: parsedTrialLessonLimit },
        { key: "trial_duration_days", value: parsedTrialDurationDays },
        { key: "support_email", value: supportEmail },
        { key: "default_currency", value: defaultCurrency },
        { key: "maintenance_mode", value: maintenanceMode },
        { key: "allow_registrations", value: allowRegistrations },
      ]);
      if (error) throw error;
      toast.success("Platform settings saved");
    } catch (err: any) {
      toast.error(err.message || "Failed to save platform settings");
    } finally {
      setSavingPlatform(false);
    }
  };

  const handleSendNudges = async () => {
    setSendingNudges(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-followups", { body: {} });
      if (error) throw error;
      toast.success(`Follow-up nudges sent: ${(data as any)?.sent ?? 0}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send nudges");
    } finally { setSendingNudges(false); }
  };

  const currentAvatar = avatarUrl || (profile as any)?.avatar_url || null;

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setAvatarUrl(url);
      await supabase.from("profiles").update({ avatar_url: url }).eq("user_id", user.id);
      toast.success("Profile picture updated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("user_id", user.id);
      if (error) throw error;
      await refreshProfile();
      toast.success("Profile updated successfully!");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      <AdminSidebar />
      <main className="flex-1 p-6 lg:p-8 overflow-auto">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Manage your profile and platform settings.</p>
          </div>

          <Card className="glass-card mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="w-5 h-5" /> Admin Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatar */}
              <div className="flex items-center gap-6">
                <div className="relative group cursor-pointer" onClick={() => fileRef.current?.click()}>
                  <Avatar className="w-20 h-20">
                    {currentAvatar ? <AvatarImage src={currentAvatar} alt="Profile" /> : null}
                    <AvatarFallback className="text-2xl">{(fullName || user?.email || "A")[0].toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                </div>
                <div>
                  <p className="font-medium">{uploading ? "Uploading..." : "Profile Picture"}</p>
                  <p className="text-sm text-muted-foreground">Click the avatar to upload a new photo</p>
                </div>
              </div>

              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Enter your full name" />
              </div>

              {/* Email */}
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user?.email || ""} disabled className="opacity-60" />
                <p className="text-xs text-muted-foreground">Email cannot be changed</p>
              </div>

              {/* Role */}
              <div className="space-y-2">
                <Label>Role</Label>
                <span className="text-sm px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">Admin</span>
              </div>

              <Button onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                <Save className="w-4 h-4 mr-2" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Video className="w-5 h-5" /> Live Class</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="liveClassUrl">Google Meet URL</Label>
                <Input
                  id="liveClassUrl"
                  value={liveClassUrl}
                  onChange={(e) => setLiveClassUrl(e.target.value)}
                  placeholder="https://meet.google.com/abc-defg-hij"
                />
                <p className="text-xs text-muted-foreground">
                  Paste an active Google Meet link here. Students will see a blinking JOIN LIVE CLASS button; clear this field to disable the button.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={handleSavePlatformSettings} disabled={savingPlatform}>
                  <Save className="w-4 h-4 mr-2" />
                  {savingPlatform ? "Saving..." : "Save Live Class Link"}
                </Button>
                {liveClassUrl.trim() ? (
                  <Button variant="outline" asChild>
                    <a href={liveClassUrl.trim()} target="_blank" rel="noopener noreferrer">Preview Live Class Link</a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">No live class is active right now.</p>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Settings className="w-5 h-5" /> Platform Settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="platformAnnouncement">Platform Announcement</Label>
                <Input
                  id="platformAnnouncement"
                  value={platformAnnouncement}
                  onChange={(e) => setPlatformAnnouncement(e.target.value)}
                  placeholder="Short announcement shown across the platform"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="whatsappGroupUrl" className="flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp Group URL</Label>
                <Input
                  id="whatsappGroupUrl"
                  value={whatsappGroupUrl}
                  onChange={(e) => setWhatsappGroupUrl(e.target.value)}
                  placeholder="https://chat.whatsapp.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="trialLessonLimit">Free Trial Lesson Limit</Label>
                <Input
                  id="trialLessonLimit"
                  type="number"
                  min="1"
                  value={trialLessonLimit}
                  onChange={(e) => setTrialLessonLimit(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">The current learning flow unlocks the first 5 paid-course lessons during the 7-day trial.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="trialDurationDays">Free Trial Days</Label>
                  <Input id="trialDurationDays" type="number" min="1" value={trialDurationDays} onChange={(e) => setTrialDurationDays(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="defaultCurrency">Default Currency</Label>
                  <Input id="defaultCurrency" value={defaultCurrency} onChange={(e) => setDefaultCurrency(e.target.value.toUpperCase())} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="supportEmail">Support Email</Label>
                <Input id="supportEmail" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label>Maintenance Mode</Label>
                    <p className="text-xs text-muted-foreground">Store a flag for temporary maintenance notices.</p>
                  </div>
                  <Switch checked={maintenanceMode} onCheckedChange={setMaintenanceMode} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <Label>Allow Registrations</Label>
                    <p className="text-xs text-muted-foreground">Store a flag to control new signups.</p>
                  </div>
                  <Switch checked={allowRegistrations} onCheckedChange={setAllowRegistrations} />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <Button variant="outline" asChild><Link to="/admin/students"><Users className="w-4 h-4 mr-2" /> Manage Students</Link></Button>
                <Button variant="outline" asChild><Link to="/admin/courses"><BookOpen className="w-4 h-4 mr-2" /> Manage Courses</Link></Button>
                <Button variant="outline" asChild><Link to="/admin/blog"><Newspaper className="w-4 h-4 mr-2" /> Manage Blog</Link></Button>
                <Button variant="outline" asChild><Link to="/admin/deletion-feedback"><Trash2 className="w-4 h-4 mr-2" /> Deletion Feedback</Link></Button>
              </div>
              <Button onClick={handleSavePlatformSettings} disabled={savingPlatform}>
                <Save className="w-4 h-4 mr-2" />
                {savingPlatform ? "Saving..." : "Save Platform Settings"}
              </Button>
            </CardContent>
          </Card>

          <Card className="glass-card mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldPlus className="w-5 h-5" /> Add Another Admin</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Promote an existing user to admin. The user must already have signed up with this email.
              </p>
              <div className="flex flex-col sm:flex-row gap-2">
                <Input
                  type="email"
                  placeholder="user@example.com"
                  value={newAdminEmail}
                  onChange={(e) => setNewAdminEmail(e.target.value)}
                />
                <Button onClick={handleAddAdmin} disabled={addingAdmin}>
                  {addingAdmin ? "Adding..." : "Make Admin"}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-card mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Send className="w-5 h-5" /> Student Re-engagement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Send psychological-trigger follow-up messages to students who have stopped progressing
                (Day 2, Day 4, Day 7, Day 14). Each student receives each nudge only once.
              </p>
              <Button onClick={handleSendNudges} disabled={sendingNudges} variant="hero">
                {sendingNudges ? "Sending..." : "Send Follow-up Nudges Now"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default AdminSettingsPage;
