import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  useQuery,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

import DashboardTopNav from "@/components/dashboard/DashboardTopNav";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import {
  ArrowLeft,
  Send,
  Users,
  Crown,
  Trash2,
  UserMinus,
  Paperclip,
  X,
  FileText,
  Image as ImageIcon,
} from "lucide-react";

import { toast } from "sonner";

const GroupChatPage = () => {
  const { groupId } = useParams<{
    groupId: string;
  }>();

  const { user } = useAuth();

  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const [message, setMessage] = useState("");

  const [membersOpen, setMembersOpen] =
    useState(false);

  const [selectedFile, setSelectedFile] =
    useState<File | null>(null);

  const [uploading, setUploading] =
    useState(false);

  const fileInputRef =
    useRef<HTMLInputElement>(null);

  const scrollContainerRef =
    useRef<HTMLDivElement>(null);

  const bottomRef =
    useRef<HTMLDivElement>(null);

  const { data: group } = useQuery({
    queryKey: ["group-detail", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("discussion_groups")
        .select("*")
        .eq("id", groupId!)
        .single();

      return data;
    },
    enabled: !!groupId,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["group-members", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_members")
        .select("*")
        .eq("group_id", groupId!);

      if (!data) return [];

      const userIds = data.map(
        (m: any) => m.user_id,
      );

      const { data: profiles } =
        await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

      const nameMap: Record<string, string> =
        {};

      (profiles ?? []).forEach((p: any) => {
        nameMap[p.user_id] =
          p.full_name || "Student";
      });

      return data.map((m: any) => ({
        ...m,
        full_name:
          nameMap[m.user_id] || "Student",
      }));
    },
    enabled: !!groupId,
  });

  const { data: messages = [] } = useQuery({
    queryKey: ["group-messages", groupId],
    queryFn: async () => {
      const { data } = await supabase
        .from("group_messages")
        .select("*")
        .eq("group_id", groupId!)
        .order("created_at", {
          ascending: true,
        });

      if (!data) return [];

      const userIds = [
        ...new Set(
          data.map((m: any) => m.user_id),
        ),
      ];

      const { data: profiles } =
        await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);

      const nameMap: Record<string, string> =
        {};

      (profiles ?? []).forEach((p: any) => {
        nameMap[p.user_id] =
          p.full_name || "Student";
      });

      return data.map((m: any) => ({
        ...m,
        full_name:
          nameMap[m.user_id] || "Student",
      }));
    },
    enabled: !!groupId,
  });

  // Realtime subscription
  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(`group-messages-${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "group_messages",
          filter: `group_id=eq.${groupId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: [
              "group-messages",
              groupId,
            ],
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, queryClient]);

  // Auto scroll to bottom
  useEffect(() => {
    const container =
      scrollContainerRef.current;

    if (!container) return;

    const raf = requestAnimationFrame(
      () => {
        container.scrollTop =
          container.scrollHeight;
      },
    );

    return () =>
      cancelAnimationFrame(raf);
  }, [messages]);

  const myMembership = members.find(
    (m: any) => m.user_id === user?.id,
  );

  const isGroupAdmin =
    myMembership?.role === "admin";

  const isSuspended =
    group?.status === "suspended";

  const sendMessage = useMutation({
    mutationFn: async () => {
      setUploading(true);

      let fileUrl: string | null = null;

      if (selectedFile) {
        const path = `${groupId}/${user!.id}/${Date.now()}_${
          selectedFile.name
        }`;

        const {
          error: uploadError,
        } = await supabase.storage
          .from("group-files")
          .upload(path, selectedFile);

        if (uploadError)
          throw uploadError;

        const { data } =
          supabase.storage
            .from("group-files")
            .getPublicUrl(path);

        fileUrl =
          data?.publicUrl || null;
      }

      const content =
        message.trim() ||
        (selectedFile
          ? `📎 ${selectedFile.name}`
          : "");

      if (!content && !fileUrl) {
        throw new Error("Empty message");
      }

      const { error } = await supabase
        .from("group_messages")
        .insert({
          group_id: groupId!,
          user_id: user!.id,
          content,
          file_url: fileUrl,
        });

      if (error) throw error;
    },

    onSuccess: () => {
      setMessage("");

      setSelectedFile(null);

      setUploading(false);

      queryClient.invalidateQueries({
        queryKey: [
          "group-messages",
          groupId,
        ],
      });
    },

    onError: (e: any) => {
      toast.error(
        e.message ||
          "Failed to send message",
      );

      setUploading(false);
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (msgId: string) => {
      await supabase
        .from("group_messages")
        .delete()
        .eq("id", msgId);
    },

    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: [
          "group-messages",
          groupId,
        ],
      }),
  });

  const removeMember = useMutation({
    mutationFn: async (
      memberId: string,
    ) => {
      await supabase
        .from("group_members")
        .delete()
        .eq("id", memberId);
    },

    onSuccess: () => {
      toast.success("Member removed");

      queryClient.invalidateQueries({
        queryKey: [
          "group-members",
          groupId,
        ],
      });
    },
  });

  const leaveGroup = useMutation({
    mutationFn: async () => {
      await supabase
        .from("group_members")
        .delete()
        .eq("group_id", groupId!)
        .eq("user_id", user!.id);
    },

    onSuccess: () => {
      toast.success("Left group");

      navigate("/discussions");
    },
  });

  const handleSend = (
    e: React.FormEvent,
  ) => {
    e.preventDefault();

    if (
      (!message.trim() &&
        !selectedFile) ||
      isSuspended
    ) {
      return;
    }

    sendMessage.mutate();
  };

  const renderFilePreview = (
    fileUrl: string,
  ) => {
    const isImage =
      /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(
        fileUrl,
      );

    const fileName = decodeURIComponent(
      fileUrl
        .split("/")
        .pop()
        ?.replace(/^\d+_/, "") || "File",
    );

    if (isImage) {
      return (
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer"
          className="block mt-1.5"
        >
          <img
            src={fileUrl}
            alt={fileName}
            className="max-w-[240px] max-h-[200px] rounded-lg object-cover border border-border/30"
          />
        </a>
      );
    }

    const isPdf =
      /\.pdf$/i.test(fileUrl);

    return (
      <a
        href={fileUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 mt-1.5 p-2 rounded-lg bg-background/30 border border-border/20 hover:bg-background/50 transition text-xs"
      >
        {isPdf ? (
          <FileText className="w-4 h-4 shrink-0" />
        ) : (
          <Paperclip className="w-4 h-4 shrink-0" />
        )}

        <span className="truncate">
          {fileName}
        </span>
      </a>
    );
  };

  if (!myMembership && group) {
    return (
      <div className="min-h-screen bg-background">
        <DashboardTopNav />

        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-muted-foreground mb-4">
            You're not a member of this
            group.
          </p>

          <Button asChild>
            <Link to="/discussions">
              Back to Groups
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      {/* Top nav */}
      <div className="shrink-0">
        <DashboardTopNav />
      </div>

      {/* Header */}
      <div className="shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-sm z-30">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            asChild
          >
            <Link to="/discussions">
              <ArrowLeft className="w-4 h-4" />
            </Link>
          </Button>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold truncate">
                {group?.name ?? "Group"}
              </h2>

              {isSuspended && (
                <Badge
                  variant="destructive"
                  className="text-[10px]"
                >
                  Suspended
                </Badge>
              )}
            </div>

            <p className="text-xs text-muted-foreground">
              {members.length} member
              {members.length !== 1
                ? "s"
                : ""}
            </p>
          </div>

          <Dialog
            open={membersOpen}
            onOpenChange={setMembersOpen}
          >
            <DialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
              >
                <Users className="w-4 h-4" />
              </Button>
            </DialogTrigger>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  Group Members
                </DialogTitle>
              </DialogHeader>

              <div className="space-y-2 mt-2 max-h-80 overflow-y-auto">
                {members.map((m: any) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/30"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {(
                          m.full_name || "S"
                        )[0].toUpperCase()}
                      </div>

                      <div>
                        <p className="text-sm font-medium">
                          {m.full_name}
                        </p>

                        {m.role ===
                          "admin" && (
                          <Badge className="bg-primary/10 text-primary border-primary/20 text-[9px]">
                            <Crown className="w-2.5 h-2.5 mr-0.5" />
                            Admin
                          </Badge>
                        )}
                      </div>
                    </div>

                    {isGroupAdmin &&
                      m.user_id !==
                        user?.id && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={() =>
                            removeMember.mutate(
                              m.id,
                            )
                          }
                        >
                          <UserMinus className="w-3.5 h-3.5 text-destructive" />
                        </Button>
                      )}
                  </div>
                ))}
              </div>

              {!isGroupAdmin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4 text-destructive"
                  onClick={() => {
                    leaveGroup.mutate();

                    setMembersOpen(false);
                  }}
                >
                  Leave Group
                </Button>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollContainerRef}
        className="flex-1 overflow-y-auto overscroll-contain"
        style={{
          WebkitOverflowScrolling:
            "touch",
        }}
      >
        <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              No messages yet. Start the
              conversation!
            </div>
          )}

          {(messages as any[]).map(
            (msg: any) => {
              const isOwn =
                msg.user_id === user?.id;

              return (
                <div
                  key={msg.id}
                  className={`flex ${
                    isOwn
                      ? "justify-end"
                      : "justify-start"
                  }`}
                >
                  {!isOwn && (
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 mr-2 mt-1 self-end">
                      {(
                        msg.full_name ||
                        "S"
                      )[0].toUpperCase()}
                    </div>
                  )}

                  <div
                    className={`max-w-[82%] sm:max-w-[65%] group relative rounded-2xl px-4 py-2.5 ${
                      isOwn
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-secondary rounded-bl-md"
                    }`}
                  >
                    {!isOwn && (
                      <p className="text-[10px] font-semibold opacity-70 mb-0.5">
                        {msg.full_name}
                      </p>
                    )}

                    <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                      {msg.content}
                    </p>

                    {msg.file_url &&
                      renderFilePreview(
                        msg.file_url,
                      )}

                    <p
                      className={`text-[10px] mt-1 text-right ${
                        isOwn
                          ? "text-primary-foreground/60"
                          : "text-muted-foreground"
                      }`}
                    >
                      {new Date(
                        msg.created_at,
                      ).toLocaleTimeString(
                        [],
                        {
                          hour: "2-digit",
                          minute:
                            "2-digit",
                        },
                      )}
                    </p>

                    {(isOwn ||
                      isGroupAdmin) && (
                      <button
                        onClick={() =>
                          deleteMessage.mutate(
                            msg.id,
                          )
                        }
                        className="absolute -top-2 -right-2 hidden group-hover:flex w-6 h-6 items-center justify-center rounded-full bg-destructive text-destructive-foreground shadow"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              );
            },
          )}

          <div
            ref={bottomRef}
            className="h-1"
          />
        </div>
      </div>

      {/* File preview */}
      {selectedFile && (
        <div className="shrink-0 border-t border-border/30 bg-secondary/30">
          <div className="max-w-4xl mx-auto px-4 py-2 flex items-center gap-2">
            {selectedFile.type.startsWith(
              "image/",
            ) ? (
              <ImageIcon className="w-4 h-4 text-primary shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-primary shrink-0" />
            )}

            <span className="text-xs truncate flex-1">
              {selectedFile.name}
            </span>

            <span className="text-[10px] text-muted-foreground">
              {(
                selectedFile.size /
                1024
              ).toFixed(0)}{" "}
              KB
            </span>

            <button
              onClick={() =>
                setSelectedFile(null)
              }
              className="p-0.5 hover:bg-secondary rounded"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-border/50 bg-background/80 backdrop-blur-sm">
        <form
          onSubmit={handleSend}
          className="max-w-4xl mx-auto px-2 sm:px-4 py-2 sm:py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] flex gap-2 items-end"
        >
          <input
            type="file"
            ref={fileInputRef}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.txt"
            onChange={(e) => {
              const file =
                e.target.files?.[0];

              if (file) {
                if (
                  file.size >
                  20 * 1024 * 1024
                ) {
                  toast.error(
                    "File too large (max 20MB)",
                  );

                  return;
                }

                setSelectedFile(file);
              }

              e.target.value = "";
            }}
          />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 h-11 w-11 touch-manipulation"
            disabled={isSuspended}
            onClick={() =>
              fileInputRef.current?.click()
            }
          >
            <Paperclip className="w-4 h-4" />
          </Button>

          <Textarea
            placeholder={
              isSuspended
                ? "This group is suspended"
                : "Type a message…"
            }
            value={message}
            onChange={(e) =>
              setMessage(e.target.value)
            }
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey
              ) {
                e.preventDefault();

                handleSend(e as any);
              }
            }}
            disabled={isSuspended}
            className="flex-1 min-h-[44px] max-h-32 resize-none text-base sm:text-sm"
            rows={1}
          />

          <Button
            type="submit"
            size="icon"
            className="h-11 w-11 shrink-0 touch-manipulation"
            disabled={
              (!message.trim() &&
                !selectedFile) ||
              uploading ||
              isSuspended
            }
          >
            <Send className="w-4 h-4" />
          </Button>
        </form>
      </div>
    </div>
  );
};

export default GroupChatPage;