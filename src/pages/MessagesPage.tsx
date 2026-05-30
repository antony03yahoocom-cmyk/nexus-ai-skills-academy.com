import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Send, ArrowLeft, Mail, Search, MessageCircle,
  HeadphonesIcon, Sparkles, X, Plus, CheckCheck, Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";
import { useSearchParams } from "react-router-dom";

// Types

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

// Helpers

const formatMsgTime = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return "Yesterday";
  return format(d, "dd MMM");
};

const getDayLabel = (dateStr: string) => {
  const d = new Date(dateStr);
  if (isToday(d)) return "Today";
  if (isYesterday(d)) return "Yesterday";
  return format(d, "MMMM d, yyyy");
};

const getInitial = (name: string | null | undefined, fallback = "?") =>
  name?.[0]?.toUpperCase() ?? fallback;

// Avatar sub-component

const Avatar = ({
  name,
  isAdmin,
  size = "md",
}: {
  name: string;
  isAdmin?: boolean;
  size?: "sm" | "md" | "lg";
}) => {
  const dims = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-11 w-11 text-base",
  };
  return (
    <div className="relative shrink-0">
      <div
        className={cn(
          "rounded-full bg-[#00C896]/20 flex items-center justify-center font-semibold text-[#00C896] ring-1 ring-[#00C896]/30",
          dims[size]
        )}
      >
        {isAdmin ? "N" : getInitial(name)}
      </div>
      {isAdmin && (
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 rounded-full bg-[#FFB400] border-2 border-[#1A3A5F]",
            size === "sm" ? "w-3 h-3" : "w-3.5 h-3.5"
          )}
          title="Instructor"
        />
      )}
    </div>
  );
};

// Day separator

const DaySeparator = ({ label }: { label: string }) => (
  <div className="flex items-center gap-3 my-4 px-2">
    <div className="flex-1 h-px bg-[#1A3A5F]/10" />
    <span className="rounded-full bg-[#1A3A5F]/[0.07] px-3 py-1 text-[10px] font-medium text-[#1A3A5F]/50 shrink-0 border border-[#1A3A5F]/10">
      {label}
    </span>
    <div className="flex-1 h-px bg-[#1A3A5F]/10" />
  </div>
);

// Main component

const MessagesPage = () => {
  const { user, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    name: string;
    is_admin?: boolean;
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [adminContact, setAdminContact] = useState<{
    user_id: string;
    full_name: string;
  } | null>(null);

  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [convSearch, setConvSearch] = useState("");
  const [allUsers, setAllUsers] = useState<ProfileSummary[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMsgs, setLoadingMsgs] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const charCount = input.length;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior, block: "end" });
  }, []);

  // Auto-open chat via ?to=USER_ID
  useEffect(() => {
    const to = searchParams.get("to");
    if (!to || !user || selectedUser?.id === to) return;
    supabase
      .from("profiles")
      .select("user_id, full_name")
      .eq("user_id", to)
      .single()
      .then(({ data }) => {
        if (data) setSelectedUser({ id: data.user_id, name: data.full_name || "Student" });
        setSearchParams({}, { replace: true });
      });
  }, [searchParams, user, selectedUser, setSearchParams]);

  // Load admin contact for students
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
        if (profile)
          setAdminContact({
            user_id: profile.user_id,
            full_name: profile.full_name || "NEXUS Instructor",
          });
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
      if (!convMap.has(otherId))
        convMap.set(otherId, { last: m as Message, unread: 0 });
      if (m.receiver_id === user.id && !m.is_read)
        convMap.get(otherId)!.unread++;
    }

    const userIds = Array.from(convMap.keys());
    if (userIds.length === 0) {
      setConversations([]);
      return;
    }

    const [{ data: profiles }, { data: adminRoles }] = await Promise.all([
      supabase
        .from("profiles")
        .select("user_id, full_name, avatar_url")
        .in("user_id", userIds),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]);

    const adminIdSet = new Set((adminRoles || []).map((r) => r.user_id));

    const convs: Conversation[] = userIds.map((uid) => {
      const entry = convMap.get(uid)!;
      const prof = profiles?.find((p) => p.user_id === uid);
      return {
        user_id: uid,
        full_name: prof?.full_name || "NEXUS Support",
        avatar_url: prof?.avatar_url ?? null,
        last_message: entry.last.content,
        last_time: entry.last.created_at,
        unread: entry.unread,
        is_admin: adminIdSet.has(uid),
      };
    });

    convs.sort(
      (a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime()
    );
    setConversations(convs);
  }, [user]);

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Load messages
  const loadMessages = useCallback(async () => {
    if (!user || !selectedUser) return;
    setLoadingMsgs(true);
    const { data } = await supabase
      .from("private_messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),` +
          `and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`
      )
      .order("created_at", { ascending: true });

    setMessages((data as Message[]) || []);
    setLoadingMsgs(false);

    supabase
      .from("private_messages")
      .update({ is_read: true })
      .eq("sender_id", selectedUser.id)
      .eq("receiver_id", user.id)
      .eq("is_read", false)
      .then(() => loadConversations());

    requestAnimationFrame(() => scrollToBottom("auto"));
  }, [user, selectedUser, loadConversations, scrollToBottom]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  // Scroll to bottom on new messages
  useEffect(() => {
    if (messages.length > 0) scrollToBottom("smooth");
  }, [messages, scrollToBottom]);

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("private-messages-realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "private_messages" },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.sender_id === user.id || msg.receiver_id === user.id) {
            if (
              selectedUser &&
              (msg.sender_id === selectedUser.id ||
                msg.receiver_id === selectedUser.id)
            ) {
              setMessages((prev) => {
                // Replace any matching optimistic message
                const withoutOptimistic = prev.filter(
                  (m) => !m.id.startsWith("optimistic-")
                );
                return [...withoutOptimistic, msg];
              });
              if (msg.receiver_id === user.id)
                supabase
                  .from("private_messages")
                  .update({ is_read: true })
                  .eq("id", msg.id)
                  .then();
            }
            loadConversations();
          }
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, selectedUser, loadConversations]);

  // Load users for new chat
  const loadUsers = async () => {
    setShowNewChat(true);
    setSearch("");
    const [{ data: allProfiles }, { data: adminRoles }] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, avatar_url"),
      supabase.from("user_roles").select("user_id").eq("role", "admin"),
    ]);
    const adminIds = new Set((adminRoles || []).map((r) => r.user_id));
    setAllUsers(
      (allProfiles || [])
        .filter((p) => p.user_id !== user?.id)
        .map((p) => ({ ...p, is_admin: adminIds.has(p.user_id) }))
    );
  };

  // Send message with optimistic update
  const sendMessage = async () => {
    const content = input.trim();
    if (!content || !user || !selectedUser || sending) return;
    setSending(true);
    setInput("");
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "44px";
    }
    const optimistic: Message = {
      id: `optimistic-${Date.now()}`,
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content,
      is_read: false,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    await supabase.from("private_messages").insert({
      sender_id: user.id,
      receiver_id: selectedUser.id,
      content,
    });
    setSending(false);
    textareaRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 128)}px`;
  };

  const startChat = (u: {
    user_id: string;
    full_name: string | null;
    is_admin?: boolean;
  }) => {
    setSelectedUser({
      id: u.user_id,
      name: u.full_name || "NEXUS Support",
      is_admin: u.is_admin,
    });
    setShowNewChat(false);
    setSearch("");
  };

  const startAdminChat = () => {
    if (adminContact) startChat({ ...adminContact, is_admin: true });
  };

  const closeChat = () => {
    setSelectedUser(null);
    setMessages([]);
  };

  // Derived
  const filteredNewChatUsers = allUsers.filter((u) =>
    u.full_name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredConversations = convSearch
    ? conversations.filter((c) =>
        c.full_name.toLowerCase().includes(convSearch.toLowerCase())
      )
    : conversations;

  const messagesWithSeparators: Array<
    Message | { type: "separator"; label: string; key: string }
  > = [];
  let lastDay = "";
  for (const msg of messages) {
    const dayLabel = getDayLabel(msg.created_at);
    if (dayLabel !== lastDay) {
      messagesWithSeparators.push({
        type: "separator",
        label: dayLabel,
        key: `sep-${msg.id}`,
      });
      lastDay = dayLabel;
    }
    messagesWithSeparators.push(msg);
  }

  const hasConversations = conversations.length > 0;
  const totalUnread = conversations.reduce((s, c) => s + c.unread, 0);
  const showInstructorPin =
    !isAdmin &&
    hasConversations &&
    adminContact &&
    !conversations.find((c) => c.user_id === adminContact.user_id);

  return (
    <div className="flex h-dvh max-h-dvh overflow-hidden bg-[#F5F7FA] text-[#1A3A5F]">
      <DashboardSidebar />

      <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden min-w-0">
        <DashboardTopNav />

        <div className="flex-1 flex overflow-hidden min-h-0">

          {/* LEFT PANEL */}
          <aside
            className={cn(
              "flex flex-col bg-[#1A3A5F] text-white border-r border-white/10 shrink-0",
              "w-full md:w-80 lg:w-96",
              selectedUser ? "hidden md:flex" : "flex"
            )}
          >
            {/* Header — fixed, never scrolls */}
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-base flex items-center gap-2">
                  <Mail className="h-4 w-4 text-[#00C896]" />
                  Messages
                  {totalUnread > 0 && (
                    <span className="h-5 min-w-[20px] px-1 rounded-full bg-[#FFB400] text-[#1A3A5F] text-[10px] flex items-center justify-center font-bold">
                      {totalUnread > 99 ? "99+" : totalUnread}
                    </span>
                  )}
                </h2>
                <Button
                  size="sm"
                  onClick={loadUsers}
                  className="h-8 gap-1.5 border-0 bg-[#00C896] text-xs font-semibold text-[#1A3A5F] hover:bg-[#FFB400] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  New
                </Button>
              </div>

              {hasConversations && !showNewChat && (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/40 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search conversations…"
                    value={convSearch}
                    onChange={(e) => setConvSearch(e.target.value)}
                    className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/10 text-sm text-white placeholder:text-white/40 border border-white/10 focus:outline-none focus:border-[#00C896]/60 focus:bg-white/15 transition-colors"
                  />
                </div>
              )}
            </div>

            {/* New Chat panel — fixed height, own scroll */}
            {showNewChat && (
              <div className="shrink-0 border-b border-white/10 bg-[#143354]">
                <div className="px-4 pt-3 pb-2 flex items-center justify-between">
                  <p className="text-xs font-semibold text-white/70 uppercase tracking-wider">
                    {isAdmin ? "Start a conversation" : "New message"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowNewChat(false)}
                    className="rounded-full p-1 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
                    aria-label="Close new chat panel"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-3 pb-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#1A3A5F]/40 pointer-events-none" />
                    <Input
                      autoFocus
                      placeholder="Search people…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="h-9 border-white/20 bg-white pl-8 text-sm text-[#1A3A5F] placeholder:text-[#1A3A5F]/40 focus-visible:ring-[#00C896]"
                    />
                  </div>
                </div>
                {/* People list — own independent scroll */}
                <div
                  className="overflow-y-auto overscroll-contain max-h-52 px-2 pb-3 space-y-0.5"
                  style={{ WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}
                >
                  {filteredNewChatUsers.length === 0 ? (
                    <p className="text-xs text-white/50 text-center py-6">No people found</p>
                  ) : (
                    filteredNewChatUsers.map((u) => (
                      <button
                        key={u.user_id}
                        type="button"
                        onClick={() => startChat(u)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors hover:bg-white/10 active:bg-white/15"
                      >
                        <Avatar name={u.full_name ?? ""} isAdmin={u.is_admin} size="sm" />
                        <span className="flex-1 min-w-0 text-sm font-medium truncate">
                          {u.full_name || "Unknown"}
                        </span>
                        {u.is_admin && (
                          <Badge className="shrink-0 border-[#00C896]/30 bg-[#00C896]/15 text-[#00C896] text-[10px] px-1.5">
                            Instructor
                          </Badge>
                        )}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Pinned instructor shortcut */}
            {showInstructorPin && (
              <button
                type="button"
                onClick={startAdminChat}
                className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-[#143354]/60 text-left transition-colors hover:bg-[#00C896]/15 active:bg-[#00C896]/20"
              >
                <Avatar name="NEXUS Instructor" isAdmin size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">NEXUS Instructor</p>
                  <p className="text-[10px] text-white/50">Tap to message</p>
                </div>
                <Sparkles className="w-3.5 h-3.5 text-[#FFB400] shrink-0" />
              </button>
            )}

            {/* Conversation list — fills remaining space, independently scrollable */}
            {hasConversations ? (
              <div
                className="flex-1 min-h-0 overflow-y-auto overscroll-contain"
                style={{ WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}
              >
                {filteredConversations.length === 0 && convSearch ? (
                  <p className="text-center text-xs text-white/50 py-10">
                    No results for "{convSearch}"
                  </p>
                ) : (
                  filteredConversations.map((conv) => {
                    const isActive = selectedUser?.id === conv.user_id;
                    return (
                      <button
                        key={conv.user_id}
                        type="button"
                        onClick={() => {
                          setSelectedUser({
                            id: conv.user_id,
                            name: conv.full_name,
                            is_admin: conv.is_admin,
                          });
                          setShowNewChat(false);
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.07] text-left transition-all",
                          isActive
                            ? "bg-[#00C896]/15 shadow-[inset_3px_0_0_#00C896]"
                            : "hover:bg-white/[0.07] active:bg-white/10"
                        )}
                      >
                        <Avatar
                          name={conv.full_name}
                          isAdmin={conv.is_admin}
                          size="md"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline justify-between gap-2 mb-0.5">
                            <p
                              className={cn(
                                "text-sm truncate",
                                conv.unread > 0
                                  ? "font-semibold text-white"
                                  : "font-medium text-white/85"
                              )}
                            >
                              {conv.is_admin ? "NEXUS Instructor" : conv.full_name}
                            </p>
                            <span
                              className={cn(
                                "text-[10px] shrink-0",
                                conv.unread > 0 ? "text-[#00C896]" : "text-white/40"
                              )}
                            >
                              {formatMsgTime(conv.last_time)}
                            </span>
                          </div>
                          <p
                            className={cn(
                              "text-xs truncate",
                              conv.unread > 0 ? "text-white/75" : "text-white/40"
                            )}
                          >
                            {conv.last_message}
                          </p>
                        </div>
                        {conv.unread > 0 && (
                          <span className="shrink-0 h-5 min-w-[20px] px-1 rounded-full bg-[#FFB400] text-[#1A3A5F] text-[10px] flex items-center justify-center font-bold">
                            {conv.unread > 9 ? "9+" : conv.unread}
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
                <div className="h-4" />
              </div>
            ) : (
              /* Empty state */
              <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/10 flex items-center justify-center mb-4">
                  <Mail className="h-7 w-7 text-white/25" />
                </div>
                <p className="font-semibold text-white text-sm mb-1">No messages yet</p>
                <p className="text-xs text-white/45 mb-5 leading-relaxed max-w-[200px]">
                  {isAdmin
                    ? 'Click "New" to start a conversation with a student.'
                    : "Message your instructor for help, questions, or feedback."}
                </p>
                {!isAdmin && adminContact && (
                  <Button
                    size="sm"
                    onClick={startAdminChat}
                    className="border-0 bg-[#00C896] text-xs font-semibold text-[#1A3A5F] hover:bg-[#FFB400] gap-1.5"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Message Instructor
                  </Button>
                )}
              </div>
            )}

            {/* Student CTA when no conversations */}
            {!isAdmin && !hasConversations && !showNewChat && adminContact && (
              <div className="shrink-0 mx-3 mb-4 p-4 rounded-2xl border border-[#00C896]/25 bg-white/[0.06] space-y-3">
                <div className="flex items-center gap-2">
                  <HeadphonesIcon className="w-4 h-4 text-[#00C896] shrink-0" />
                  <p className="text-xs font-bold text-white">Need help?</p>
                </div>
                <p className="text-xs text-white/60 leading-relaxed">
                  Message your instructor directly — ask questions, get feedback on assignments, or share how you're doing.
                </p>
                <Button
                  size="sm"
                  className="w-full border-0 bg-[#00C896] text-xs font-semibold text-[#1A3A5F] hover:bg-[#FFB400] gap-1.5"
                  onClick={startAdminChat}
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  Message Instructor
                </Button>
              </div>
            )}
          </aside>

          {/* RIGHT PANEL — Chat */}
          <main
            className={cn(
              "flex-1 flex flex-col min-h-0 min-w-0 bg-[#F5F7FA]",
              !selectedUser ? "hidden md:flex" : "flex"
            )}
          >
            {selectedUser ? (
              <>
                {/* Chat header — fixed */}
                <header className="shrink-0 flex items-center gap-3 px-4 py-3 bg-[#1A3A5F] text-white border-b border-white/10 shadow-sm">
                  <button
                    type="button"
                    onClick={closeChat}
                    className="md:hidden shrink-0 -ml-1 p-2 rounded-full text-white/70 hover:bg-white/10 hover:text-white transition-colors"
                    aria-label="Back to conversations"
                  >
                    <ArrowLeft className="h-5 w-5" />
                  </button>
                  <Avatar
                    name={selectedUser.name}
                    isAdmin={selectedUser.is_admin}
                    size="md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm leading-tight truncate">
                      {selectedUser.is_admin ? "NEXUS Instructor" : selectedUser.name}
                    </p>
                    <p className="text-[11px] text-white/50 mt-0.5">
                      {selectedUser.is_admin
                        ? "Academy Support · Usually responds within 24h"
                        : "Private message"}
                    </p>
                  </div>
                  {selectedUser.is_admin && (
                    <Badge className="shrink-0 border-[#00C896]/30 bg-[#00C896]/15 text-[#00C896] text-[10px] px-2">
                      Instructor
                    </Badge>
                  )}
                </header>

                {/* Message thread — fills space, independently scrollable */}
                <div
                  className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-4"
                  style={{ WebkitOverflowScrolling: "touch" as React.CSSProperties["WebkitOverflowScrolling"] }}
                >
                  {loadingMsgs ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="flex flex-col items-center gap-3 text-[#1A3A5F]/35">
                        <Clock className="h-6 w-6 animate-pulse" />
                        <p className="text-xs">Loading messages…</p>
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center max-w-xs">
                        <div className="w-12 h-12 rounded-2xl bg-[#1A3A5F]/[0.07] flex items-center justify-center mx-auto mb-3">
                          <MessageCircle className="h-6 w-6 text-[#1A3A5F]/25" />
                        </div>
                        <p className="text-sm font-semibold text-[#1A3A5F]/55 mb-1">
                          Start the conversation
                        </p>
                        <p className="text-xs text-[#1A3A5F]/35">
                          Say hi to{" "}
                          {selectedUser.is_admin
                            ? "your instructor"
                            : selectedUser.name}
                          !
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      {messagesWithSeparators.map((item) => {
                        if ("type" in item && item.type === "separator") {
                          return (
                            <DaySeparator key={item.key} label={item.label} />
                          );
                        }

                        const msg = item as Message;
                        const isMine = msg.sender_id === user?.id;
                        const isOptimistic = msg.id.startsWith("optimistic-");

                        return (
                          <div
                            key={msg.id}
                            className={cn(
                              "flex items-end gap-2 group",
                              isMine ? "justify-end" : "justify-start"
                            )}
                          >
                            {!isMine && (
                              <div className="shrink-0 mb-0.5">
                                <Avatar
                                  name={selectedUser.name}
                                  isAdmin={selectedUser.is_admin}
                                  size="sm"
                                />
                              </div>
                            )}

                            <div
                              className={cn(
                                "flex flex-col gap-0.5",
                                "max-w-[78%] sm:max-w-[65%] md:max-w-[60%]",
                                isMine ? "items-end" : "items-start"
                              )}
                            >
                              <div
                                className={cn(
                                  "rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words shadow-sm",
                                  isMine
                                    ? "bg-[#00C896] text-[#0a2218] rounded-br-sm"
                                    : "bg-white text-[#1A3A5F] rounded-bl-sm border border-[#1A3A5F]/[0.08]",
                                  isOptimistic && "opacity-60"
                                )}
                              >
                                {msg.content}
                              </div>

                              {/* Timestamp + read receipt — visible on hover */}
                              <div
                                className={cn(
                                  "flex items-center gap-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150",
                                  isMine ? "flex-row-reverse" : "flex-row"
                                )}
                              >
                                <span className="text-[10px] text-[#1A3A5F]/35">
                                  {format(new Date(msg.created_at), "HH:mm")}
                                </span>
                                {isMine && !isOptimistic && (
                                  <CheckCheck
                                    className={cn(
                                      "h-3 w-3",
                                      msg.is_read
                                        ? "text-[#00C896]"
                                        : "text-[#1A3A5F]/25"
                                    )}
                                  />
                                )}
                              </div>
                            </div>

                            {/* Mirror spacer for sent messages */}
                            {isMine && <div className="shrink-0 w-8" />}
                          </div>
                        );
                      })}
                      <div ref={messagesEndRef} className="h-1" />
                    </div>
                  )}
                </div>

                {/* Input bar — fixed at bottom */}
                <div
                  className="shrink-0 bg-white border-t border-[#1A3A5F]/10 px-3 pt-3 pb-3 shadow-[0_-4px_20px_rgba(26,58,95,0.05)]"
                  style={{
                    paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))",
                  }}
                >
                  <div className="flex items-end gap-2 max-w-4xl mx-auto">
                    <div className="relative flex-1">
                      <Textarea
                        ref={textareaRef}
                        value={input}
                        onChange={handleInputChange}
                        onKeyDown={handleKeyDown}
                        placeholder={
                          selectedUser.is_admin
                            ? "Message your instructor…"
                            : `Message ${selectedUser.name}…`
                        }
                        rows={1}
                        maxLength={2000}
                        className={cn(
                          "resize-none w-full py-2.5 px-3.5 rounded-2xl",
                          "border border-[#1A3A5F]/15 bg-[#F5F7FA]",
                          "text-sm text-[#1A3A5F] placeholder:text-[#1A3A5F]/35",
                          "focus-visible:ring-2 focus-visible:ring-[#00C896]/40 focus-visible:border-[#00C896]/40",
                          "transition-all overflow-hidden leading-relaxed"
                        )}
                        style={{ height: "44px", minHeight: "44px", maxHeight: "128px" }}
                      />
                      {charCount > 1800 && (
                        <span
                          className={cn(
                            "absolute bottom-2.5 right-3 text-[10px] pointer-events-none select-none",
                            charCount > 1950 ? "text-red-400" : "text-[#1A3A5F]/35"
                          )}
                        >
                          {charCount}/2000
                        </span>
                      )}
                    </div>

                    <Button
                      type="button"
                      onClick={sendMessage}
                      disabled={!input.trim() || sending}
                      size="icon"
                      className={cn(
                        "shrink-0 h-11 w-11 rounded-2xl border-0 transition-all duration-150",
                        input.trim()
                          ? "bg-[#00C896] text-[#0a2218] hover:bg-[#00b386] shadow-md shadow-[#00C896]/25"
                          : "bg-[#1A3A5F]/[0.08] text-[#1A3A5F]/25 cursor-not-allowed"
                      )}
                      aria-label="Send message"
                    >
                      <Send className={cn("h-4 w-4", sending && "animate-pulse")} />
                    </Button>
                  </div>

                  <p className="text-center text-[10px] text-[#1A3A5F]/25 mt-1.5 select-none">
                    Enter to send &middot; Shift+Enter for new line
                  </p>
                </div>
              </>
            ) : (
              /* Desktop empty state */
              <div className="flex-1 flex items-center justify-center p-8">
                <div className="text-center max-w-xs">
                  <div className="w-16 h-16 rounded-3xl bg-[#1A3A5F]/[0.07] flex items-center justify-center mx-auto mb-5">
                    <Mail className="h-8 w-8 text-[#1A3A5F]/20" />
                  </div>
                  <p className="font-bold text-lg text-[#1A3A5F] mb-2">Your Messages</p>
                  <p className="text-sm text-[#1A3A5F]/50 mb-6 leading-relaxed">
                    {isAdmin
                      ? 'Select a conversation on the left, or click "New" to message a student.'
                      : "Ask questions, get assignment feedback, and stay in touch with your instructor."}
                  </p>
                  {!isAdmin && adminContact && (
                    <Button
                      size="sm"
                      onClick={startAdminChat}
                      className="border-0 bg-[#00C896] font-semibold text-[#1A3A5F] hover:bg-[#FFB400] gap-2"
                    >
                      <HeadphonesIcon className="w-4 h-4" />
                      Contact Instructor
                    </Button>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
};

export default MessagesPage;
