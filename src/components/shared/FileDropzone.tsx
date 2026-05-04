import { useRef, useState, useEffect } from "react";
import { Upload, X, FileText, FileVideo, FileImage, File as FileIcon, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FileDropzoneProps {
  files: File[];
  onChange: (files: File[]) => void;
  maxFiles?: number;
  maxSizeMB?: number;
  accept?: string;
  disabled?: boolean;
  hint?: string;
  compact?: boolean;
}

const fmtSize = (b: number) => (b < 1024 * 1024 ? `${(b / 1024).toFixed(0)}KB` : `${(b / 1024 / 1024).toFixed(1)}MB`);

const iconFor = (f: File) => {
  if (f.type.startsWith("image/")) return <FileImage className="w-4 h-4 text-primary shrink-0" />;
  if (f.type.startsWith("video/")) return <FileVideo className="w-4 h-4 text-primary shrink-0" />;
  if (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) return <FileText className="w-4 h-4 text-primary shrink-0" />;
  return <FileIcon className="w-4 h-4 text-primary shrink-0" />;
};

export const FileDropzone = ({
  files,
  onChange,
  maxFiles = 10,
  maxSizeMB = 50,
  accept = "image/*,video/*,application/pdf,application/zip,application/x-zip-compressed,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain",
  disabled,
  hint = "Images, Videos, PDF, Word, ZIP",
  compact,
}: FileDropzoneProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const map: Record<string, string> = {};
    files.forEach((f) => {
      if (f.type.startsWith("image/") || f.type.startsWith("video/")) {
        const k = `${f.name}-${f.size}-${f.lastModified}`;
        if (!previews[k]) map[k] = URL.createObjectURL(f);
        else map[k] = previews[k];
      }
    });
    Object.entries(previews).forEach(([k, url]) => {
      if (!map[k]) URL.revokeObjectURL(url);
    });
    setPreviews(map);
    return () => {
      // cleanup on unmount
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [files]);

  useEffect(() => () => { Object.values(previews).forEach((u) => URL.revokeObjectURL(u)); }, []); // eslint-disable-line

  const handle = (incoming: File[]) => {
    setError(null);
    const oversized = incoming.filter((f) => f.size > maxSizeMB * 1024 * 1024);
    if (oversized.length) { setError(`Too large: ${oversized.map((f) => f.name).join(", ")} (max ${maxSizeMB}MB)`); return; }
    const merged = [...files, ...incoming];
    if (merged.length > maxFiles) { setError(`Maximum ${maxFiles} files`); return; }
    onChange(merged);
  };

  const remove = (idx: number) => {
    const next = [...files];
    next.splice(idx, 1);
    onChange(next);
  };

  return (
    <div className="space-y-2">
      <input ref={inputRef} type="file" multiple accept={accept} className="hidden"
        onChange={(e) => { handle(Array.from(e.target.files || [])); e.target.value = ""; }} />

      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault(); setDragOver(false);
          if (disabled) return;
          handle(Array.from(e.dataTransfer.files || []));
        }}
        onClick={() => !disabled && files.length < maxFiles && inputRef.current?.click()}
        className={cn(
          "rounded-xl border-2 border-dashed transition-all cursor-pointer",
          compact ? "p-3" : "p-5",
          dragOver ? "border-primary bg-primary/10" : "border-border bg-secondary/50 hover:border-primary/50 hover:bg-secondary",
          disabled && "opacity-50 cursor-not-allowed",
        )}
      >
        <div className="flex flex-col items-center justify-center gap-1 text-center">
          <Upload className={cn("text-muted-foreground", compact ? "w-4 h-4" : "w-5 h-5")} />
          <span className={cn("font-medium text-muted-foreground", compact ? "text-xs" : "text-sm")}>
            {files.length >= maxFiles ? `Limit reached (${maxFiles})` : `Drag & drop or tap to ${files.length > 0 ? "add more" : "upload"}`}
          </span>
          <span className="text-[10px] text-muted-foreground/70">{hint} · max {maxSizeMB}MB · up to {maxFiles}</span>
        </div>
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      {files.length > 0 && (
        <div className="space-y-2">
          {files.some((f) => f.type.startsWith("image/") || f.type.startsWith("video/")) && (
            <div className="flex flex-wrap gap-2">
              {files.map((f, i) => {
                const k = `${f.name}-${f.size}-${f.lastModified}`;
                const url = previews[k];
                if (!url) return null;
                return (
                  <div key={k} className="relative group">
                    {f.type.startsWith("video/") ? (
                      <video src={url} className="w-20 h-20 object-cover rounded-lg border-2 border-primary/40 bg-black" muted />
                    ) : (
                      <img src={url} alt={f.name} className="w-20 h-20 object-cover rounded-lg border-2 border-primary/40" />
                    )}
                    <span className="absolute bottom-0.5 right-0.5 bg-success rounded-full p-0.5">
                      <CheckCircle className="w-2.5 h-2.5 text-white" />
                    </span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); remove(i); }}
                      className="absolute -top-1.5 -right-1.5 bg-destructive text-destructive-foreground rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <div className="space-y-1">
            {files.map((f, i) => (
              <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-primary/5 border border-primary/20">
                {iconFor(f)}
                <span className="text-xs flex-1 truncate">{f.name}</span>
                <span className="text-[10px] text-muted-foreground shrink-0">{fmtSize(f.size)}</span>
                <button type="button" onClick={() => remove(i)} className="p-0.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileDropzone;
