import { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Instagram,
  Search,
  Sparkles,
} from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { Navbar, type ActivePage } from './components/Navbar';
import { ProductCard } from './components/ProductCard';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartDrawer } from './components/CartDrawer';
import { ContactSection } from './components/ContactSection';
import { FloatingWhatsApp } from './components/FloatingWhatsApp';
import { AdminDashboard } from './components/AdminDashboard';
import {
  PRODUCT_SIZES,
  type CartItem,
  type ProductItem,
  type ProductSize,
  type StoreSettingsData,
} from './types/store';
import {
  buildWhatsAppUrl,
  getEffectivePrice,
  getOrderedGallery,
  isSafeExternalUrl,
} from './utils/format';

const HERO_IMAGE = '/src/assets/images/hero_modaprada_campaign_1795315811032.jpg';
const COLLECTION_NOIR_IMAGE =
  '/src/assets/images/collection_noir_capsule_1795315810884.jpg';
const COLLECTION_MONOLITH_IMAGE =
  '/src/assets/images/collection_monolith_drop_1795315811516.jpg';
const ATELIER_IMAGE = '/src/assets/images/editorial_atelier_studio_1795315811145.jpg';

const EMPTY_SETTINGS: StoreSettingsData = {
  phoneNumber: '',
  whatsappNumber: '',
  instagramUsername: '',
  instagramUrl: '',
  email: '',
  address: '',
  workingHours: '',
};

const CART_STORAGE_KEY = 'modaprada_cart_v1';

function loadSavedCart(): CartItem[] {
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const validSizeSet = new Set<string>(PRODUCT_SIZES);
    return parsed.filter((item): item is CartItem => {
      if (typeof item !== 'object' || item === null) return false;
      const obj = item as Record<string, unknown>;
      return (
        typeof obj.productId === 'number' &&
        Number.isInteger(obj.productId) &&
        obj.productId > 0 &&
        typeof obj.name === 'string' &&
        typeof obj.size === 'string' &&
        validSizeSet.has(obj.size) &&
        typeof obj.quantity === 'number' &&
        obj.quantity > 0 &&
        typeof obj.unitPrice === 'number'
      );
    });
  } catch {
    return [];
  }
}

function StorefrontApp() {
  const [activePage, setActivePage] = useState<ActivePage>('store');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [settings, setSettings] = useState<StoreSettingsData>(EMPTY_SETTINGS);
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>(loadSavedCart);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    } catch {
      // Ignore storage quota errors
    }
  }, [cart]);

  // Catalog filter & search
  const [catalogFilter, setCatalogFilter] = useState<string>('Tümü');
  const [searchQuery, setSearchQuery] = useState('');

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => {
      setToast((curr) => (curr === msg ? null : curr));
    }, 3000);
  }, []);

  const loadStoreData = useCallback(async () => {
    try {
      const [prodRes, setRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/settings'),
      ]);
      if (prodRes.ok) {
        const data = (await prodRes.json()) as ProductItem[];
        setProducts(data);
      }
      if (setRes.ok) {
        const sData = (await setRes.json()) as StoreSettingsData;
        setSettings(sData);
      }
    } catch {
      // Keep interactive storefront available even if a transient request fails
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  useEffect(() => {
    void loadStoreData();
  }, [loadStoreData]);

  const handleNavigate = (page: ActivePage, sectionId?: string) => {
    setActivePage(page);
    if (page === 'store') {
      if (sectionId) {
        window.setTimeout(() => {
          const el = document.getElementById(sectionId);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        }, 60);
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAddToCart = (product: ProductItem, size: ProductSize, quantity = 1) => {
    const qty = Math.max(1, Math.floor(quantity));
    const gallery = getOrderedGallery(product.images);
    const primaryUrl = gallery[0]?.url || null;
    const unitPrice = getEffectivePrice(product);
    const originalPrice =
      product.discountEnabled && product.originalPrice !== null
        ? product.originalPrice
        : null;

    setCart((prev) => {
      const idx = prev.findIndex(
        (item) => item.productId === product.id && item.size === size,
      );
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + qty };
        return copy;
      }
      return [
        ...prev,
        {
          productId: product.id,
          name: product.name,
          size,
          quantity: qty,
          unitPrice,
          originalPrice,
          imageUrl: primaryUrl,
        },
      ];
    });
    showToast(`${product.name} (${size}) sepete eklendi.`);
  };

  const handleUpdateCartQty = (productId: number, size: ProductSize, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) =>
          item.productId === productId && item.size === size
            ? { ...item, quantity: item.quantity + delta }
            : item,
        )
        .filter((item) => item.quantity > 0),
    );
  };

  const handleRemoveCartItem = (productId: number, size: ProductSize) => {
    setCart((prev) =>
      prev.filter((item) => !(item.productId === productId && item.size === size)),
    );
  };

  const newArrivals = useMemo(
    () => products.filter((p) => p.isNewArrival),
    [products],
  );
  const featuredProducts = useMemo(
    () => products.filter((p) => p.isFeatured),
    [products],
  );

  const dynamicCategories = useMemo(() => {
    const cats = Array.from(
      new Set(products.map((p) => p.category.trim()).filter(Boolean)),
    );
    return ['Tümü', 'Yeni Gelenler', ...cats];
  }, [products]);

  const filteredAllProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (catalogFilter === 'Yeni Gelenler' && !p.isNewArrival) return false;
      if (
        catalogFilter !== 'Tümü' &&
        catalogFilter !== 'Yeni Gelenler' &&
        p.category.trim() !== catalogFilter
      ) {
        return false;
      }
      if (q) {
        const hay = `${p.name} ${p.category} ${p.collectionName} ${p.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [catalogFilter, products, searchQuery]);

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  const safeIgUrl = isSafeExternalUrl(settings.instagramUrl)
    ? settings.instagramUrl
    : settings.instagramUsername
      ? `https://instagram.com/${encodeURIComponent(settings.instagramUsername)}`
      : null;

  const waFooterUrl = buildWhatsAppUrl(
    settings.whatsappNumber,
    'Merhaba MODAPRADA, ürünleriniz hakkında bilgi almak istiyorum.',
  );

  return (
    <div className="min-h-screen flex flex-col bg-white text-[#0A0A0A]">
      <Navbar
        activePage={activePage}
        cartCount={cartCount}
        onNavigate={handleNavigate}
        onOpenCart={() => setCartOpen(true)}
      />

      {/* Non-blocking subtle toast */}
      {toast && (
        <div className="fixed bottom-20 right-5 z-50 bg-[#0A0A0A] text-white px-5 py-3 text-xs font-semibold tracking-wider border border-white/15 shadow-2xl">
          {toast}
        </div>
      )}

      <main className="flex-1">
        {activePage === 'admin' ? (
          <AdminDashboard
            settings={settings}
            onSettingsUpdated={(next) => setSettings(next)}
            onProductsChanged={() => void loadStoreData()}
            onExitAdmin={() => handleNavigate('store')}
          />
        ) : activePage === 'contact' ? (
          <ContactSection
            settings={settings}
            onGoToAdmin={() => handleNavigate('admin')}
          />
        ) : (
          <>
            {/* 1. FULL-WIDTH FASHION CAMPAIGN HERO */}
            <section
              id="hero"
              className="relative w-full min-h-[78vh] lg:min-h-[86vh] bg-[#0A0A0A] text-white overflow-hidden flex items-end"
            >
              <img
                src={HERO_IMAGE}
                alt="MODAPRADA Sokak Modası Kampanyası"
                referrerPolicy="no-referrer"
                className="absolute inset-0 w-full h-full object-cover object-center opacity-85"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] via-[#0A0A0A]/45 to-black/20" />

              <div className="relative z-10 max-w-[1440px] mx-auto w-full px-4 sm:px-8 pb-14 sm:pb-20 pt-28">
                <motion.div
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                  className="max-w-3xl"
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#D4D4D8] mb-4">
                    MODAPRADA
                  </p>
                  <h1 className="font-display text-4xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight leading-[1.02] text-balance">
                    TARZINI ORTAYA KOY.
                  </h1>
                  <p className="text-base sm:text-xl text-[#E4E4E7] mt-5 max-w-xl leading-relaxed">
                    Modern sokak modasının yeni adresi.
                  </p>

                  <div className="mt-8 flex flex-wrap items-center gap-4">
                    <button
                      type="button"
                      onClick={() => handleNavigate('store', 'tum-urunler')}
                      className="px-8 py-4 bg-white text-[#0A0A0A] text-xs font-bold uppercase tracking-[0.2em] hover:bg-[#E4E4E7] transition-colors inline-flex items-center gap-3 cursor-pointer whitespace-nowrap"
                    >
                      <span>ALIŞVERİŞE BAŞLA</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              </div>
            </section>

            {/* 2. NEW ARRIVALS */}
            <section
              id="yeni-gelenler"
              className="py-16 sm:py-24 px-4 sm:px-8 border-b border-black/8 bg-white"
            >
              <div className="max-w-[1440px] mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-10">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#71717A]">
                      Sezon Seçkisi
                    </p>
                    <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1.5">
                      Yeni Gelenler
                    </h2>
                  </div>
                  {products.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setCatalogFilter('Yeni Gelenler');
                        handleNavigate('store', 'tum-urunler');
                      }}
                      className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0A0A0A] border-b border-[#0A0A0A] pb-1 self-start sm:self-auto hover:opacity-70 cursor-pointer"
                    >
                      Tümünü Gör
                    </button>
                  )}
                </div>

                {loadingProducts ? (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="space-y-3">
                        <div className="aspect-[4/5] bg-[#F4F4F5] animate-pulse" />
                        <div className="h-4 w-2/3 bg-[#F4F4F5] animate-pulse" />
                        <div className="h-4 w-1/3 bg-[#F4F4F5] animate-pulse" />
                      </div>
                    ))}
                  </div>
                ) : newArrivals.length === 0 ? (
                  <div className="border border-black/10 bg-[#FAFAFA] p-10 sm:p-14 text-center space-y-4">
                    <Sparkles className="w-7 h-7 text-[#0A0A0A] mx-auto opacity-70" />
                    <h3 className="font-display text-xl font-bold">
                      Koleksiyon Mağaza Sahibi Tarafından Hazırlanıyor
                    </h3>
                    <p className="text-sm text-[#52525B] max-w-lg mx-auto leading-relaxed">
                      MODAPRADA mağazanızda örnek veya sahte ürün bulunmaz. Yönetim
                      Paneli üzerinden kendi ürünlerinizi, fotoğraflarınızı ve
                      fiyatlarınızı ekleyerek satışa başlayabilirsiniz.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleNavigate('admin')}
                      className="px-7 py-3.5 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-[0.16em] hover:bg-[#27272A] transition-colors cursor-pointer"
                    >
                      Yönetim Panelinden Ürün Ekle
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10 sm:gap-x-7">
                    {newArrivals.slice(0, 8).map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onSelect={setSelectedProduct}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 3. ALL PRODUCTS CATALOG */}
            <section
              id="tum-urunler"
              className="py-16 sm:py-24 px-4 sm:px-8 bg-white border-b border-black/8"
            >
              <div className="max-w-[1440px] mx-auto">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#71717A]">
                      MODAPRADA Arşiv & Mağaza
                    </p>
                    <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1.5">
                      Tüm Ürünler
                    </h2>
                  </div>

                  {/* Filter Tabs + Search */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar border border-black/10 p-1 bg-[#FAFAFA]">
                      {dynamicCategories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setCatalogFilter(cat)}
                          className={`px-3.5 py-2 text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                            catalogFilter === cat
                              ? 'bg-[#0A0A0A] text-white'
                              : 'text-[#52525B] hover:text-[#0A0A0A]'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <div className="relative">
                      <Search className="w-4 h-4 text-[#71717A] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="search"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Ürün ara..."
                        className="pl-9 pr-4 py-2.5 text-xs border border-black/15 bg-white w-full sm:w-56 focus:outline-none focus:border-[#0A0A0A]"
                      />
                    </div>
                  </div>
                </div>

                {filteredAllProducts.length === 0 ? (
                  <div className="border border-black/10 bg-[#FAFAFA] p-10 text-center space-y-3">
                    <p className="font-display text-lg font-semibold">
                      {products.length === 0
                        ? 'Mağazada henüz yayınlanmış ürün bulunmuyor'
                        : 'Aramanızla eşleşen ürün bulunamadı'}
                    </p>
                    {products.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCatalogFilter('Tümü');
                          setSearchQuery('');
                        }}
                        className="text-xs font-semibold uppercase tracking-wider underline underline-offset-4 cursor-pointer"
                      >
                        Filtreleri Temizle
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-10 sm:gap-x-7">
                    {filteredAllProducts.map((product) => (
                      <ProductCard
                        key={product.id}
                        product={product}
                        onSelect={setSelectedProduct}
                      />
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 5. FEATURED COLLECTIONS */}
            <section
              id="koleksiyonlar"
              className="py-16 sm:py-24 px-4 sm:px-8 bg-[#0A0A0A] text-white"
            >
              <div className="max-w-[1440px] mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-12">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9A9AA0]">
                      Kampanya & Koleksiyonlar
                    </p>
                    <h2 className="font-display text-2xl sm:text-4xl font-bold tracking-tight mt-1.5">
                      Öne Çıkan Koleksiyonlar
                    </h2>
                  </div>
                </div>

                {/* Editorial Campaign Split */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="group relative aspect-[4/3] overflow-hidden bg-[#141416]">
                    <img
                      src={COLLECTION_NOIR_IMAGE}
                      alt="MODAPRADA Noir Kapsül"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[#D4D4D8]">
                          Kapsül 01
                        </p>
                        <h3 className="font-display text-2xl font-bold mt-1">
                          Siyah & Antrasit Silüetler
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleNavigate('store', 'tum-urunler')}
                        className="px-4 py-2.5 bg-white text-[#0A0A0A] text-xs font-bold uppercase tracking-wider shrink-0 hover:bg-[#E4E4E7] cursor-pointer"
                      >
                        Keşfet
                      </button>
                    </div>
                  </div>

                  <div className="group relative aspect-[4/3] overflow-hidden bg-[#141416]">
                    <img
                      src={COLLECTION_MONOLITH_IMAGE}
                      alt="MODAPRADA Ağır Gramaj Pamuk Serisi"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 opacity-90"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
                    <div className="absolute bottom-6 left-6 right-6 flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[11px] uppercase tracking-[0.22em] text-[#D4D4D8]">
                          Kapsül 02
                        </p>
                        <h3 className="font-display text-2xl font-bold mt-1">
                          Ağır Gramaj Monolit Seri
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleNavigate('store', 'tum-urunler')}
                        className="px-4 py-2.5 bg-white text-[#0A0A0A] text-xs font-bold uppercase tracking-wider shrink-0 hover:bg-[#E4E4E7] cursor-pointer"
                      >
                        Keşfet
                      </button>
                    </div>
                  </div>
                </div>

                {/* Featured Products selected by Admin */}
                {featuredProducts.length > 0 && (
                  <div className="mt-14 pt-12 border-t border-white/10">
                    <h3 className="font-display text-xl font-bold mb-7">
                      Editörün Öne Çıkardıkları
                    </h3>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                      {featuredProducts.map((product) => {
                        const gallery = getOrderedGallery(product.images);
                        const thumb = gallery[0]?.url;
                        const activePrice = getEffectivePrice(product);
                        return (
                          <div
                            key={product.id}
                            onClick={() => setSelectedProduct(product)}
                            className="group cursor-pointer bg-[#141416] border border-white/10 overflow-hidden hover:border-white/30 transition-colors"
                          >
                            <div className="aspect-[4/5] bg-[#1C1C20] overflow-hidden">
                              {thumb ? (
                                <img
                                  src={thumb}
                                  alt={product.name}
                                  referrerPolicy="no-referrer"
                                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs text-[#9A9AA0]">
                                  Görsel Yok
                                </div>
                              )}
                            </div>
                            <div className="p-4">
                              <p className="text-xs text-[#9A9AA0]">{product.category}</p>
                              <h4 className="font-display text-base font-semibold mt-0.5 line-clamp-1">
                                {product.name}
                              </h4>
                              <p className="text-sm font-bold mt-1 tabular-nums">
                                {new Intl.NumberFormat('tr-TR').format(activePrice)} TL
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </section>

            {/* 6. INSTAGRAM SECTION */}
            <section className="py-16 sm:py-24 px-4 sm:px-8 bg-[#F7F7F6] text-[#0A0A0A]">
              <div className="max-w-[1440px] mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                <div className="lg:col-span-7 aspect-[4/3] overflow-hidden bg-[#141416]">
                  <img
                    src={ATELIER_IMAGE}
                    alt="MODAPRADA Atölye ve Instagram Dünyası"
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="lg:col-span-5 space-y-5">
                  <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[#52525B]">
                    <Instagram className="w-4 h-4" />
                    <span>Instagram</span>
                  </div>
                  <h2 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-balance">
                    Sokak stilini topluluğumuzla paylaş.
                  </h2>
                  <p className="text-sm sm:text-base text-[#52525B] leading-relaxed">
                    Yeni drop duyuruları, sınırlı üretim kapsüller ve günlük kombinler
                    için resmi Instagram hesabımızı takip edin.
                  </p>

                  {safeIgUrl ? (
                    <a
                      href={safeIgUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2.5 px-7 py-4 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-[0.18em] hover:bg-[#27272A] transition-colors"
                    >
                      <span>
                        {settings.instagramUsername
                          ? `@${settings.instagramUsername} Takip Et`
                          : 'Instagram Profilini Aç'}
                      </span>
                      <ArrowUpRight className="w-4 h-4" />
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleNavigate('admin')}
                      className="inline-flex items-center gap-2 px-6 py-3.5 border border-[#0A0A0A] text-xs font-bold uppercase tracking-wider hover:bg-[#0A0A0A] hover:text-white transition-colors cursor-pointer"
                    >
                      <span>Instagram Hesabını Yönetimden Ekle</span>
                    </button>
                  )}
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* PROFESSIONAL FOOTER */}
      <footer className="bg-[#0A0A0A] text-white border-t border-white/10 py-14 px-4 sm:px-8">
        <div className="max-w-[1440px] mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 pb-12 border-b border-white/10">
          <div className="md:col-span-5 space-y-3">
            <div className="font-display text-2xl font-bold tracking-[0.22em]">
              MODAPRADA
            </div>
            <p className="text-sm text-[#A1A1AA] max-w-sm leading-relaxed">
              Modern sokak modasının yeni adresi. Zamansız siyah, saf beyaz ve antrasit
              silüetlerle lüks streetwear deneyimi.
            </p>
          </div>

          <div className="md:col-span-3 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#71717A]">
              Mağaza
            </h3>
            <ul className="space-y-2.5 text-sm text-[#D4D4D8]">
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('store', 'yeni-gelenler')}
                  className="hover:text-white cursor-pointer"
                >
                  Yeni Gelenler
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('store', 'tum-urunler')}
                  className="hover:text-white cursor-pointer"
                >
                  Tüm Ürünler
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('store', 'koleksiyonlar')}
                  className="hover:text-white cursor-pointer"
                >
                  Koleksiyonlar
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => handleNavigate('contact')}
                  className="hover:text-white cursor-pointer"
                >
                  İletişim
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-[#71717A]">
              İletişim & Sosyal Medya
            </h3>
            <div className="space-y-2 text-sm text-[#D4D4D8]">
              {settings.phoneNumber && (
                <p>
                  Telefon:{' '}
                  <a
                    href={`tel:${settings.phoneNumber.replace(/\s+/g, '')}`}
                    className="hover:text-white font-mono"
                  >
                    {settings.phoneNumber}
                  </a>
                </p>
              )}
              {waFooterUrl && (
                <p>
                  <a
                    href={waFooterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white underline underline-offset-4"
                  >
                    WhatsApp Müşteri Hattı
                  </a>
                </p>
              )}
              {safeIgUrl && (
                <p>
                  <a
                    href={safeIgUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white underline underline-offset-4"
                  >
                    {settings.instagramUsername
                      ? `Instagram: @${settings.instagramUsername}`
                      : 'Instagram Profilimiz'}
                  </a>
                </p>
              )}
              {!settings.phoneNumber && !waFooterUrl && !safeIgUrl && (
                <p className="text-xs text-[#71717A]">
                  İletişim bilgileri Yönetim Panelinden düzenlenebilir.
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-[1440px] mx-auto pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#71717A]">
          <p>© {new Date().getFullYear()} MODAPRADA. Tüm hakları saklıdır.</p>
          <button
            type="button"
            onClick={() => handleNavigate('admin')}
            className="hover:text-white transition-colors cursor-pointer"
          >
            Mağaza Yönetim Paneli
          </button>
        </div>
      </footer>

      {/* Product Detail Modal with Dedicated Unlimited Swipe Gallery */}
      {selectedProduct && (
        <ProductDetailModal
          product={selectedProduct}
          settings={settings}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />
      )}

      {/* Shopping Cart & Checkout Drawer */}
      <CartDrawer
        open={cartOpen}
        items={cart}
        settings={settings}
        onClose={() => setCartOpen(false)}
        onUpdateQty={handleUpdateCartQty}
        onRemoveItem={handleRemoveCartItem}
        onOrderCompleted={() => {
          setCart([]);
          void loadStoreData();
        }}
      />

      {/* Floating WhatsApp Action Button */}
      <FloatingWhatsApp
        whatsappNumber={settings.whatsappNumber}
        onUnconfiguredClick={() =>
          showToast('WhatsApp numarası henüz Yönetim Panelinden tanımlanmamış.')
        }
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <StorefrontApp />
    </AuthProvider>
  );
}
