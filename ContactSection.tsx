import { Clock, Instagram, Mail, MapPin, MessageCircle, Phone } from 'lucide-react';
import type { StoreSettingsData } from '../types/store';
import { buildWhatsAppUrl, isSafeExternalUrl } from '../utils/format';

interface ContactSectionProps {
  settings: StoreSettingsData;
  onGoToAdmin: () => void;
}

export function ContactSection({ settings, onGoToAdmin }: ContactSectionProps) {
  const waUrl = buildWhatsAppUrl(
    settings.whatsappNumber,
    'Merhaba MODAPRADA, mağazanızla iletişime geçmek istiyorum.',
  );
  const safeIgUrl = isSafeExternalUrl(settings.instagramUrl)
    ? settings.instagramUrl
    : settings.instagramUsername
      ? `https://instagram.com/${encodeURIComponent(settings.instagramUsername)}`
      : null;

  const hasAnyContact = Boolean(
    settings.phoneNumber ||
      settings.whatsappNumber ||
      settings.instagramUsername ||
      settings.instagramUrl ||
      settings.email ||
      settings.address,
  );

  return (
    <section className="bg-white text-[#0A0A0A] min-h-[75vh] py-16 sm:py-24 px-4 sm:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl mb-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#71717A]">
            İletişim & Destek
          </p>
          <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight mt-3 text-balance">
            MODAPRADA ile doğrudan bağlantıda kalın.
          </h1>
          <p className="text-sm sm:text-base text-[#52525B] mt-4 leading-relaxed">
            Siparişleriniz, beden danışmanlığı, özel kapsül koleksiyonlar ve mağaza bilgileri
            için resmi iletişim kanallarımızdan bize ulaşabilirsiniz.
          </p>
        </div>

        {!hasAnyContact ? (
          <div className="border border-black/10 bg-[#FAFAFA] p-10 text-center space-y-4">
            <p className="font-display text-xl font-semibold">
              İletişim bilgileri henüz tanımlanmamış
            </p>
            <p className="text-sm text-[#52525B] max-w-md mx-auto">
              Mağaza yöneticisi olarak telefon, WhatsApp ve Instagram bilgilerinizi Yönetim
              Paneli üzerinden ekleyebilirsiniz.
            </p>
            <button
              type="button"
              onClick={onGoToAdmin}
              className="px-6 py-3 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#27272A] transition-colors cursor-pointer"
            >
              Yönetim Paneline Git
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Phone */}
            <div className="border border-black/10 p-7 flex flex-col justify-between bg-[#FAFAFA]">
              <div>
                <Phone className="w-5 h-5 text-[#0A0A0A] mb-5" />
                <h2 className="font-display text-lg font-bold">Telefon</h2>
                <p className="text-sm text-[#52525B] mt-1">
                  Müşteri hizmetleri ve sipariş desteği
                </p>
              </div>
              <div className="mt-6">
                {settings.phoneNumber ? (
                  <a
                    href={`tel:${settings.phoneNumber.replace(/\s+/g, '')}`}
                    className="font-mono text-base font-semibold text-[#0A0A0A] hover:underline tabular-nums"
                  >
                    {settings.phoneNumber}
                  </a>
                ) : (
                  <span className="text-sm text-[#A1A1AA]">Belirtilmedi</span>
                )}
              </div>
            </div>

            {/* WhatsApp */}
            <div className="border border-black/10 p-7 flex flex-col justify-between bg-[#FAFAFA]">
              <div>
                <MessageCircle className="w-5 h-5 text-[#0A0A0A] mb-5" />
                <h2 className="font-display text-lg font-bold">WhatsApp Hattı</h2>
                <p className="text-sm text-[#52525B] mt-1">
                  Hızlı beden bilgisi ve canlı sipariş desteği
                </p>
              </div>
              <div className="mt-6">
                {waUrl ? (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-wider hover:bg-[#27272A] transition-colors"
                  >
                    <span>WhatsApp ile Yazın</span>
                  </a>
                ) : (
                  <span className="text-sm text-[#A1A1AA]">Belirtilmedi</span>
                )}
              </div>
            </div>

            {/* Instagram */}
            <div className="border border-black/10 p-7 flex flex-col justify-between bg-[#FAFAFA]">
              <div>
                <Instagram className="w-5 h-5 text-[#0A0A0A] mb-5" />
                <h2 className="font-display text-lg font-bold">Instagram</h2>
                <p className="text-sm text-[#52525B] mt-1">
                  Yeni droplar, lookbook ve sokak stili
                </p>
              </div>
              <div className="mt-6">
                {safeIgUrl ? (
                  <a
                    href={safeIgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 font-semibold text-sm text-[#0A0A0A] underline underline-offset-4 hover:opacity-75"
                  >
                    <span>
                      {settings.instagramUsername
                        ? `@${settings.instagramUsername}`
                        : 'Instagram Profilini Aç'}
                    </span>
                  </a>
                ) : (
                  <span className="text-sm text-[#A1A1AA]">Belirtilmedi</span>
                )}
              </div>
            </div>

            {/* Email */}
            {settings.email && (
              <div className="border border-black/10 p-7 flex flex-col justify-between bg-white">
                <div>
                  <Mail className="w-5 h-5 text-[#0A0A0A] mb-5" />
                  <h2 className="font-display text-lg font-bold">E-posta</h2>
                </div>
                <a
                  href={`mailto:${settings.email}`}
                  className="mt-4 text-sm font-semibold text-[#0A0A0A] hover:underline break-all"
                >
                  {settings.email}
                </a>
              </div>
            )}

            {/* Address */}
            {settings.address && (
              <div className="border border-black/10 p-7 flex flex-col justify-between bg-white">
                <div>
                  <MapPin className="w-5 h-5 text-[#0A0A0A] mb-5" />
                  <h2 className="font-display text-lg font-bold">Showroom & Atölye</h2>
                </div>
                <p className="mt-4 text-sm text-[#3F3F46] leading-relaxed">
                  {settings.address}
                </p>
              </div>
            )}

            {/* Working Hours */}
            {settings.workingHours && (
              <div className="border border-black/10 p-7 flex flex-col justify-between bg-white">
                <div>
                  <Clock className="w-5 h-5 text-[#0A0A0A] mb-5" />
                  <h2 className="font-display text-lg font-bold">Çalışma Saatleri</h2>
                </div>
                <p className="mt-4 text-sm text-[#3F3F46]">{settings.workingHours}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
