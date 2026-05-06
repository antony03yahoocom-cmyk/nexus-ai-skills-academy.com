import { MessageCircle } from "lucide-react";

const WHATSAPP_GROUP_URL = "https://chat.whatsapp.com/GdHfJutCYlX7xitn3gC71o";

interface Props {
  variant?: "floating" | "inline" | "compact";
  className?: string;
}

const WhatsAppButton = ({ variant = "inline", className = "" }: Props) => {
  if (variant === "floating") {
    return (
      <a
        href={WHATSAPP_GROUP_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Join our WhatsApp Community"
        className={`fixed bottom-24 right-5 z-40 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg bg-[#25D366] hover:bg-[#1ebe57] text-white font-medium transition-all hover:scale-105 ${className}`}
      >
        <MessageCircle className="w-5 h-5" />
        <span className="hidden sm:inline text-sm">WhatsApp Community</span>
      </a>
    );
  }
  if (variant === "compact") {
    return (
      <a
        href={WHATSAPP_GROUP_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366]/20 text-sm font-medium transition-colors ${className}`}
      >
        <MessageCircle className="w-4 h-4" />
        WhatsApp Group
      </a>
    );
  }
  return (
    <a
      href={WHATSAPP_GROUP_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#25D366] hover:bg-[#1ebe57] text-white font-semibold shadow-md transition-all hover:scale-[1.02] ${className}`}
    >
      <MessageCircle className="w-5 h-5" />
      Join WhatsApp Community
    </a>
  );
};

export default WhatsAppButton;
