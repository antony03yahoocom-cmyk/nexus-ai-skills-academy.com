// GroupChatPage.tsx

import {
  useState,
  useEffect,
  useRef,
} from "react";

import {
  useParams,
  useNavigate,
  Link,
} from "react-router-dom";

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

  const [message, setMessage] =
    useState("");

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

  const { data: members = [] } =
    useQuery({
      queryKey: [
        "group-members",
        groupId,
      ],

      queryFn: async () => {
        const { data } = await supabase
          .from("group_members")
          .select("*")
          .eq("group_id", groupId!);

        if (!data) return [];

        const userIds = data.map(
          (member: any) =>
            member.user_id,
        );

        const { data: profiles } =
          await supabase
            .from("profiles")
            .select(
              "user_id, full_name",
            )
            .in("user_id", userIds);

        const nameMap: Record<
          string,
          string
        > = {};

        (profiles ?? []).forEach(
          (profile: any) => {
            nameMap[
              profile.user_id
            ] =
              profile.full_name ||
              "Student";
          },
        );

        return data.map(
          (member: any) => ({
            ...member,

            full_name:
              nameMap[
                member.user_id
              ] || "Student",
          }),
        );
      },

      enabled: !!groupId,
    });

  const { data: messages = [] } =
    useQuery({
      queryKey: [
        "group-messages",
        groupId,
      ],

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
            data.map(
              (message: any) =>
                message.user_id,
            ),
          ),
        ];

        const { data: profiles } =
          await supabase
            .from("profiles")
            .select(
              "user_id, full_name",
            )
            .in("user_id", userIds);

        const nameMap: Record<
          string,
          string
        > = {};

        (profiles ?? []).forEach(
          (profile: any) => {
            nameMap[
              profile.user_id
            ] =
              profile.full_name ||
              "Student";
          },
        );

        return data.map(
          (message: any) => ({
            ...message,

            full_name:
              nameMap[
                message.user_id
              ] || "Student",
          }),
        );
      },

      enabled: !!groupId,
    });

  useEffect(() => {
    if (!groupId) return;

    const channel = supabase
      .channel(
        `group-messages-${groupId}`,
      )
      .on(
        "postgres_changes",
        {
          event: "*",

          schema: "public",

          table: "group_messages",

          filter: `group_id=eq.${groupId}`,
        },
        () => {
          queryClient.invalidateQueries(
            {
              queryKey: [
                "group-messages",
                groupId,
              ],
            },
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(
        channel,
      );
    };
  }, [groupId, queryClient]);

  useEffect(() => {
    const container =
      scrollContainerRef.current;

    if (!container) return;

    const raf =
      requestAnimationFrame(() => {
        container.scrollTop =
          container.scrollHeight;
      });

    return () =>
      cancelAnimationFrame(raf);
  }, [messages]);

  const myMembership = members.find(
    (member: any) =>
      member.user_id === user?.id,
  );

  const isGroupAdmin =
    myMembership?.role === "admin";

  const isSuspended =
    group?.status === "suspended";

  const sendMessage = useMutation({
    mutationFn: async () => {
      setUploading(true);

      let fileUrl: string | null =
        null;

      if (selectedFile) {
        const path = `${groupId}/${
          user!.id
        }/${Date.now()}_${
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
        throw new Error(
          "Empty message",
        );
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

      queryClient.invalidateQueries(
        {
          queryKey: [
            "group-messages",
            groupId,
          ],
        },
      );
    },

    onError: (error: any) => {
      toast.error(
        error.message ||
          "Failed to send message",
      );

      setUploading(false);
    },
  });

  const deleteMessage =
    useMutation({
      mutationFn: async (
        messageId: string,
      ) => {
        await supabase
          .from("group_messages")
          .delete()
          .eq("id", messageId);
      },

      onSuccess: () =>
        queryClient.invalidateQueries(
          {
            queryKey: [
              "group-messages",
              groupId,
            ],
          },
        ),
    });

  const removeMember =
    useMutation({
      mutationFn: async (
        memberId: string,
      ) => {
        await supabase
          .from("group_members")
          .delete()
          .eq("id", memberId);
      },

      onSuccess: () => {
        toast.success(
          "Member removed",
        );

        queryClient.invalidateQueries(
          {
            queryKey: [
              "group-members",
              groupId,
            ],
          },
        );
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

    const fileName =
      decodeURIComponent(
        fileUrl
          .split("/")
          .pop()
          ?.replace(
            /^\d+_/,
            "",
          ) || "File",
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

  return <div>REPLACE REMAINING CONTENT FROM YOUR FILE AFTER MERGE</div>;
};

export default GroupChatPage;