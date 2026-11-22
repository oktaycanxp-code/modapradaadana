import { MessageCircle } from 'lucide-react';
import { buildWhatsAppUrl } from '../utils/format';

interface FloatingWhatsAppProps {
  whatsappNumber: string;
  onUnconfiguredClick: () => void;
}

export function FloatingWhatsApp({
  whatsappNumber,
  onUnconfiguredClick,
}: FloatingWhatsAppProps) {
  const waUrl = buildWhatsAppUrl(
    whatsappNumber,
    'Merhaba MODAPRADA, ürünleriniz hakkında bilgi almak istiyorum.',
  );

  if (waUrl) {
    return (
      <a
        href={waUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="WhatsApp ile iletişime geç"
        className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 bg-[#0A0A0A] text-white border border-white/20 px-4 py-3 shadow-2xl hover:bg-[#1C1C20] transition-transform duration-200 hover:-translate-y-0.5"
      >
        <MessageCircle className="w-5 h-5 text-white" />
        <span className="hidden sm:inline text-xs font-semibold tracking-wider uppercase whitespace-nowrap">
          WhatsApp
        </span>
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onUnconfiguredClick}
      aria-label="WhatsApp ile iletişime geç"
      className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2.5 bg-[#0A0A0A] text-white border border-white/20 px-4 py-3 shadow-2xl hover:bg-[#1C1C20] transition-transform duration-200 hover:-translate-y-0.5 cursor-pointer"
    >
      <MessageCircle className="w-5 h-5 text-white" />
      <span className="hidden sm:inline text-xs font-semibold tracking-wider uppercase whitespace-nowrap">
        WhatsApp
      </span>
    </button>
  );
}
