import React, { useState } from 'react';
import {
  CheckCircle2,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import type { CartItem, OrderRecord, StoreSettingsData } from '../types/store';
import {
  buildWhatsAppOrderMessage,
  buildWhatsAppUrl,
  formatTL,
} from '../utils/format';

interface CartDrawerProps {
  open: boolean;
  items: CartItem[];
  settings: StoreSettingsData;
  onClose: () => void;
  onUpdateQty: (productId: number, size: CartItem['size'], delta: number) => void;
  onRemoveItem: (productId: number, size: CartItem['size']) => void;
  onOrderCompleted: () => void;
}

export function CartDrawer({
  open,
  items,
  settings,
  onClose,
  onUpdateQty,
  onRemoveItem,
  onOrderCompleted,
}: CartDrawerProps) {
  const [step, setStep] = useState<'cart' | 'checkout' | 'success'>('cart');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Kapıda Ödeme (Nakit / Kart)');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);

  if (!open) return null;

  const subtotal = items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);

  const handleCheckoutSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName,
          customerPhone,
          customerCity,
          customerAddress,
          paymentMethod,
          items: items.map((item) => ({
            productId: item.productId,
            size: item.size,
            quantity: item.quantity,
          })),
        }),
      });
      const data = (await res.json()) as OrderRecord & { error?: string };
      if (!res.ok) {
        throw new Error(data.error || 'Sipariş tamamlanamadı.');
      }
      setConfirmedOrder(data);
      setStep('success');
      onOrderCompleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sipariş oluşturulurken hata oluştu.');
    } finally {
      setSubmitting(false);
    }
  };

  const resetAndClose = () => {
    setStep('cart');
    setError(null);
    setConfirmedOrder(null);
    onClose();
  };

  const waCartMessage = items.length > 0 ? buildWhatsAppOrderMessage(items) : '';
  const waCartUrl =
    items.length > 0 ? buildWhatsAppUrl(settings.whatsappNumber, waCartMessage) : null;

  const waOrderUrl = confirmedOrder
    ? buildWhatsAppUrl(
        settings.whatsappNumber,
        buildWhatsAppOrderMessage(confirmedOrder.items),
      )
    : null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs">
      <div className="w-full max-w-md bg-white text-[#0A0A0A] h-full flex flex-col shadow-2xl">
        {/* Drawer Header */}
        <div className="px-6 py-5 border-b border-black/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <ShoppingBag className="w-4 h-4" />
            <h2 className="font-display text-base font-bold tracking-wider uppercase">
              {step === 'cart'
                ? `Alışveriş Sepeti (${items.reduce((s, i) => s + i.quantity, 0)})`
                : step === 'checkout'
                  ? 'Teslimat Bilgileri'
                  : 'Sipariş Talebi İletildi'}
            </h2>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            aria-label="Sepeti kapat"
            className="p-2 hover:bg-black/5 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === 'cart' && (
            <>
              {items.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                  <ShoppingBag className="w-10 h-10 text-[#A1A1AA] mb-3" />
                  <p className="font-display text-lg font-semibold text-[#0A0A0A]">
                    Sepetiniz şu an boş
                  </p>
                  <p className="text-sm text-[#71717A] mt-1">
                    Koleksiyondan beğendiğiniz parçaları sepetinize ekleyebilirsiniz.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-black/10">
                  {items.map((item) => (
                    <div
                      key={`${item.productId}-${item.size}`}
                      className="py-4 flex gap-4"
                    >
                      <div className="w-20 h-24 bg-[#F4F4F5] shrink-0 overflow-hidden border border-black/5">
                        {item.imageUrl ? (
                          <img
                            src={item.imageUrl}
                            alt={item.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-[#71717A]">
                            Görsel Yok
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-display text-sm font-semibold text-[#0A0A0A] line-clamp-1">
                              {item.name}
                            </h3>
                            <button
                              type="button"
                              onClick={() => onRemoveItem(item.productId, item.size)}
                              aria-label="Ürünü kaldır"
                              className="text-[#71717A] hover:text-[#0A0A0A] p-0.5 cursor-pointer"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <p className="text-xs text-[#71717A] mt-0.5">
                            Beden: <span className="font-semibold text-[#0A0A0A]">{item.size}</span>
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-3">
                          <div className="inline-flex items-center border border-black/15">
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.productId, item.size, -1)}
                              aria-label="Azalt"
                              className="w-7 h-7 flex items-center justify-center hover:bg-black/5 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-8 text-center text-xs font-mono tabular-nums">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => onUpdateQty(item.productId, item.size, 1)}
                              aria-label="Artır"
                              className="w-7 h-7 flex items-center justify-center hover:bg-black/5 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="text-right tabular-nums">
                            <span className="text-sm font-bold text-[#0A0A0A]">
                              {formatTL(item.unitPrice * item.quantity)}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {step === 'checkout' && (
            <form id="checkout-form" onSubmit={handleCheckoutSubmit} className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Ad Soyad
                </label>
                <input
                  type="text"
                  required
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Adınız ve soyadınız"
                  className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Telefon Numarası
                </label>
                <input
                  type="tel"
                  required
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                  placeholder="05XX XXX XX XX"
                  className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Şehir / İlçe
                </label>
                <input
                  type="text"
                  required
                  value={customerCity}
                  onChange={(e) => setCustomerCity(e.target.value)}
                  placeholder="Örn: İstanbul / Kadıköy"
                  className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Teslimat Adresi
                </label>
                <textarea
                  rows={3}
                  required
                  value={customerAddress}
                  onChange={(e) => setCustomerAddress(e.target.value)}
                  placeholder="Mahalle, sokak, bina ve daire numarası"
                  className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Ödeme Yöntemi
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm border border-black/20 bg-white focus:outline-none focus:border-[#0A0A0A]"
                >
                  <option value="Kapıda Ödeme (Nakit / Kart)">
                    Kapıda Ödeme (Nakit / Kart)
                  </option>
                  <option value="Havale / EFT">Havale / EFT</option>
                </select>
              </div>
            </form>
          )}

          {step === 'success' && confirmedOrder && (
            <div className="py-8 text-center space-y-4">
              <CheckCircle2 className="w-12 h-12 text-[#0A0A0A] mx-auto" />
              <h3 className="font-display text-2xl font-bold">Sipariş Talebiniz Alındı</h3>
              <p className="text-sm text-[#52525B]">
                Talep Kodunuz:{' '}
                <span className="font-mono font-bold text-[#0A0A0A]">
                  {confirmedOrder.orderCode}
                </span>
              </p>
              <p className="text-xs text-[#71717A] max-w-xs mx-auto">
                Siparişiniz mağaza yöneticisinin WhatsApp / telefon onayı sonrasında
                kesinleşecektir.
              </p>

              <div className="bg-[#F4F4F5] p-4 text-left space-y-2 text-xs border border-black/5">
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Müşteri</span>
                  <span className="font-semibold">{confirmedOrder.customerName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#71717A]">Ödeme</span>
                  <span className="font-semibold">{confirmedOrder.paymentMethod}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-black/10">
                  <span className="font-semibold">Toplam Tutar</span>
                  <span className="font-bold tabular-nums">
                    {formatTL(confirmedOrder.totalAmount)}
                  </span>
                </div>
              </div>

              {waOrderUrl && (
                <a
                  href={waOrderUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-5 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-wider inline-flex items-center justify-center gap-2 hover:bg-[#27272A]"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WhatsApp ile Mesajı Gönder</span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'cart' && items.length > 0 && (
          <div className="p-6 border-t border-black/10 bg-[#FAFAFA] space-y-3">
            <div className="flex items-center justify-between pb-1">
              <span className="text-sm text-[#52525B]">Toplam Tutar</span>
              <span className="font-display text-xl font-bold tabular-nums">
                {formatTL(subtotal)}
              </span>
            </div>

            {waCartUrl ? (
              <a
                href={waCartUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full py-4 px-5 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-[0.18em] hover:bg-[#27272A] transition-colors inline-flex items-center justify-center gap-2.5"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WHATSAPP İLE SİPARİŞ VER</span>
              </a>
            ) : (
              <div className="w-full py-3.5 px-4 bg-[#E4E4E7] text-[#52525B] text-xs font-medium text-center">
                WhatsApp sipariş numarası henüz Yönetim Panelinden tanımlanmamış.
              </div>
            )}

            <p className="text-[11px] leading-relaxed text-[#71717A] text-center">
              WhatsApp açıldığında hazırlanan sipariş mesajını kontrol edip göndermeniz
              gerekir. Siparişiniz mağaza onayı ile kesinleşir.
            </p>

            <button
              type="button"
              onClick={() => setStep('checkout')}
              className="w-full py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[#52525B] hover:text-[#0A0A0A] border border-black/15 bg-white transition-colors cursor-pointer"
            >
              Teslimat Formu ile Talep Oluştur
            </button>
          </div>
        )}

        {step === 'checkout' && (
          <div className="p-6 border-t border-black/10 bg-[#FAFAFA] flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('cart')}
              className="px-5 py-3.5 border border-black/20 text-xs font-semibold uppercase tracking-wider hover:bg-black/5 cursor-pointer"
            >
              Geri
            </button>
            <button
              type="submit"
              form="checkout-form"
              disabled={submitting}
              className="flex-1 py-3.5 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-[0.16em] hover:bg-[#27272A] disabled:opacity-60 cursor-pointer"
            >
              {submitting ? 'GÖNDERİLİYOR...' : `TALEBİ İLET (${formatTL(subtotal)})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
