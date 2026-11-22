import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Edit3,
  Eye,
  EyeOff,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Settings,
  ShieldAlert,
  ShoppingBag,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import {
  PRODUCT_SIZES,
  type OrderRecord,
  type ProductImageItem,
  type ProductItem,
  type StoreSettingsData,
} from '../types/store';
import { formatTL } from '../utils/format';

interface AdminDashboardProps {
  settings: StoreSettingsData;
  onSettingsUpdated: (next: StoreSettingsData) => void;
  onProductsChanged: () => void;
  onExitAdmin: () => void;
}

interface PendingPhotoItem {
  localId: string;
  file: File;
  previewUrl: string;
  isPrimary: boolean;
}

interface ProductFormState {
  name: string;
  description: string;
  category: string;
  collectionName: string;
  normalPrice: string;
  discountEnabled: boolean;
  originalPrice: string;
  discountedPrice: string;
  discountPercentage: string;
  discountBadgeText: string;
  isPublished: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
}

const emptyForm = (): ProductFormState => ({
  name: '',
  description: '',
  category: 'Tişört',
  collectionName: '',
  normalPrice: '',
  discountEnabled: false,
  originalPrice: '',
  discountedPrice: '',
  discountPercentage: '',
  discountBadgeText: '',
  isPublished: true,
  isFeatured: false,
  isNewArrival: true,
});

export function AdminDashboard({
  settings,
  onSettingsUpdated,
  onProductsChanged,
  onExitAdmin,
}: AdminDashboardProps) {
  const { user, isAdmin, loading: authLoading, authError, signInWithGoogle, logout, getFreshToken } =
    useAuth();

  const [activeTab, setActiveTab] = useState<'products' | 'settings' | 'orders'>('products');
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null,
  );

  // Product Editor state
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<ProductItem | null>(null);
  const [form, setForm] = useState<ProductFormState>(emptyForm);
  const [existingImages, setExistingImages] = useState<ProductImageItem[]>([]);
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhotoItem[]>([]);
  const [savingProduct, setSavingProduct] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  // Replace single image input ref
  const replaceInputRef = useRef<HTMLInputElement | null>(null);
  const replaceTargetImageId = useRef<number | null>(null);

  // Contact settings form
  const [contactForm, setContactForm] = useState<StoreSettingsData>(settings);
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    setContactForm(settings);
  }, [settings]);

  const showNotice = useCallback((type: 'ok' | 'err', text: string) => {
    setStatusMessage({ type, text });
    window.setTimeout(() => {
      setStatusMessage((curr) => (curr?.text === text ? null : curr));
    }, 4000);
  }, []);

  const authFetch = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = await getFreshToken();
      if (!token) {
        throw new Error('Oturum belirteci alınamadı. Lütfen yeniden giriş yapın.');
      }
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${token}`);
      return fetch(url, { ...options, headers });
    },
    [getFreshToken],
  );

  const loadAdminData = useCallback(async () => {
    if (!isAdmin) return;
    setLoadingData(true);
    try {
      const [prodRes, ordRes] = await Promise.all([
        authFetch('/api/admin/products'),
        authFetch('/api/admin/orders'),
      ]);
      if (prodRes.ok) {
        const prodData = (await prodRes.json()) as ProductItem[];
        setProducts(prodData);
      }
      if (ordRes.ok) {
        const ordData = (await ordRes.json()) as OrderRecord[];
        setOrders(ordData);
      }
    } catch (err) {
      showNotice(
        'err',
        err instanceof Error ? err.message : 'Yönetim verileri yüklenemedi.',
      );
    } finally {
      setLoadingData(false);
    }
  }, [authFetch, isAdmin, showNotice]);

  useEffect(() => {
    if (isAdmin) {
      void loadAdminData();
    }
  }, [isAdmin, loadAdminData]);

  // Cleanup object URLs when pendingPhotos change or editor closes
  const clearPendingPhotos = useCallback(() => {
    setPendingPhotos((prev) => {
      prev.forEach((p) => URL.revokeObjectURL(p.previewUrl));
      return [];
    });
  }, []);

  const openCreateEditor = () => {
    clearPendingPhotos();
    setEditingProduct(null);
    setExistingImages([]);
    setForm(emptyForm());
    setEditorOpen(true);
  };

  const openEditEditor = (product: ProductItem) => {
    clearPendingPhotos();
    setEditingProduct(product);
    setExistingImages(
      [...product.images].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    );
    setForm({
      name: product.name,
      description: product.description,
      category: product.category,
      collectionName: product.collectionName,
      normalPrice: String(product.normalPrice),
      discountEnabled: product.discountEnabled,
      originalPrice: product.originalPrice !== null ? String(product.originalPrice) : '',
      discountedPrice:
        product.discountedPrice !== null ? String(product.discountedPrice) : '',
      discountPercentage:
        product.discountPercentage !== null ? String(product.discountPercentage) : '',
      discountBadgeText: product.discountBadgeText,
      isPublished: product.isPublished,
      isFeatured: product.isFeatured,
      isNewArrival: product.isNewArrival,
    });
    setEditorOpen(true);
  };

  const closeEditor = () => {
    clearPendingPhotos();
    setEditorOpen(false);
    setEditingProduct(null);
  };

  // Upload unlimited photos immediately when editing an existing product,
  // or queue them when creating a new product.
  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    if (editingProduct) {
      setUploadingImages(true);
      try {
        const fd = new FormData();
        files.forEach((f) => fd.append('files', f));
        const res = await authFetch(`/api/admin/products/${editingProduct.id}/images`, {
          method: 'POST',
          body: fd,
        });
        const data = (await res.json()) as ProductImageItem[] & { error?: string };
        if (!res.ok) {
          throw new Error((data as unknown as { error?: string }).error || 'Fotoğraf yüklenemedi.');
        }
        setExistingImages((prev) => [...prev, ...data]);
        await loadAdminData();
        onProductsChanged();
        showNotice('ok', `${files.length} fotoğraf başarıyla yüklendi.`);
      } catch (err) {
        showNotice('err', err instanceof Error ? err.message : 'Fotoğraf yükleme hatası.');
      } finally {
        setUploadingImages(false);
      }
    } else {
      setPendingPhotos((prev) => {
        const hasPrimaryAlready = prev.some((p) => p.isPrimary);
        const added: PendingPhotoItem[] = files.map((file, idx) => ({
          localId: `${Date.now()}-${Math.random().toString(36).slice(2)}-${idx}`,
          file,
          previewUrl: URL.createObjectURL(file),
          isPrimary: !hasPrimaryAlready && idx === 0,
        }));
        return [...prev, ...added];
      });
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      showNotice('err', 'Lütfen ürün adını girin.');
      return;
    }
    if (!form.normalPrice || Number.isNaN(Number(form.normalPrice))) {
      showNotice('err', 'Lütfen geçerli bir normal fiyat girin.');
      return;
    }

    setSavingProduct(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description,
        category: form.category.trim() || 'Tişört',
        collectionName: form.collectionName.trim(),
        normalPrice: Number(form.normalPrice),
        discountEnabled: form.discountEnabled,
        originalPrice: form.originalPrice !== '' ? Number(form.originalPrice) : null,
        discountedPrice: form.discountedPrice !== '' ? Number(form.discountedPrice) : null,
        discountPercentage:
          form.discountPercentage !== '' ? Number(form.discountPercentage) : null,
        discountBadgeText: form.discountBadgeText.trim(),
        isPublished: form.isPublished,
        isFeatured: form.isFeatured,
        isNewArrival: form.isNewArrival,
      };

      let savedId: number;
      if (editingProduct) {
        const res = await authFetch(`/api/admin/products/${editingProduct.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as ProductItem & { error?: string };
        if (!res.ok) throw new Error(data.error || 'Ürün güncellenemedi.');
        savedId = data.id;
      } else {
        const res = await authFetch('/api/admin/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = (await res.json()) as ProductItem & { error?: string };
        if (!res.ok) throw new Error(data.error || 'Ürün oluşturulamadı.');
        savedId = data.id;

        // Upload ALL queued photos in order without any limit
        if (pendingPhotos.length > 0) {
          const orderedPending = [...pendingPhotos];
          const primaryIdx = orderedPending.findIndex((p) => p.isPrimary);
          const fd = new FormData();
          orderedPending.forEach((item) => fd.append('files', item.file));
          const uploadRes = await authFetch(`/api/admin/products/${savedId}/images`, {
            method: 'POST',
            body: fd,
          });
          if (uploadRes.ok) {
            const uploaded = (await uploadRes.json()) as ProductImageItem[];
            if (primaryIdx > 0 && uploaded[primaryIdx]) {
              await authFetch(
                `/api/admin/products/${savedId}/images/${uploaded[primaryIdx].id}/primary`,
                { method: 'PUT' },
              );
            }
          }
        }
      }

      await loadAdminData();
      onProductsChanged();
      closeEditor();
      showNotice(
        'ok',
        editingProduct ? 'Ürün başarıyla güncellendi.' : 'Yeni ürün başarıyla eklendi.',
      );
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Ürün kaydedilemedi.');
    } finally {
      setSavingProduct(false);
    }
  };

  // Existing image actions
  const handleSetPrimaryExisting = async (imageId: number) => {
    if (!editingProduct) return;
    try {
      const res = await authFetch(
        `/api/admin/products/${editingProduct.id}/images/${imageId}/primary`,
        { method: 'PUT' },
      );
      if (!res.ok) throw new Error('Ana fotoğraf seçilemedi.');
      setExistingImages((prev) =>
        prev.map((img) => ({ ...img, isPrimary: img.id === imageId })),
      );
      await loadAdminData();
      onProductsChanged();
      showNotice('ok', 'Ana ürün fotoğrafı güncellendi.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Hata oluştu.');
    }
  };

  const handleDeleteExistingImage = async (imageId: number) => {
    if (!editingProduct) return;
    try {
      const res = await authFetch(
        `/api/admin/products/${editingProduct.id}/images/${imageId}`,
        { method: 'DELETE' },
      );
      if (!res.ok) throw new Error('Fotoğraf silinemedi.');
      const refreshedRes = await authFetch('/api/admin/products');
      if (refreshedRes.ok) {
        const all = (await refreshedRes.json()) as ProductItem[];
        setProducts(all);
        const current = all.find((p) => p.id === editingProduct.id);
        if (current) {
          setExistingImages(
            [...current.images].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
          );
        }
      }
      onProductsChanged();
      showNotice('ok', 'Fotoğraf kaldırıldı.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Silme hatası.');
    }
  };

  const handleMoveExistingImage = async (index: number, direction: -1 | 1) => {
    if (!editingProduct) return;
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= existingImages.length) return;
    const reordered = [...existingImages];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIdx, 0, moved);
    const updatedList = reordered.map((img, i) => ({ ...img, sortOrder: i }));
    setExistingImages(updatedList);

    try {
      const res = await authFetch(
        `/api/admin/products/${editingProduct.id}/images/reorder`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageIds: updatedList.map((i) => i.id) }),
        },
      );
      if (!res.ok) throw new Error('Sıralama kaydedilemedi.');
      await loadAdminData();
      onProductsChanged();
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Sıralama hatası.');
    }
  };

  const triggerReplaceImage = (imageId: number) => {
    replaceTargetImageId.current = imageId;
    replaceInputRef.current?.click();
  };

  const handleReplaceFileChosen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const imageId = replaceTargetImageId.current;
    e.target.value = '';
    if (!file || !imageId || !editingProduct) return;

    setUploadingImages(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await authFetch(
        `/api/admin/products/${editingProduct.id}/images/${imageId}/replace`,
        {
          method: 'PUT',
          body: fd,
        },
      );
      if (!res.ok) throw new Error('Fotoğraf değiştirilemedi.');
      const updatedImg = (await res.json()) as ProductImageItem;
      // Append cache-buster for immediate visual refresh in admin preview
      const bustedUrl = `${updatedImg.url}?v=${Date.now()}`;
      setExistingImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...updatedImg, url: bustedUrl } : img,
        ),
      );
      await loadAdminData();
      onProductsChanged();
      showNotice('ok', 'Fotoğraf başarıyla değiştirildi.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Değiştirme hatası.');
    } finally {
      setUploadingImages(false);
    }
  };

  // Pending image actions (for brand new product)
  const handleMovePending = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= pendingPhotos.length) return;
    setPendingPhotos((prev) => {
      const copy = [...prev];
      const [moved] = copy.splice(index, 1);
      copy.splice(target, 0, moved);
      return copy;
    });
  };

  const handleToggleProductFlag = async (
    product: ProductItem,
    field: 'isPublished' | 'isFeatured',
  ) => {
    try {
      const res = await authFetch(`/api/admin/products/${product.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: !product[field] }),
      });
      if (!res.ok) throw new Error('Durum güncellenemedi.');
      await loadAdminData();
      onProductsChanged();
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Güncelleme hatası.');
    }
  };

  const handleDeleteProduct = async (product: ProductItem) => {
    try {
      const res = await authFetch(`/api/admin/products/${product.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error('Ürün silinemedi.');
      await loadAdminData();
      onProductsChanged();
      showNotice('ok', `"${product.name}" silindi.`);
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Silme hatası.');
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      const res = await authFetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm),
      });
      const data = (await res.json()) as StoreSettingsData & { error?: string };
      if (!res.ok) throw new Error(data.error || 'Ayarlar kaydedilemedi.');
      onSettingsUpdated(data);
      showNotice('ok', 'İletişim ve sosyal medya ayarları güncellendi.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Ayar hatası.');
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId: number, status: string) => {
    try {
      const res = await authFetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Sipariş durumu güncellenemedi.');
      await loadAdminData();
      showNotice('ok', 'Sipariş durumu güncellendi.');
    } catch (err) {
      showNotice('err', err instanceof Error ? err.message : 'Hata oluştu.');
    }
  };

  // Unauthenticated / Non-Admin Gate
  if (authLoading) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-[#FAFAFA] text-[#0A0A0A]">
        <div className="text-sm font-medium text-[#52525B]">Oturum kontrol ediliyor...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-[#FAFAFA] px-4 py-16">
        <div className="w-full max-w-md bg-white border border-black/10 p-8 sm:p-10 text-center space-y-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#71717A]">
              MODAPRADA
            </p>
            <h1 className="font-display text-2xl font-bold text-[#0A0A0A] mt-2">
              Yönetici Girişi
            </h1>
            <p className="text-sm text-[#52525B] mt-2">
              Ürün eklemek, sınırsız ürün fotoğrafı yüklemek ve mağaza ayarlarını yönetmek
              için yetkili Google hesabınızla giriş yapın.
            </p>
          </div>

          {authError && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-800 text-xs text-left">
              {authError}
            </div>
          )}

          <button
            type="button"
            onClick={() => void signInWithGoogle()}
            className="w-full py-4 px-6 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-[0.16em] hover:bg-[#27272A] transition-colors cursor-pointer"
          >
            Google ile Giriş Yap
          </button>

          <button
            type="button"
            onClick={onExitAdmin}
            className="text-xs text-[#71717A] hover:text-[#0A0A0A] underline underline-offset-4 cursor-pointer"
          >
            Mağazaya Geri Dön
          </button>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-[75vh] flex items-center justify-center bg-[#FAFAFA] px-4 py-16">
        <div className="w-full max-w-md bg-white border border-black/10 p-8 sm:p-10 text-center space-y-5">
          <ShieldAlert className="w-10 h-10 text-[#0A0A0A] mx-auto" />
          <h1 className="font-display text-2xl font-bold text-[#0A0A0A]">
            Yetkisiz Hesap
          </h1>
          <p className="text-sm text-[#52525B]">
            <span className="font-semibold text-[#0A0A0A]">{user.email}</span> hesabı
            mağaza yöneticisi olarak tanımlı değil.
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => void logout()}
              className="w-full py-3 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Farklı Hesapla Giriş Yap
            </button>
            <button
              type="button"
              onClick={onExitAdmin}
              className="w-full py-3 border border-black/15 text-xs font-semibold uppercase tracking-wider cursor-pointer"
            >
              Mağazaya Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  const totalPhotosCount = products.reduce((sum, p) => sum + p.images.length, 0);
  const publishedCount = products.filter((p) => p.isPublished).length;
  const discountedCount = products.filter((p) => p.discountEnabled).length;

  return (
    <section className="min-h-[82vh] bg-[#FAFAFA] text-[#0A0A0A] pb-20">
      {/* Hidden input for single image replacement */}
      <input
        ref={replaceInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
        className="hidden"
        onChange={handleReplaceFileChosen}
      />

      {/* Admin Header Strip */}
      <div className="bg-[#141416] text-white border-b border-white/10">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-[#9A9AA0]">
              MODAPRADA Yönetim Merkezi
            </p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold mt-1">
              Mağaza Yönetimi
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs text-[#A1A1AA]">{user.email}</span>
            <button
              type="button"
              onClick={onExitAdmin}
              className="px-4 py-2 text-xs font-semibold border border-white/20 hover:border-white transition-colors cursor-pointer whitespace-nowrap"
            >
              Mağazayı Gör
            </button>
            <button
              type="button"
              onClick={() => void logout()}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold bg-white/10 hover:bg-white/20 transition-colors cursor-pointer whitespace-nowrap"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Çıkış</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 flex items-center gap-6 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('products')}
            className={`py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
              activeTab === 'products'
                ? 'border-white text-white'
                : 'border-transparent text-[#9A9AA0] hover:text-white'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Ürün Yönetimi ({products.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
              activeTab === 'settings'
                ? 'border-white text-white'
                : 'border-transparent text-[#9A9AA0] hover:text-white'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>İletişim & Sosyal Medya</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`py-3.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer flex items-center gap-2 ${
              activeTab === 'orders'
                ? 'border-white text-white'
                : 'border-transparent text-[#9A9AA0] hover:text-white'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Siparişler ({orders.length})</span>
          </button>
        </div>
      </div>

      {/* Status Notice */}
      {statusMessage && (
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-5">
          <div
            className={`px-4 py-3 text-sm font-medium border flex items-center justify-between ${
              statusMessage.type === 'ok'
                ? 'bg-white border-[#0A0A0A] text-[#0A0A0A]'
                : 'bg-red-50 border-red-300 text-red-900'
            }`}
          >
            <span>{statusMessage.text}</span>
            <button
              type="button"
              onClick={() => setStatusMessage(null)}
              className="p-1 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 pt-8">
        {/* TAB 1: PRODUCTS */}
        {activeTab === 'products' && (
          <div className="space-y-8">
            {/* Summary Row */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white border border-black/10 p-5">
                <p className="text-xs text-[#71717A] uppercase tracking-wider">Toplam Ürün</p>
                <p className="font-display text-2xl font-bold mt-1 tabular-nums">
                  {products.length}
                </p>
              </div>
              <div className="bg-white border border-black/10 p-5">
                <p className="text-xs text-[#71717A] uppercase tracking-wider">Yayında</p>
                <p className="font-display text-2xl font-bold mt-1 tabular-nums">
                  {publishedCount}
                </p>
              </div>
              <div className="bg-white border border-black/10 p-5">
                <p className="text-xs text-[#71717A] uppercase tracking-wider">İndirimli</p>
                <p className="font-display text-2xl font-bold mt-1 tabular-nums">
                  {discountedCount}
                </p>
              </div>
              <div className="bg-white border border-black/10 p-5">
                <p className="text-xs text-[#71717A] uppercase tracking-wider">
                  Yüklenen Fotoğraf
                </p>
                <p className="font-display text-2xl font-bold mt-1 tabular-nums">
                  {totalPhotosCount}
                </p>
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-xl font-bold">Ürün Kataloğu</h2>
                <p className="text-xs text-[#52525B] mt-0.5">
                  Her ürün için sınırsız fotoğraf yükleyebilir, fiyatları ve indirimleri
                  manuel belirleyebilirsiniz.
                </p>
              </div>
              <button
                type="button"
                onClick={openCreateEditor}
                className="inline-flex items-center justify-center gap-2 px-6 py-3.5 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-[0.15em] hover:bg-[#27272A] transition-colors cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>Yeni Ürün Ekle</span>
              </button>
            </div>

            {/* Product List */}
            {loadingData && products.length === 0 ? (
              <div className="bg-white border border-black/10 p-12 text-center text-sm text-[#71717A]">
                Ürünler yükleniyor...
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white border border-black/10 p-12 text-center space-y-4">
                <Package className="w-10 h-10 text-[#A1A1AA] mx-auto" />
                <h3 className="font-display text-lg font-bold">Henüz ürün eklenmedi</h3>
                <p className="text-sm text-[#52525B] max-w-md mx-auto">
                  İlk ürününüzü oluşturup telefonunuzdan veya bilgisayarınızdan istediğiniz
                  kadar fotoğraf yükleyin.
                </p>
                <button
                  type="button"
                  onClick={openCreateEditor}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>İlk Ürünü Ekle</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {products.map((product) => {
                  const thumb =
                    product.images.find((i) => i.isPrimary) || product.images[0] || null;
                  return (
                    <div
                      key={product.id}
                      className="bg-white border border-black/10 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start sm:items-center gap-4">
                        <div className="w-20 h-24 bg-[#F4F4F5] shrink-0 overflow-hidden border border-black/5">
                          {thumb ? (
                            <img
                              src={thumb.url}
                              alt={product.name}
                              referrerPolicy="no-referrer"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-[10px] text-[#71717A] p-1 text-center">
                              Fotoğraf Yok
                            </div>
                          )}
                        </div>

                        <div className="space-y-1">
                          <div className="flex flex-wrap items-center gap-2 text-xs text-[#71717A]">
                            <span>{product.category}</span>
                            {product.collectionName && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{product.collectionName}</span>
                              </>
                            )}
                            <span aria-hidden="true">·</span>
                            <span className="tabular-nums">{product.images.length} Fotoğraf</span>
                          </div>

                          <h3 className="font-display text-base sm:text-lg font-bold text-[#0A0A0A]">
                            {product.name}
                          </h3>

                          <div className="flex flex-wrap items-center gap-3 text-sm tabular-nums">
                            {product.discountEnabled && product.discountedPrice !== null ? (
                              <>
                                <span className="font-bold text-[#0A0A0A]">
                                  {formatTL(product.discountedPrice)}
                                </span>
                                {product.originalPrice !== null && (
                                  <span className="text-xs text-[#71717A] line-through">
                                    {formatTL(product.originalPrice)}
                                  </span>
                                )}
                                {product.discountBadgeText && (
                                  <span className="text-xs font-semibold bg-[#0A0A0A] text-white px-2 py-0.5">
                                    {product.discountBadgeText}
                                  </span>
                                )}
                              </>
                            ) : (
                              <span className="font-semibold text-[#0A0A0A]">
                                {formatTL(product.normalPrice)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Controls */}
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleProductFlag(product, 'isPublished')}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                            product.isPublished
                              ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                              : 'bg-white text-[#52525B] border-black/15'
                          }`}
                        >
                          {product.isPublished ? (
                            <Eye className="w-3.5 h-3.5" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5" />
                          )}
                          <span>{product.isPublished ? 'Yayında' : 'Taslak'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleToggleProductFlag(product, 'isFeatured')}
                          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold border transition-colors cursor-pointer ${
                            product.isFeatured
                              ? 'bg-[#27272A] text-white border-[#27272A]'
                              : 'bg-white text-[#52525B] border-black/15'
                          }`}
                        >
                          <Star className="w-3.5 h-3.5" />
                          <span>{product.isFeatured ? 'Öne Çıkan' : 'Öne Çıkar'}</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => openEditEditor(product)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold border border-black/20 hover:border-[#0A0A0A] transition-colors cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Düzenle & Fotoğraflar</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => void handleDeleteProduct(product)}
                          aria-label="Ürünü sil"
                          className="p-2 text-[#71717A] hover:text-red-700 border border-black/15 hover:border-red-300 transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: CONTACT & SOCIAL MEDIA */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl bg-white border border-black/10 p-6 sm:p-8">
            <h2 className="font-display text-xl font-bold">
              İletişim & Sosyal Medya Ayarları
            </h2>
            <p className="text-sm text-[#52525B] mt-1 mb-6">
              Burada girdiğiniz bilgiler mağaza genelinde, İletişim sayfasında, Instagram
              bölümünde ve yüzen WhatsApp butonunda anında güncellenir.
            </p>

            <form onSubmit={handleSaveSettings} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Telefon Numarası
                  </label>
                  <input
                    type="text"
                    value={contactForm.phoneNumber}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, phoneNumber: e.target.value }))
                    }
                    placeholder="+90 5XX XXX XX XX"
                    className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    WhatsApp Numarası
                  </label>
                  <input
                    type="text"
                    value={contactForm.whatsappNumber}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, whatsappNumber: e.target.value }))
                    }
                    placeholder="905XXXXXXXXX"
                    className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Instagram Kullanıcı Adı
                  </label>
                  <input
                    type="text"
                    value={contactForm.instagramUsername}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, instagramUsername: e.target.value }))
                    }
                    placeholder="modaprada"
                    className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Instagram Profil URL
                  </label>
                  <input
                    type="url"
                    value={contactForm.instagramUrl}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, instagramUrl: e.target.value }))
                    }
                    placeholder="https://instagram.com/..."
                    className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    E-posta Adresi
                  </label>
                  <input
                    type="email"
                    value={contactForm.email}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, email: e.target.value }))
                    }
                    placeholder="destek@modaprada.com"
                    className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Çalışma Saatleri
                  </label>
                  <input
                    type="text"
                    value={contactForm.workingHours}
                    onChange={(e) =>
                      setContactForm((p) => ({ ...p, workingHours: e.target.value }))
                    }
                    placeholder="Hafta içi 09:00 - 19:00"
                    className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                  Showroom / Adres
                </label>
                <textarea
                  rows={2}
                  value={contactForm.address}
                  onChange={(e) =>
                    setContactForm((p) => ({ ...p, address: e.target.value }))
                  }
                  placeholder="İstanbul mağaza / showroom adresiniz"
                  className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                />
              </div>

              <button
                type="submit"
                disabled={savingSettings}
                className="px-7 py-3.5 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-[0.16em] hover:bg-[#27272A] disabled:opacity-50 cursor-pointer"
              >
                {savingSettings ? 'KAYDEDİLİYOR...' : 'AYARLARI KAYDET'}
              </button>
            </form>
          </div>
        )}

        {/* TAB 3: ORDERS */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            <h2 className="font-display text-xl font-bold">Müşteri Siparişleri</h2>
            {orders.length === 0 ? (
              <div className="bg-white border border-black/10 p-12 text-center text-sm text-[#71717A]">
                Henüz müşteri siparişi bulunmuyor.
              </div>
            ) : (
              orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white border border-black/10 p-5 sm:p-6 space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-black/10">
                    <div>
                      <span className="font-mono text-sm font-bold">{order.orderCode}</span>
                      <span className="mx-2 text-[#A1A1AA]">·</span>
                      <span className="text-sm font-semibold">{order.customerName}</span>
                      <span className="mx-2 text-[#A1A1AA]">·</span>
                      <span className="text-xs text-[#52525B]">{order.customerPhone}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-display text-base font-bold tabular-nums">
                        {formatTL(order.totalAmount)}
                      </span>
                      <select
                        value={order.status}
                        onChange={(e) =>
                          void handleUpdateOrderStatus(order.id, e.target.value)
                        }
                        className="text-xs font-semibold border border-black/20 px-3 py-1.5 bg-white"
                      >
                        <option value="Yeni Sipariş">Yeni Sipariş</option>
                        <option value="Hazırlanıyor">Hazırlanıyor</option>
                        <option value="Kargoda">Kargoda</option>
                        <option value="Teslim Edildi">Teslim Edildi</option>
                        <option value="İptal Edildi">İptal Edildi</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-xs text-[#52525B] space-y-1">
                    <p>
                      <strong className="text-[#0A0A0A]">Adres:</strong> {order.customerAddress}{' '}
                      ({order.customerCity})
                    </p>
                    <p>
                      <strong className="text-[#0A0A0A]">Ödeme:</strong> {order.paymentMethod}
                    </p>
                  </div>

                  <div className="bg-[#FAFAFA] border border-black/5 p-3 space-y-1.5 text-xs">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between tabular-nums">
                        <span>
                          {item.name} — <strong>{item.size}</strong> × {item.quantity}
                        </span>
                        <span className="font-semibold">
                          {formatTL(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* PRODUCT CREATE / EDIT MODAL */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-0 sm:p-6 overflow-y-auto">
          <div className="bg-white text-[#0A0A0A] w-full max-w-5xl max-h-[100vh] sm:max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
            <div className="sticky top-0 z-20 bg-white border-b border-black/10 px-6 py-4 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold">
                {editingProduct ? `Ürünü Düzenle: ${editingProduct.name}` : 'Yeni Ürün Oluştur'}
              </h2>
              <button
                type="button"
                onClick={closeEditor}
                className="p-2 hover:bg-black/5 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 sm:p-8 space-y-8">
              {/* Section 1: Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Ürün Adı *
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Örn: Ağır Gramaj Boxy Tişört"
                    className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Kategori
                  </label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="Tişört, Oversize, Hoodie..."
                    className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Koleksiyon Adı (İsteğe Bağlı)
                  </label>
                  <input
                    type="text"
                    value={form.collectionName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, collectionName: e.target.value }))
                    }
                    placeholder="Örn: Noir Kapsül"
                    className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Ürün Açıklaması
                  </label>
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, description: e.target.value }))
                    }
                    placeholder="Kumaş gramajı, kalıp bilgisi, yıkama talimatları ve tasarım detayları..."
                    className="w-full px-3.5 py-2.5 text-sm border border-black/20 focus:outline-none focus:border-[#0A0A0A]"
                  />
                </div>
              </div>

              {/* Section 2: Manual Pricing & Manual Discounts */}
              <div className="border border-black/15 p-5 bg-[#FAFAFA] space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-display text-base font-bold">
                      Fiyatlandırma ve Manuel İndirim
                    </h3>
                    <p className="text-xs text-[#52525B]">
                      Fiyatlar ve indirim yüzdesi sistem tarafından otomatik değiştirilmez;
                      tamamen sizin girdiğiniz değerler kullanılır.
                    </p>
                  </div>

                  <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={form.discountEnabled}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, discountEnabled: e.target.checked }))
                      }
                      className="w-4 h-4 accent-[#0A0A0A]"
                    />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      İndirim Aktif
                    </span>
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                      Normal Fiyat (TL) *
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      value={form.normalPrice}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, normalPrice: e.target.value }))
                      }
                      placeholder="800"
                      className="w-full px-3.5 py-2.5 text-sm border border-black/20 bg-white tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                    />
                  </div>

                  {form.discountEnabled && (
                    <>
                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                          İndirim Öncesi Fiyat (Üstü Çizili)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.originalPrice}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, originalPrice: e.target.value }))
                          }
                          placeholder="800"
                          className="w-full px-3.5 py-2.5 text-sm border border-black/20 bg-white tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                          İndirimli Satış Fiyatı (TL)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.discountedPrice}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, discountedPrice: e.target.value }))
                          }
                          placeholder="500"
                          className="w-full px-3.5 py-2.5 text-sm border border-black/20 bg-white tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                          Manuel İndirim Yüzdesi (%)
                        </label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={form.discountPercentage}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, discountPercentage: e.target.value }))
                          }
                          placeholder="38"
                          className="w-full px-3.5 py-2.5 text-sm border border-black/20 bg-white tabular-nums focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5">
                          Manuel İndirim Etiketi Metni
                        </label>
                        <input
                          type="text"
                          value={form.discountBadgeText}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, discountBadgeText: e.target.value }))
                          }
                          placeholder="%38 İNDİRİM"
                          className="w-full px-3.5 py-2.5 text-sm border border-black/20 bg-white focus:outline-none focus:border-[#0A0A0A]"
                        />
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Fixed Sizes Info */}
              <div className="border border-black/10 bg-[#FAFAFA] px-4 py-3 text-xs text-[#52525B]">
                <span className="font-semibold text-[#0A0A0A] uppercase tracking-wider">
                  Sabit Bedenler:
                </span>{' '}
                <span>{PRODUCT_SIZES.join(' · ')}</span>
              </div>

              {/* Section 4: Visibility Switches */}
              <div className="flex flex-wrap gap-6 py-2 border-y border-black/10">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isPublished}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isPublished: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#0A0A0A]"
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Mağazada Yayınla
                  </span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isNewArrival}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isNewArrival: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#0A0A0A]"
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Yeni Gelenler
                  </span>
                </label>

                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.isFeatured}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, isFeatured: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[#0A0A0A]"
                  />
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    Öne Çıkan Ürün
                  </span>
                </label>
              </div>

              {/* Section 5: UNLIMITED PRODUCT PHOTO STUDIO */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold">
                      Ürün Fotoğrafları (Sınırsız)
                    </h3>
                    <p className="text-xs text-[#52525B]">
                      Telefon veya bilgisayardan dilediğiniz kadar fotoğraf yükleyin,
                      sıralayın, değiştirin veya ana fotoğrafı seçin.
                    </p>
                  </div>
                  <span className="text-xs font-mono tabular-nums text-[#52525B]">
                    {editingProduct ? existingImages.length : pendingPhotos.length} fotoğraf
                  </span>
                </div>

                {/* Upload Dropzone / Mobile Picker */}
                <label className="block border-2 border-dashed border-black/25 hover:border-[#0A0A0A] bg-[#FAFAFA] p-6 text-center cursor-pointer transition-colors">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
                    multiple
                    disabled={uploadingImages}
                    onChange={(e) => {
                      void handleFilesSelected(e.target.files);
                      e.target.value = '';
                    }}
                    className="hidden"
                  />
                  <Upload className="w-6 h-6 mx-auto mb-2 text-[#0A0A0A]" />
                  <p className="text-sm font-semibold text-[#0A0A0A]">
                    {uploadingImages
                      ? 'Fotoğraflar yükleniyor...'
                      : 'Fotoğraf Seçin veya Sürükleyip Bırakın'}
                  </p>
                  <p className="text-xs text-[#71717A] mt-1">
                    Çoklu seçim desteklenir · Sabit fotoğraf sayısı sınırı yoktur
                  </p>
                </label>

                {/* Existing Images Grid (when editing) */}
                {editingProduct && existingImages.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {existingImages.map((img, idx) => (
                      <div
                        key={img.id}
                        className={`border bg-white flex flex-col ${
                          img.isPrimary ? 'border-[#0A0A0A] ring-1 ring-[#0A0A0A]' : 'border-black/15'
                        }`}
                      >
                        <div className="relative aspect-[4/5] bg-[#F4F4F5] overflow-hidden">
                          <img
                            src={img.url}
                            alt={img.fileName}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2 left-2 bg-black/75 text-white text-[10px] font-mono px-2 py-0.5 tabular-nums">
                            #{idx + 1}
                          </span>
                          {img.isPrimary && (
                            <span className="absolute bottom-2 left-2 bg-[#0A0A0A] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                              Ana Fotoğraf
                            </span>
                          )}
                        </div>

                        <div className="p-2 space-y-1.5">
                          <div className="flex items-center justify-between gap-1">
                            <button
                              type="button"
                              disabled={idx === 0}
                              onClick={() => void handleMoveExistingImage(idx, -1)}
                              aria-label="Sola taşı"
                              className="p-1.5 border border-black/15 disabled:opacity-30 hover:bg-black/5 cursor-pointer"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSetPrimaryExisting(img.id)}
                              disabled={img.isPrimary}
                              className={`flex-1 py-1.5 text-[11px] font-semibold border transition-colors cursor-pointer ${
                                img.isPrimary
                                  ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                                  : 'border-black/15 hover:border-[#0A0A0A]'
                              }`}
                            >
                              {img.isPrimary ? 'Ana' : 'Ana Yap'}
                            </button>
                            <button
                              type="button"
                              disabled={idx === existingImages.length - 1}
                              onClick={() => void handleMoveExistingImage(idx, 1)}
                              aria-label="Sağa taşı"
                              className="p-1.5 border border-black/15 disabled:opacity-30 hover:bg-black/5 cursor-pointer"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => triggerReplaceImage(img.id)}
                              className="flex-1 py-1.5 text-[11px] font-medium border border-black/15 hover:bg-black/5 inline-flex items-center justify-center gap-1 cursor-pointer"
                            >
                              <RefreshCw className="w-3 h-3" />
                              <span>Değiştir</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDeleteExistingImage(img.id)}
                              aria-label="Fotoğrafı sil"
                              className="p-1.5 border border-black/15 text-[#71717A] hover:text-red-700 hover:border-red-300 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Pending Photos Queue (when creating a new product) */}
                {!editingProduct && pendingPhotos.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {pendingPhotos.map((item, idx) => (
                      <div
                        key={item.localId}
                        className={`border bg-white flex flex-col ${
                          item.isPrimary
                            ? 'border-[#0A0A0A] ring-1 ring-[#0A0A0A]'
                            : 'border-black/15'
                        }`}
                      >
                        <div className="relative aspect-[4/5] bg-[#F4F4F5] overflow-hidden">
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="w-full h-full object-cover"
                          />
                          <span className="absolute top-2 left-2 bg-black/75 text-white text-[10px] font-mono px-2 py-0.5 tabular-nums">
                            #{idx + 1}
                          </span>
                          {item.isPrimary && (
                            <span className="absolute bottom-2 left-2 bg-[#0A0A0A] text-white text-[10px] font-bold uppercase tracking-wider px-2 py-0.5">
                              Ana Fotoğraf
                            </span>
                          )}
                        </div>

                        <div className="p-2 flex items-center justify-between gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMovePending(idx, -1)}
                            className="p-1.5 border border-black/15 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setPendingPhotos((prev) =>
                                prev.map((p) => ({
                                  ...p,
                                  isPrimary: p.localId === item.localId,
                                })),
                              )
                            }
                            className={`flex-1 py-1.5 text-[11px] font-semibold border cursor-pointer ${
                              item.isPrimary
                                ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                                : 'border-black/15'
                            }`}
                          >
                            {item.isPrimary ? 'Ana' : 'Ana Yap'}
                          </button>
                          <button
                            type="button"
                            disabled={idx === pendingPhotos.length - 1}
                            onClick={() => handleMovePending(idx, 1)}
                            className="p-1.5 border border-black/15 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              URL.revokeObjectURL(item.previewUrl);
                              setPendingPhotos((prev) => {
                                const filtered = prev.filter(
                                  (p) => p.localId !== item.localId,
                                );
                                if (
                                  item.isPrimary &&
                                  filtered.length > 0 &&
                                  !filtered.some((p) => p.isPrimary)
                                ) {
                                  filtered[0].isPrimary = true;
                                }
                                return filtered;
                              });
                            }}
                            className="p-1.5 border border-black/15 text-[#71717A] hover:text-red-700 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Submit Footer */}
              <div className="pt-6 border-t border-black/10 flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={closeEditor}
                  className="px-6 py-3.5 border border-black/20 text-xs font-semibold uppercase tracking-wider hover:bg-black/5 cursor-pointer"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={savingProduct || uploadingImages}
                  className="px-8 py-3.5 bg-[#0A0A0A] text-white text-xs font-bold uppercase tracking-[0.16em] hover:bg-[#27272A] disabled:opacity-50 inline-flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>
                    {savingProduct
                      ? 'KAYDEDİLİYOR...'
                      : editingProduct
                        ? 'DEĞİŞİKLİKLERİ KAYDET'
                        : 'ÜRÜNÜ YAYINLA'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
