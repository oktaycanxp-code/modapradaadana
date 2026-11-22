import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Expand,
  ImageOff,
  MessageCircle,
  Minus,
  Plus,
  ShoppingBag,
  X,
} from 'lucide-react';
import {
  PRODUCT_SIZES,
  type ProductItem,
  type ProductSize,
  type StoreSettingsData,
} from '../types/store';
import {
  buildWhatsAppOrderMessage,
  buildWhatsAppUrl,
  formatTL,
  getEffectivePrice,
  getOrderedGallery,
} from '../utils/format';

interface ProductDetailModalProps {
  product: ProductItem;
  settings: StoreSettingsData;
  onClose: () => void;
  onAddToCart: (product: ProductItem, size: ProductSize, quantity?: number) => void;
}

export function ProductDetailModal({
  product,
  settings,
  onClose,
  onAddToCart,
}: ProductDetailModalProps) {
  const gallery = useMemo(() => getOrderedGallery(product.images), [product.images]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectedSize, setSelectedSize] = useState<ProductSize>('M');
  const [quantity, setQuantity] = useState(1);
  const [addedFeedback, setAddedFeedback] = useState(false);

  // Touch swipe state for smooth mobile horizontal transitions
  const touchStartX = useRef<number | null>(null);
  const [dragOffset, setDragOffset] = useState(0);

  // Reset gallery index whenever product changes
  useEffect(() => {
    setCurrentIndex(0);
    setLightboxOpen(false);
    setSelectedSize('M');
    setQuantity(1);
  }, [product]);

  const goPrev = useCallback(() => {
    if (gallery.length <= 1) return;
    setCurrentIndex((prev) => (prev - 1 + gallery.length) % gallery.length);
  }, [gallery.length]);

  const goNext = useCallback(() => {
    if (gallery.length <= 1) return;
    setCurrentIndex((prev) => (prev + 1) % gallery.length);
  }, [gallery.length]);

  // Keyboard navigation
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxOpen) {
          setLightboxOpen(false);
        } else {
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        goPrev();
      } else if (e.key === 'ArrowRight') {
        goNext();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goNext, goPrev, lightboxOpen, onClose]);

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (touchStartX.current === null || gallery.length <= 1) return;
    const diff = e.touches[0].clientX - touchStartX.current;
    setDragOffset(diff);
  };

  const handleTouchEnd = () => {
    if (touchStartX.current === null) return;
    if (dragOffset < -45) {
      goNext();
    } else if (dragOffset > 45) {
      goPrev();
    }
    touchStartX.current = null;
    setDragOffset(0);
  };

  const hasDiscount =
    product.discountEnabled &&
    product.discountedPrice !== null &&
    product.discountedPrice >= 0;

  const discountLabel =
    product.discountBadgeText.trim() ||
    (product.discountPercentage !== null ? `%${product.discountPercentage} İNDİRİM` : '');

  const activePrice = getEffectivePrice(product);
  const waOrderMessage = buildWhatsAppOrderMessage([
    {
      name: product.name,
      size: selectedSize,
      quantity,
      unitPrice: activePrice,
    },
  ]);
  const waUrl = buildWhatsAppUrl(settings.whatsappNumber, waOrderMessage);

  const handleAdd = () => {
    onAddToCart(product, selectedSize, quantity);
    setAddedFeedback(true);
    window.setTimeout(() => setAddedFeedback(false), 1800);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-0 sm:p-6 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={product.name}
    >
      <div className="relative w-full max-w-6xl bg-white text-[#0A0A0A] sm:max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col lg:grid lg:grid-cols-12">
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Kapat"
          className="fixed sm:absolute top-4 right-4 z-30 w-10 h-10 bg-white/95 text-[#0A0A0A] border border-black/15 flex items-center justify-center hover:bg-[#0A0A0A] hover:text-white transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Left: Unlimited Interactive Product Gallery */}
        <div className="lg:col-span-7 bg-[#F4F4F5] flex flex-col">
          {/* Main Slider Frame */}
          <div
            className="relative aspect-[4/5] w-full overflow-hidden select-none touch-pan-y"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {gallery.length > 0 ? (
              <div
                className="flex h-full w-full transition-transform duration-300 ease-out"
                style={{
                  transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
                }}
              >
                {gallery.map((img, idx) => (
                  <div
                    key={img.id}
                    className="w-full h-full shrink-0 relative cursor-zoom-in"
                    onClick={() => setLightboxOpen(true)}
                  >
                    <img
                      src={img.url}
                      alt={`${product.name} - Görsel ${idx + 1}`}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-[#71717A] p-8">
                <ImageOff className="w-10 h-10 mb-3 opacity-50" />
                <span className="text-sm font-medium">Henüz ürün fotoğrafı eklenmemiş</span>
              </div>
            )}

            {/* Desktop Prev / Next Arrows */}
            {gallery.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goPrev();
                  }}
                  aria-label="Önceki fotoğraf"
                  className="hidden sm:flex absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 text-[#0A0A0A] border border-black/10 items-center justify-center hover:bg-[#0A0A0A] hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    goNext();
                  }}
                  aria-label="Sonraki fotoğraf"
                  className="hidden sm:flex absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 text-[#0A0A0A] border border-black/10 items-center justify-center hover:bg-[#0A0A0A] hover:text-white transition-colors cursor-pointer"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </>
            )}

            {/* Expand to full-size gallery button + slide counter */}
            {gallery.length > 0 && (
              <div className="absolute top-4 left-4 flex items-center gap-2">
                <span className="bg-[#0A0A0A]/80 text-white text-xs font-mono tabular-nums px-2.5 py-1">
                  {currentIndex + 1} / {gallery.length}
                </span>
              </div>
            )}

            {gallery.length > 0 && (
              <button
                type="button"
                onClick={() => setLightboxOpen(true)}
                aria-label="Tam ekran büyüt"
                className="absolute bottom-4 right-4 bg-white/90 text-[#0A0A0A] border border-black/10 px-3 py-1.5 text-xs font-medium inline-flex items-center gap-1.5 hover:bg-[#0A0A0A] hover:text-white transition-colors cursor-pointer"
              >
                <Expand className="w-3.5 h-3.5" />
                <span>Büyüt</span>
              </button>
            )}

            {/* Mobile Pagination Dots (supports unlimited photos via scrollable strip) */}
            {gallery.length > 1 && (
              <div className="sm:hidden absolute bottom-4 left-1/2 -translate-x-1/2 max-w-[70%] overflow-x-auto no-scrollbar bg-black/50 backdrop-blur-sm px-2.5 py-1.5 flex items-center gap-1.5">
                {gallery.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    aria-label={`Fotoğraf ${idx + 1}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentIndex(idx);
                    }}
                    className={`shrink-0 transition-all cursor-pointer ${
                      idx === currentIndex
                        ? 'w-5 h-1.5 bg-white'
                        : 'w-1.5 h-1.5 bg-white/45 hover:bg-white/75'
                    }`}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Desktop & Tablet Unlimited Thumbnail Strip */}
          {gallery.length > 1 && (
            <div className="p-3 sm:p-4 bg-white border-t border-black/5 flex items-center gap-2.5 overflow-x-auto">
              {gallery.map((img, idx) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setCurrentIndex(idx)}
                  aria-label={`Küçük görsel ${idx + 1}`}
                  className={`relative w-16 h-20 shrink-0 overflow-hidden border transition-all cursor-pointer ${
                    idx === currentIndex
                      ? 'border-[#0A0A0A] ring-1 ring-[#0A0A0A]'
                      : 'border-black/10 opacity-65 hover:opacity-100'
                  }`}
                >
                  <img
                    src={img.url}
                    alt={`${product.name} küçük önizleme ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Contiguous Purchase Module */}
        <div className="lg:col-span-5 p-6 sm:p-8 lg:p-10 flex flex-col justify-between bg-white">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#71717A] uppercase tracking-wider">
              <span>{product.category || 'Tişört'}</span>
              {product.collectionName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{product.collectionName}</span>
                </>
              )}
            </div>

            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#0A0A0A] mt-2 leading-tight">
              {product.name}
            </h2>

            {/* Manual Discount & Price Display */}
            <div className="mt-5 pb-5 border-b border-black/10">
              {hasDiscount ? (
                <div className="flex flex-wrap items-center gap-3 tabular-nums">
                  <span className="font-display text-2xl sm:text-3xl font-bold text-[#0A0A0A]">
                    {formatTL(product.discountedPrice)}
                  </span>
                  {product.originalPrice !== null && (
                    <span className="text-base text-[#71717A] line-through">
                      {formatTL(product.originalPrice)}
                    </span>
                  )}
                  {discountLabel && (
                    <span className="bg-[#0A0A0A] text-white text-xs font-semibold tracking-wider px-2.5 py-1 uppercase">
                      {discountLabel}
                    </span>
                  )}
                </div>
              ) : (
                <span className="font-display text-2xl sm:text-3xl font-bold text-[#0A0A0A] tabular-nums">
                  {formatTL(product.normalPrice)}
                </span>
              )}
            </div>

            {/* Description */}
            {product.description && (
              <div className="mt-5">
                <p className="text-sm leading-relaxed text-[#3F3F46] whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}

            {/* Sizes (Fixed: S, M, L, XL) */}
            <div className="mt-7">
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="font-semibold uppercase tracking-wider text-[#0A0A0A]">
                  Beden Seçimi
                </span>
                <span className="text-[#71717A]">{selectedSize}</span>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {PRODUCT_SIZES.map((sz) => {
                  const isSelected = selectedSize === sz;
                  return (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setSelectedSize(sz)}
                      className={`py-3 text-sm font-semibold border transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                          : 'bg-white text-[#0A0A0A] border-black/20 hover:border-[#0A0A0A]'
                      }`}
                    >
                      {sz}
                    </button>
                  );
                })}
              </div>

              {/* Quantity Selector */}
              <div className="mt-5 flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#0A0A0A]">
                  Adet
                </span>
                <div className="inline-flex items-center border border-black/20">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Adet azalt"
                    className="w-9 h-9 flex items-center justify-center hover:bg-black/5 cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-10 text-center text-sm font-mono tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    aria-label="Adet artır"
                    className="w-9 h-9 flex items-center justify-center hover:bg-black/5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Primary Purchase Actions */}
          <div className="mt-8 pt-6 border-t border-black/10 space-y-3">
            <button
              type="button"
              onClick={handleAdd}
              className="w-full py-4 px-6 text-xs font-bold tracking-[0.18em] uppercase inline-flex items-center justify-center gap-2.5 transition-colors bg-[#0A0A0A] text-white hover:bg-[#27272A] cursor-pointer"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>{addedFeedback ? 'SEPETE EKLENDİ' : 'SEPETE EKLE'}</span>
            </button>

            {waUrl ? (
              <>
                <a
                  href={waUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full py-3.5 px-6 text-xs font-bold tracking-[0.16em] uppercase border border-[#0A0A0A] text-[#0A0A0A] hover:bg-[#0A0A0A] hover:text-white transition-colors inline-flex items-center justify-center gap-2"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>WHATSAPP İLE SİPARİŞ VER</span>
                </a>
                <p className="text-[11px] text-[#71717A] text-center leading-relaxed">
                  WhatsApp mesajını inceleyip gönderdikten sonra siparişiniz mağaza onayı
                  ile kesinleşir.
                </p>
              </>
            ) : (
              <div className="w-full py-3 px-4 bg-[#F4F4F5] text-[#71717A] text-xs text-center border border-black/10">
                WhatsApp sipariş hattı henüz Yönetim Panelinden tanımlanmamış.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Fullscreen High-Resolution Lightbox */}
      {lightboxOpen && gallery[currentIndex] && (
        <div
          className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="absolute top-4 left-4 right-4 flex items-center justify-between text-white z-20">
            <span className="font-mono text-xs tabular-nums bg-white/10 px-3 py-1.5">
              {currentIndex + 1} / {gallery.length}
            </span>
            <button
              type="button"
              onClick={() => setLightboxOpen(false)}
              aria-label="Tam ekrandan çık"
              className="w-10 h-10 bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <img
            src={gallery[currentIndex].url}
            alt={`${product.name} tam boyut ${currentIndex + 1}`}
            referrerPolicy="no-referrer"
            className="max-h-[86vh] max-w-[94vw] object-contain select-none"
          />

          {gallery.length > 1 && (
            <>
              <button
                type="button"
                onClick={goPrev}
                aria-label="Önceki"
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={goNext}
                aria-label="Sonraki"
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 bg-white/10 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
