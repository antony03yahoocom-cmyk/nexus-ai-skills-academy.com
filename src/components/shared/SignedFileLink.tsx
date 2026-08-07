import { Upload } from "lucide-react";
import { useSignedStorageUrl } from "@/hooks/useSignedStorageUrl";

const IMAGE_RE = /\.(jpg|jpeg|png|gif|webp)(\?|$)/i;

interface Props {
  url: string;
  label?: string;
  imageClassName?: string;
}

/** Renders a private-storage file as an image preview or link, using a signed URL. */
export function SignedFileLink({ url, label = "View File", imageClassName }: Props) {
  const signed = useSignedStorageUrl(url);
  if (!signed) {
    return <span className="text-xs text-muted-foreground">Loading file…</span>;
  }
  if (IMAGE_RE.test(url)) {
    return (
      <a href={signed} target="_blank" rel="noreferrer">
        <img
          src={signed}
          alt={label}
          className={imageClassName ?? "max-w-[120px] max-h-[90px] rounded-lg border border-border object-cover"}
        />
      </a>
    );
  }
  return (
    <a href={signed} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline flex items-center gap-1">
      <Upload className="w-3 h-3" /> {label}
    </a>
  );
}
