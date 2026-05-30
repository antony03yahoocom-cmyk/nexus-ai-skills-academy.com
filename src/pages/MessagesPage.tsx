import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, ArrowLeft, Mail, Search, MessageCircle, HeadphonesIcon, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { Badge } from "@/components/ui/badge";
import { useSearchParams } from "react-router-dom";

interface Conversation {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  last_message: string;
  last_time: string;
  unread: number;
  is_admin?: boolean;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface ProfileSummary {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  is_admin?: boolean;
}

// Format timestamp relative to today
const formatMsgTime = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Yesterday ${format(d, "HH:mm")}`;
  return format(d, "dd MMM, HH:mm");
};

// Group messages by date for day separators
const getDayLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
};

const MessagesPage = () => {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string; is_admin?: boolean } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [allUsers, setAllUsers] = useState<ProfileSummary[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [charCount, setCharCount] = useState(0);
  const [adminContact, setAdminContact] = useState<{ user_id: string; full_name: string } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragScrollState = useRef({
    isDragging: false,
    hasMoved: false,
    pointerId: -1,
    startY: 0,
    scrollTop: 0,
  });

  const canStartDragScroll = (target: EventTarget | null) => {
    if (!(target instanceof HTMLElement)) return true;

    return !target.closest(
      'button, a, input, textarea, select, [role="button"], [data-no-drag-scroll="true"]'
    );
  };

  const handleDragScrollStart = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!canStartDragScroll(event.target)) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const container = event.currentTarget;
    dragScrollState.current = {
      isDragging: true,
      hasMoved: false,
      pointerId: event.pointerId,
      startY: event.clientY,
      scrollTop: container.scrollTop,
    };
    container.setPointerCapture(event.pointerId);
  };

  const handleDragScrollMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragScrollState.current;
    if (!state.isDragging || state.pointerId !== event.pointerId) return;

    const deltaY = event.clientY - state.startY;
    if (Math.abs(deltaY) > 3) state.hasMoved = true;
    if (state.hasMoved) event.preventDefault();

    event.currentTarget.scrollTop = state.scrollTop - deltaY;
  };

  const handleDragScrollEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const state = dragScrollState.current;
    if (!state.isDragging || state.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragScrollState.current = {
      isDragging: false,
      hasMoved: false,
      pointerId: -1,
      startY: 0,
      scrollTop: 0,
    };
  };

  // Auto-open chat with ?to=USER_ID
  useEffect(() => {
    const to = searchParams.get("to");
    if (!to || !user || selectedUser?.id === to) return;
    supabase.from("profiles").select("user_id, full_name").eq("user_id", to).single().then(({ data }) => {
      if (data) setSelectedUser({ id: data.user_id, name: data.full_name || "Student" });
      setSearchParams({}, { replace: true });
    });
  }, [searchParams, user, selectedUser, setSearchParams]);

  // Pre-load admin contact for students
  useEffect(() => {
    if (!user || isAdmin) return;
    supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin")
      .limit(1)
      .single()
      .then(async ({ data: roleData }) => {
        if (!roleData?.user_id) return;
        const { data: profile } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .eq("user_id", roleData.user_id)
          .single();
        if (profile) {
          setAdminContact({
            user_id: profile.user_id,
            full_name: profile.full_name || "NEXUS Instructor",
          });
        }
      });
  }, [user, isAdmin]);

  // Load conversations
  const loadConversations = useCallback(async () => {
    if (!user) return;
    const { data: msgs } = await supabase
      .from("private_messages")
      .select("*")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .order("created_at", { ascending: false });

    if (!msgs) return;

    const convMap = new Map<string, { last: Message; unread: number }>();
    for (const m of msgs) {
      const otherId = m.sender_id === user.id ? m.receiver_id : m.sender_id;
      if (!convMap.has(otherId)) {
        convMap.set(otherId, { last: m as Message, unread: 0 });
      }
      if (m.receiver_id === user.id && !m.is_read) {
        convMap.get(otherId)!.unread++;
      }
    }

    const userIds = Array.from(convMap.keys());
    if (userIds.length === 0) { setConversations([]); return; }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, avatar_url")
      .in("user_id", userIds);

    // Get admin IDs to badge them
    const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
    const adminIdSet = new Set((adminRoles || []).map((r) => r.user_id));

    const convs: Conversation[] = userIds.map((uid) => {
      const entry = convMap.get(uid)!;
      const prof = profiles?.find((p) => p.user_id === uid);
      return {
        user_id: uid,
        full_name: prof?.full_name || "NEXUS Support",
        avatar_url: prof?.avatar_url || null,
        last_message: entry.last.content,
        last_time: entry.last.created_at,
        unread: entry.unread,
        is_admin: adminIdSet.has(uid),
      };
    });

    convs.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());
    setConversations(convs);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  // Load messages for selected conversation
  const loadMessages = useCallback(async () => {
    if (!user || !selectedUser) return;
    const { data } = await supabase
      .from("private_messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });

    const msgs = (data as Message[]) || [];
    setMessages(msgs);

    // Mark received messages as read
    await supabase
      .from("private_messages")
      .update({ is_read: true })
      .eq("sender_id", selectedUser.id)
      .eq("receiver_id", user.id)
      .eq("is_read", false);

    // ensure conversations list updates
    await loadConversations();

    // Scroll the thread to the latest message after messages are rendered
    requestAnimationFrame(() => {
      const c = scrollRef.current;
      if (!c) return;
      // jump immediately to bottom when opening a conversation
      c.scrollTo({ top: c.scrollHeight, behavior: "auto" });
    });
  }, [user, selectedUser, loadConversations]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("private-messages-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "private_messages" }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          if (selectedUser && (msg.sender_id === selectedUser.id || msg.receiver_id === selectedUser.id)) {
            setMessages((prev) => [...prev, msg]);
            if (msg.receiver_id === user.id) {
              supabase.from("private_messages").update({ is_read: true }).eq("id", msg.id).then();
            }
          }
          loadConversations();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedUser, loadConversations]);

  // Scroll only the message thread (not the page) to bottom on new messages
  useEffect(() => {
    const c = scrollRef.current;
    if (!c) return;
    requestAnimationFrame(() => {
      c.scrollTo({ top: c.scrollHeight, behavior: "smooth" });
    });
  }, [messages]);

  // Load users for "New Chat"
  const loadUsers = async () => {
    setShowNewChat(true);
    if (isAdmin) {
      const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url");
      setAllUsers((data || []).filter((p) => p.user_id !== user?.id));
    } else {
      // Students can message admins and fellow students
      const { data: adminRoles } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const adminIds = new Set((adminRoles || []).map((r) => r.user_id));
      const { data } = await supabase.from("profiles").select("user_id, full_name, avatar_url");
      setAllUsers(
        (data || [])
          .filter((p) => p.user_id !== user?.id)
          .map((p) => ({ ...p, is_admin: adminIds.has(p.user_id) }))
      );
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || !user || !selectedUser) return;
    const content = input.trim();
    setInput("");
    setCharCount(0);
    await supabase.from("private_messages").insert({
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    setCharCount(e.target.value.length);
  };

  const startChat = (u: { user_id: string; full_name: string | null; is_admin?: boolean }) => {
    setSelectedUser({ id: u.user_id, name: u.full_name || "NEXUS Support", is_admin: u.is_admin });
    setShowNewChat(false);
  };

  const startAdminChat = () => {
    if (adminContact) startChat({ ...adminContact, is_admin: true });
  };

  const filteredUsers = allUsers.filter((u) =>
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  // Build messages with day separators
  const messagesWithSeparators: Array<Message | { type: "separator"; label: string; key: string }> = [];
  let lastDay = "";
  for (const msg of messages) {
    const dayLabel = getDayLabel(msg.created_at);
    if (dayLabel !== lastDay) {
      messagesWithSeparators.push({ type: "separator", label: dayLabel, key: `sep-${msg.id}` });
      lastDay = dayLabel;
    }
    messagesWithSeparators.push(msg);
  }

  const hasConversations = conversations.length > 0;
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);

  return (
    <div className="flex min-h-screen bg-background">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        <DashboardTopNav />
        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* ── Conversation List ── */}
          <div className={cn(
            "w-full md:w-80 border-r flex flex-col shrink-0 bg-card/30",
            selectedUser ? "hidden md:flex" : "flex"
          )}>
            <div className="p-4 border-b flex items-center justify-between gap-2">
              <h2 className="font-semibold flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-primary" /> Messages
                {totalUnread > 0 && (
                  <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] flex items-center justify-center font-bold">
                    {totalUnread > 9 ? "9+" : totalUnread}
                  </span>
                )}
              </h2>
              <Button size="sm" variant="outline" onClick={loadUsers} className="text-xs">
                + New
              </Button>
            </div>

            {/* ── Student: Contact Instructor banner (shown when no conversations) ── */}
            {!isAdmin && !hasConversations && !showNewChat && adminContact && (
              <div className="mx-3 mt-3 p-3 rounded-xl border border-primary/20 bg-primary/5 space-y-2">
                <div className="flex items-center gap-2">
                  <HeadphonesIcon className="w-4 h-4 text-primary shrink-0" />
                  <p className="text-xs font-semibold text-primary">Need help?</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Message your instructor directly — ask questions, get help with assignments, or share feedback.
                </p>
                <Button size="sm" variant="hero" className="w-full text-xs" onClick={startAdminChat}>
                  <MessageCircle className="w-3 h-3 mr-1" /> Message Instructor
                </Button>
              </div>
            )}

            {/* ── Student: Pinned instructor contact (always visible for students with convs) ── */}
            {!isAdmin && hasConversations && adminContact && !conversations.find((c) => c.user_id === adminContact.user_id) && (
              <button
                onClick={startAdminChat}
                className="flex items-center gap-3 px-4 py-2.5 border-b hover:bg-accent/50 transition-colors bg-primary/5 text-left"
              >
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  N
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs truncate">NEXUS Instructor</p>
                  <p className="text-[10px] text-muted-foreground">Tap to send a message</p>
                </div>
                <Sparkles className="w-3 h-3 text-primary shrink-0" />
              </button>
            )}

            {/* New Chat Search Panel */}
            {showNewChat && (
              <div className="p-3 border-b space-y-2">
                <p className="text-xs font-medium text-muted-foreground">
                  {isAdmin ? "Select a student to message:" : "Contact instructor:"}
                </p>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto space-y-0.5 scroll-container" style={{ touchAction: "pan-y" }}>
                  {filteredUsers.map((u) => (
                    <button
                      key={u.user_id}
                      onClick={() => startChat(u)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent text-sm flex items-center gap-2 transition-colors"
                    >
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                        {u.full_name?.[0]?.toUpperCase() || "?"}
                      </div>
                      <span className="truncate flex-1">{u.full_name || "Unknown"}</span>
                      {u.is_admin && (
                        <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] shrink-0">Instructor</Badge>
                      )}
                    </button>
                  ))}
                  {filteredUsers.length === 0 && (
                    <p className="text-sm text-muted-foreground px-3 py-2">No users found</p>
                  )}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowNewChat(false)} className="w-full text-xs">
                  Cancel
                </Button>
              </div>
            )}

            {/* Conversations list */}
            <div className="flex-1 min-h-0 overflow-y-auto scroll-container" style={{ touchAction: "pan-y" }}>
              {conversations.map((conv) => (
                <button
                  key={conv.user_id}
                  onClick={() => { setSelectedUser({ id: conv.user_id, name: conv.full_name, is_admin: conv.is_admin }); setShowNewChat(false); }}
                  className={cn(
                    "w-full text-left px-4 py-3 border-b hover:bg-accent/50 flex items-center gap-3 transition-colors",
                    selectedUser?.id === conv.user_id && "bg-accent"
                  )}
                >
                  <div className="relative shrink-0">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {conv.is_admin ? "N" : (conv.full_name?.[0]?.toUpperCase() || "?")}
                    </div>
                    {conv.is_admin && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-success border-2 border-background" title="Instructor" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <p className="font-medium text-sm truncate">
                        {conv.is_admin ? "NEXUS Instructor" : conv.full_name}
                      </p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{formatMsgTime(conv.last_time)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                  </div>
                  {conv.unread > 0 && (
                    <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center shrink-0 font-bold">
                      {conv.unread}
                    </span>
                  )}
                </button>
              ))}

              {!hasConversations && !showNewChat && (
                <div className="p-6 text-center text-muted-foreground text-sm">
                  <Mail className="h-10 w-10 mx-auto mb-3 opacity-20" />
                  <p className="font-medium">No messages yet</p>
                  {isAdmin
                    ? <p className="text-xs mt-1">Click "+ New" to message a student</p>
                    : <p className="text-xs mt-1">Click "+ New" or use the button above to contact your instructor</p>}
                </div>
              )}
            </div>
          </div>

          {/* ── Chat Area ── */}
          <div className={cn(
            "flex-1 flex flex-col min-w-0",
            !selectedUser ? "hidden md:flex" : "flex"
          )}>
            {selectedUser ? (
              <>
                {/* Chat header */}
                <div className="px-4 py-3 border-b flex items-center gap-3 bg-card/30">
                  <button onClick={() => setSelectedUser(null)} className="md:hidden shrink-0">
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <div className="relative shrink-0">
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">
                      {selectedUser.is_admin ? "N" : (selectedUser.name[0]?.toUpperCase() || "?")}
                    </div>
                    {selectedUser.is_admin && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-success border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">
                      {selectedUser.is_admin ? "NEXUS Instructor" : selectedUser.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {selectedUser.is_admin ? "Academy Support · Usually responds within 24h" : "Private message"}
                    </p>
                  </div>
                  {selectedUser.is_admin && (
                    <Badge className="bg-success/10 text-success border-success/20 text-[10px] shrink-0">Instructor</Badge>
                  )}
                </div>

                {/* Messages */}
                <div
                  ref={scrollRef}
                  onPointerDown={handleDragScrollStart}
                  onPointerMove={handleDragScrollMove}
                  onPointerUp={handleDragScrollEnd}
                  onPointerCancel={handleDragScrollEnd}
                  onPointerLeave={handleDragScrollEnd}
                  className="flex-1 min-h-0 cursor-grab select-none overflow-y-auto overscroll-contain p-4 space-y-3 scroll-container active:cursor-grabbing"
                  style={{ touchAction: "pan-y" }}
                  aria-label="Private message thread - scroll with the scrollbar, mouse wheel, touch drag, or mouse drag"
                >
                  {messagesWithSeparators.map((item) => {
                    if ("type" in item && item.type === "separator") {
                      return (
                        <div key={item.key} className="flex items-center gap-3 my-2">
                          <div className="flex-1 h-px bg-border" />
                          <span className="text-[10px] text-muted-foreground shrink-0 px-2">{item.label}</span>
                          <div className="flex-1 h-px bg-border" />
                        </div>
                      );
                    }

                    const msg = item as Message;
                    const isMine = msg.sender_id === user?.id;

                    return (
                      <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                        {!isMine && (
                          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mr-2 mt-1">
                            {selectedUser.is_admin ? "N" : selectedUser.name[0]?.toUpperCase()}
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[86%] sm:max-w-[72%] rounded-2xl px-4 py-2.5 shadow-sm",
                          isMine
                            ? "bg-primary text-primary-foreground rounded-br-md"
                            : "bg-muted rounded-bl-md border border-border/50"
                        )}>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                          <div className={cn("flex items-center justify-end gap-1 mt-1")}>
                            <p className={cn("text-[10px]", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>
                              {format(new Date(msg.created_at), "HH:mm")}
                            </p>
                            {isMine && msg.is_read && (
                              <span className="text-[10px] text-primary-foreground/60">✓✓</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Input */}
                <div className="border-t p-2 sm:p-3 space-y-1 bg-card/30 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
                  <div className="flex gap-2 items-end">
                    <Textarea
                      value={input}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      placeholder={selectedUser.is_admin ? "Message your instructor..." : "Type a message..."}
                      className="flex-1 min-h-[44px] max-h-32 resize-none text-base sm:text-sm"
                      maxLength={2000}
                      rows={1}
                    />
                    <Button onClick={sendMessage} disabled={!input.trim()} size="icon" className="shrink-0 h-11 w-11">
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  {charCount > 1800 && (
                    <p className="text-[10px] text-muted-foreground text-right">{charCount}/2000</p>
                  )}
                </div>
              </>
            ) : (
              /* Empty state for desktop */
              <div className="flex-1 flex items-center justify-center text-muted-foreground p-6">
                <div className="text-center max-w-xs">
                  <Mail className="h-14 w-14 mx-auto mb-4 opacity-20" />
                  <p className="font-semibold text-base mb-1">Your Messages</p>
                  <p className="text-sm mb-6 text-muted-foreground">
                    {isAdmin
                      ? "Select a conversation or start a new one to message a student."
                      : "Ask questions, get assignment feedback, and stay in touch with your instructor here."}
                  </p>
                  {!isAdmin && adminContact && (
                    <Button variant="hero" size="sm" onClick={startAdminChat}>
                      <HeadphonesIcon className="w-4 h-4 mr-2" />
                      Contact Instructor
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;