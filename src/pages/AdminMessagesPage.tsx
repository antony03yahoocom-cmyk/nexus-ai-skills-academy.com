import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, ArrowLeft, Mail, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import AdminSidebar from "@/components/dashboard/AdminSidebar";
import DashboardTopNav from "@/components/dashboard/DashboardTopNav";

interface Conversation {
  user_id: string;
  full_name: string;
  last_message: string;
  last_time: string;
  unread: number;
}

interface Message {
  id: string;
  sender_id: string;
  receiver_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

const AdminMessagesPage = () => {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const [allStudents, setAllStudents] = useState<{ user_id: string; full_name: string }[]>([]);
  const [showNewChat, setShowNewChat] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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
      if (!convMap.has(otherId)) convMap.set(otherId, { last: m as Message, unread: 0 });
      if (m.receiver_id === user.id && !m.is_read) convMap.get(otherId)!.unread++;
    }

    const userIds = Array.from(convMap.keys());
    if (userIds.length === 0) { setConversations([]); return; }
    const { data: profiles } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);

    const convs: Conversation[] = userIds.map((uid) => {
      const entry = convMap.get(uid)!;
      const prof = profiles?.find((p) => p.user_id === uid);
      return { user_id: uid, full_name: prof?.full_name || "Unknown", last_message: entry.last.content, last_time: entry.last.created_at, unread: entry.unread };
    });
    convs.sort((a, b) => new Date(b.last_time).getTime() - new Date(a.last_time).getTime());
    setConversations(convs);
  }, [user]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const loadMessages = useCallback(async () => {
    if (!user || !selectedUser) return;
    const { data } = await supabase
      .from("private_messages")
      .select("*")
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUser.id}),and(sender_id.eq.${selectedUser.id},receiver_id.eq.${user.id})`)
      .order("created_at", { ascending: true });
    setMessages((data as Message[]) || []);
    await supabase.from("private_messages").update({ is_read: true }).eq("sender_id", selectedUser.id).eq("receiver_id", user.id).eq("is_read", false);
  }, [user, selectedUser]);

  useEffect(() => { loadMessages(); }, [loadMessages]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("admin-pm-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "private_messages" }, (payload) => {
        const msg = payload.new as Message;
        if (msg.sender_id === user.id || msg.receiver_id === user.id) {
          if (selectedUser && (msg.sender_id === selectedUser.id || msg.receiver_id === selectedUser.id)) {
            setMessages((prev) => [...prev, msg]);
            if (msg.receiver_id === user.id) supabase.from("private_messages").update({ is_read: true }).eq("id", msg.id).then();
          }
          loadConversations();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, selectedUser, loadConversations]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const loadStudents = async () => {
    setShowNewChat(true);
    const { data } = await supabase.from("profiles").select("user_id, full_name");
    setAllStudents((data || []).filter((p) => p.user_id !== user?.id));
  };

  const sendMessage = async () => {
    if (!input.trim() || !user || !selectedUser) return;
    await supabase.from("private_messages").insert({ sender_id: user.id, receiver_id: selectedUser.id, content: input.trim() });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } };

  const filteredStudents = allStudents.filter((u) => u.full_name?.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="flex min-h-screen bg-background">
      <AdminSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardTopNav />
        <div className="flex-1 flex overflow-hidden">
          {/* Conversation list */}
          <div className={cn("w-full md:w-80 border-r flex flex-col shrink-0", selectedUser ? "hidden md:flex" : "flex")}>
            <div className="p-4 border-b flex items-center justify-between">
              <h2 className="font-semibold flex items-center gap-2"><Mail className="h-4 w-4" /> Messages</h2>
              <Button size="sm" variant="outline" onClick={loadStudents}>New</Button>
            </div>
            {showNewChat && (
              <div className="p-3 border-b space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8" />
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {filteredStudents.map((u) => (
                    <button key={u.user_id} onClick={() => { setSelectedUser({ id: u.user_id, name: u.full_name || "Unknown" }); setShowNewChat(false); }} className="w-full text-left px-3 py-2 rounded-lg hover:bg-accent text-sm flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium text-primary">{u.full_name?.[0]?.toUpperCase() || "?"}</div>
                      {u.full_name || "Unknown"}
                    </button>
                  ))}
                  {filteredStudents.length === 0 && <p className="text-sm text-muted-foreground px-3 py-2">No users found</p>}
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowNewChat(false)} className="w-full">Cancel</Button>
              </div>
            )}
            <div className="flex-1 overflow-y-auto">
              {conversations.map((conv) => (
                <button key={conv.user_id} onClick={() => { setSelectedUser({ id: conv.user_id, name: conv.full_name }); setShowNewChat(false); }}
                  className={cn("w-full text-left px-4 py-3 border-b hover:bg-accent/50 flex items-center gap-3", selectedUser?.id === conv.user_id && "bg-accent")}>
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary shrink-0">{conv.full_name?.[0]?.toUpperCase() || "?"}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between"><p className="font-medium text-sm truncate">{conv.full_name}</p><span className="text-xs text-muted-foreground">{format(new Date(conv.last_time), "HH:mm")}</span></div>
                    <p className="text-xs text-muted-foreground truncate">{conv.last_message}</p>
                  </div>
                  {conv.unread > 0 && <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">{conv.unread}</span>}
                </button>
              ))}
              {conversations.length === 0 && !showNewChat && (
                <div className="p-6 text-center text-muted-foreground text-sm"><Mail className="h-10 w-10 mx-auto mb-2 opacity-30" /><p>No messages yet</p></div>
              )}
            </div>
          </div>

          {/* Chat */}
          <div className={cn("flex-1 flex flex-col", !selectedUser ? "hidden md:flex" : "flex")}>
            {selectedUser ? (
              <>
                <div className="px-4 py-3 border-b flex items-center gap-3">
                  <button onClick={() => setSelectedUser(null)} className="md:hidden"><ArrowLeft className="h-5 w-5" /></button>
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary">{selectedUser.name[0]?.toUpperCase()}</div>
                  <div><p className="font-semibold text-sm">{selectedUser.name}</p><p className="text-xs text-muted-foreground">Private message</p></div>
                </div>
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                  {messages.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div key={msg.id} className={cn("flex", isMine ? "justify-end" : "justify-start")}>
                        <div className={cn("max-w-[70%] rounded-2xl px-4 py-2", isMine ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md")}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={cn("text-xs mt-1", isMine ? "text-primary-foreground/60" : "text-muted-foreground")}>{format(new Date(msg.created_at), "HH:mm")}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t p-3 flex gap-2">
                  <Input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} placeholder="Type a message..." className="flex-1" />
                  <Button onClick={sendMessage} disabled={!input.trim()} size="icon"><Send className="h-4 w-4" /></Button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-muted-foreground">
                <div className="text-center"><Mail className="h-12 w-12 mx-auto mb-3 opacity-20" /><p className="font-medium">Select a conversation</p></div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminMessagesPage;
