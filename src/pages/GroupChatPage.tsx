{/* Messages */}
<div
  ref={scrollContainerRef}
  className="flex-1 overflow-y-auto overscroll-contain"
  style={{
    WebkitOverflowScrolling: "touch",
  }}
>
  <div className="max-w-4xl mx-auto px-4 py-4 space-y-3">
    {messages.length === 0 && (
      <div className="text-center py-12 text-muted-foreground text-sm">
        No messages yet. Start the conversation!
      </div>
    )}

    {(messages as any[]).map((msg: any) => {
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
                msg.full_name || "S"
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
              ).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
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
    })}

    <div
      ref={bottomRef}
      className="h-1"
    />
  </div>
</div>

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