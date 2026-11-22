import { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { ProductItem } from '../types/store';
import { formatTL, getOrderedGallery } from '../utils/format';

interface ProductCardProps {
  product: ProductItem;
  onSelect: (product: ProductItem) => void;
}

export function ProductCard({ product, onSelect }: ProductCardProps) {
  const gallery = getOrderedGallery(product.images);
  const primaryImage = gallery[0] || null;
  const secondaryImage = gallery[1] || null;
  const [imgError, setImgError] = useState(false);

  const hasDiscount =
    product.discountEnabled &&
    product.discountedPrice !== null &&
    product.discountedPrice >= 0;

  const discountLabel =
    product.discountBadgeText.trim() ||
    (product.discountPercentage !== null ? `%${product.discountPercentage} İNDİRİM` : '');

  return (
    <article
      onClick={() => onSelect(product)}
      className="group cursor-pointer flex flex-col bg-white transition-transform duration-200 hover:-translate-y-0.5"
    >
      {/* Image Canvas */}
      <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#F4F4F5] border border-black/5">
        {primaryImage && !imgError ? (
          <>
            <img
              src={primaryImage.url}
              alt={product.name}
              referrerPolicy="no-referrer"
              onError={() => setImgError(true)}
              className={`h-full w-full object-cover transition-all duration-500 ${
                secondaryImage
                  ? 'group-hover:opacity-0'
                  : 'group-hover:scale-[1.03]'
              }`}
            />
            {secondaryImage && (
              <img
                src={secondaryImage.url}
                alt={`${product.name} - 2`}
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-cover opacity-0 transition-all duration-500 group-hover:opacity-100 group-hover:scale-[1.03]"
              />
            )}
          </>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-[#F4F4F5] to-[#E4E4E7] text-[#71717A] p-6 text-center">
            <ImageOff className="w-7 h-7 mb-2 opacity-60" />
            <span className="text-xs font-medium text-[#52525B] line-clamp-1">
              {product.name}
            </span>
          </div>
        )}

        {/* Single sharp editorial discount label if discount enabled */}
        {hasDiscount && discountLabel && (
          <div className="absolute top-3 left-3 bg-[#0A0A0A] text-white text-[11px] font-semibold tracking-wider px-2.5 py-1 uppercase">
            {discountLabel}
          </div>
        )}
      </div>

      {/* Clean unboxed metadata + Title + Manual Pricing */}
      <div className="pt-3.5 pb-1 flex flex-col gap-1">
        <div className="flex items-center gap-1.5 text-xs text-[#71717A]">
          <span>{product.category || 'Tişört'}</span>
          {product.collectionName && (
            <>
              <span aria-hidden="true">·</span>
              <span className="truncate">{product.collectionName}</span>
            </>
          )}
          {gallery.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{gallery.length} Fotoğraf</span>
            </>
          )}
        </div>

        <h3 className="font-display text-base font-semibold text-[#0A0A0A] leading-snug line-clamp-1 group-hover:underline underline-offset-4">
          {product.name}
        </h3>

        <div className="mt-0.5 flex items-baseline gap-2.5 tabular-nums">
          {hasDiscount ? (
            <>
              <span className="text-[15px] font-bold text-[#0A0A0A]">
                {formatTL(product.discountedPrice)}
              </span>
              {product.originalPrice !== null && (
                <span className="text-xs text-[#71717A] line-through">
                  {formatTL(product.originalPrice)}
                </span>
              )}
            </>
          ) : (
            <span className="text-[15px] font-semibold text-[#0A0A0A]">
              {formatTL(product.normalPrice)}
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
