import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  addProductImages,
  createCustomerOrder,
  createProduct,
  deleteProduct,
  deleteProductImage,
  getImageBinaryById,
  getProductById,
  getStoreSettings,
  listOrders,
  listProducts,
  patchProductFlags,
  reorderProductImages,
  replaceProductImage,
  setPrimaryProductImage,
  updateOrderStatus,
  updateProduct,
  updateStoreSettings,
  type ProductPayloadInput,
} from './src/db/repository.ts';
import type { ProductSizeKey } from './src/db/schema.ts';
import {
  requireAdmin,
  requireAuth,
  syncAndCheckAdmin,
  type AuthRequest,
} from './src/middleware/auth.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ALLOWED_IMAGE_MIME = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/avif',
  'image/gif',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB per image file; no limit on number of files
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_IMAGE_MIME.has(file.mimetype.toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Sadece JPEG, PNG, WEBP, AVIF veya GIF görseller yüklenebilir.'));
    }
  },
});

function sanitizeHttpUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return '';
  } catch {
    return '';
  }
}

function parseNonNegativeNumber(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num) || num < 0) return null;
  return num;
}

function parseProductInput(body: Record<string, unknown>): {
  error?: string;
  data?: ProductPayloadInput;
} {
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return { error: 'Ürün adı zorunludur.' };
  }

  const normalPrice = parseNonNegativeNumber(body.normalPrice);
  if (normalPrice === null) {
    return { error: 'Geçerli bir normal fiyat giriniz.' };
  }

  const originalPrice = parseNonNegativeNumber(body.originalPrice);
  const discountedPrice = parseNonNegativeNumber(body.discountedPrice);
  const discountPercentageRaw =
    body.discountPercentage === null ||
    body.discountPercentage === undefined ||
    body.discountPercentage === ''
      ? null
      : Number(body.discountPercentage);

  const discountPercentage =
    discountPercentageRaw !== null && Number.isFinite(discountPercentageRaw)
      ? Math.max(0, Math.min(100, Math.round(discountPercentageRaw)))
      : null;

  return {
    data: {
      name: name.slice(0, 180),
      description: typeof body.description === 'string' ? body.description.trim() : '',
      category:
        typeof body.category === 'string' && body.category.trim()
          ? body.category.trim().slice(0, 80)
          : 'Tişört',
      collectionName:
        typeof body.collectionName === 'string' ? body.collectionName.trim().slice(0, 100) : '',
      normalPrice,
      originalPrice,
      discountedPrice,
      discountPercentage,
      discountBadgeText:
        typeof body.discountBadgeText === 'string'
          ? body.discountBadgeText.trim().slice(0, 80)
          : '',
      discountEnabled: Boolean(body.discountEnabled),
      isPublished: body.isPublished !== undefined ? Boolean(body.isPublished) : true,
      isFeatured: Boolean(body.isFeatured),
      isNewArrival: body.isNewArrival !== undefined ? Boolean(body.isNewArrival) : true,
    },
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  // Health endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // Auth status endpoint
  app.get('/api/auth/me', requireAuth, async (req: AuthRequest, res: Response) => {
    try {
      const uid = req.user!.uid;
      const email = req.user!.email || '';
      const isAdmin = await syncAndCheckAdmin(uid, email);
      res.json({ uid, email, isAdmin });
    } catch {
      res.status(500).json({ error: 'Kullanıcı oturumu doğrulanamadı.' });
    }
  });

  // Public Storefront Routes
  app.get('/api/products', async (_req: Request, res: Response) => {
    try {
      const items = await listProducts(false);
      res.json(items);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ürünler yüklenemedi.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/products/:id', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Geçersiz ürün kimliği.' });
    }
    try {
      const product = await getProductById(id, false);
      if (!product) {
        return res.status(404).json({ error: 'Ürün bulunamadı.' });
      }
      res.json(product);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ürün yüklenemedi.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/images/:id', async (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Geçersiz görsel kimliği.' });
    }
    try {
      const image = await getImageBinaryById(id);
      if (!image) {
        return res.status(404).send('Görsel bulunamadı.');
      }
      const safeMime = ALLOWED_IMAGE_MIME.has(image.mimeType.toLowerCase())
        ? image.mimeType
        : 'image/jpeg';
      const buffer = Buffer.from(image.imageData, 'base64');
      res.setHeader('Content-Type', safeMime);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'public, max-age=300, must-revalidate');
      res.send(buffer);
    } catch {
      res.status(500).send('Görsel yüklenemedi.');
    }
  });

  app.get('/api/settings', async (_req: Request, res: Response) => {
    try {
      const settings = await getStoreSettings();
      res.json(settings);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ayarlar yüklenemedi.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/orders', async (req: Request, res: Response) => {
    try {
      const body = req.body as Record<string, unknown>;
      const customerName =
        typeof body.customerName === 'string' ? body.customerName.trim() : '';
      const customerPhone =
        typeof body.customerPhone === 'string' ? body.customerPhone.trim() : '';
      const customerAddress =
        typeof body.customerAddress === 'string' ? body.customerAddress.trim() : '';
      const customerCity =
        typeof body.customerCity === 'string' ? body.customerCity.trim() : '';
      const paymentMethod =
        typeof body.paymentMethod === 'string' && body.paymentMethod.trim()
          ? body.paymentMethod.trim()
          : 'Kapıda Ödeme';

      if (!customerName || !customerPhone || !customerAddress || !customerCity) {
        return res.status(400).json({ error: 'Lütfen tüm teslimat bilgilerini doldurun.' });
      }

      const rawItems = Array.isArray(body.items) ? body.items : [];
      if (rawItems.length === 0) {
        return res.status(400).json({ error: 'Sepetiniz boş.' });
      }

      const validSizes = new Set(['S', 'M', 'L', 'XL']);
      const requestedItems: Array<{
        productId: number;
        size: ProductSizeKey;
        quantity: number;
      }> = [];

      for (const entry of rawItems) {
        if (typeof entry !== 'object' || entry === null) continue;
        const item = entry as Record<string, unknown>;
        const productId = Number(item.productId);
        const size = typeof item.size === 'string' ? item.size.toUpperCase() : '';
        const quantity = Number(item.quantity);
        if (
          Number.isInteger(productId) &&
          productId > 0 &&
          validSizes.has(size) &&
          Number.isFinite(quantity) &&
          quantity > 0
        ) {
          requestedItems.push({
            productId,
            size: size as ProductSizeKey,
            quantity: Math.floor(quantity),
          });
        }
      }

      if (requestedItems.length === 0) {
        return res.status(400).json({ error: 'Geçerli sipariş kalemi bulunamadı.' });
      }

      const order = await createCustomerOrder({
        customerName: customerName.slice(0, 120),
        customerPhone: customerPhone.slice(0, 40),
        customerAddress: customerAddress.slice(0, 400),
        customerCity: customerCity.slice(0, 80),
        paymentMethod: paymentMethod.slice(0, 60),
        requestedItems,
      });

      res.status(201).json(order);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sipariş oluşturulamadı.';
      res.status(400).json({ error: msg });
    }
  });

  // Admin Protected Routes
  app.get('/api/admin/products', requireAdmin, async (_req: AuthRequest, res: Response) => {
    try {
      const items = await listProducts(true);
      res.json(items);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ürünler yüklenemedi.';
      res.status(500).json({ error: msg });
    }
  });

  app.post('/api/admin/products', requireAdmin, async (req: AuthRequest, res: Response) => {
    const parsed = parseProductInput((req.body || {}) as Record<string, unknown>);
    if (parsed.error || !parsed.data) {
      return res.status(400).json({ error: parsed.error || 'Geçersiz ürün verisi.' });
    }
    try {
      const created = await createProduct(parsed.data);
      res.status(201).json(created);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ürün oluşturulamadı.';
      res.status(500).json({ error: msg });
    }
  });

  app.put('/api/admin/products/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Geçersiz ürün kimliği.' });
    }
    const parsed = parseProductInput((req.body || {}) as Record<string, unknown>);
    if (parsed.error || !parsed.data) {
      return res.status(400).json({ error: parsed.error || 'Geçersiz ürün verisi.' });
    }
    try {
      const updated = await updateProduct(id, parsed.data);
      if (!updated) {
        return res.status(404).json({ error: 'Ürün bulunamadı.' });
      }
      res.json(updated);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ürün güncellenemedi.';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/admin/products/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Geçersiz ürün kimliği.' });
    }
    const body = (req.body || {}) as Record<string, unknown>;
    try {
      const updated = await patchProductFlags(id, {
        isPublished: typeof body.isPublished === 'boolean' ? body.isPublished : undefined,
        isFeatured: typeof body.isFeatured === 'boolean' ? body.isFeatured : undefined,
        isNewArrival: typeof body.isNewArrival === 'boolean' ? body.isNewArrival : undefined,
      });
      if (!updated) {
        return res.status(404).json({ error: 'Ürün bulunamadı.' });
      }
      res.json(updated);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ürün güncellenemedi.';
      res.status(500).json({ error: msg });
    }
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Geçersiz ürün kimliği.' });
    }
    try {
      const deleted = await deleteProduct(id);
      if (!deleted) {
        return res.status(404).json({ error: 'Ürün bulunamadı.' });
      }
      res.json({ deleted: true });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ürün silinemedi.';
      res.status(500).json({ error: msg });
    }
  });

  // Unlimited product photo upload (no max count limit!)
  app.post(
    '/api/admin/products/:id/images',
    requireAdmin,
    upload.array('files'),
    async (req: AuthRequest, res: Response) => {
      const productId = Number(req.params.id);
      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({ error: 'Geçersiz ürün kimliği.' });
      }
      const files = (req.files as Express.Multer.File[] | undefined) || [];
      if (files.length === 0) {
        return res.status(400).json({ error: 'Lütfen en az bir fotoğraf seçin.' });
      }
      try {
        const product = await getProductById(productId, true);
        if (!product) {
          return res.status(404).json({ error: 'Ürün bulunamadı.' });
        }
        const prepared = files.map((file) => ({
          fileName: (file.originalname || 'photo.jpg').slice(0, 180),
          mimeType: file.mimetype,
          base64Data: file.buffer.toString('base64'),
        }));
        const added = await addProductImages(productId, prepared);
        res.status(201).json(added);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Fotoğraflar yüklenemedi.';
        res.status(500).json({ error: msg });
      }
    },
  );

  app.put(
    '/api/admin/products/:id/images/reorder',
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
      const productId = Number(req.params.id);
      if (!Number.isInteger(productId) || productId <= 0) {
        return res.status(400).json({ error: 'Geçersiz ürün kimliği.' });
      }
      const body = (req.body || {}) as Record<string, unknown>;
      const rawIds = Array.isArray(body.imageIds) ? body.imageIds : [];
      const imageIds = rawIds
        .map((val) => Number(val))
        .filter((num) => Number.isInteger(num) && num > 0);
      try {
        const updated = await reorderProductImages(productId, imageIds);
        if (!updated) {
          return res.status(404).json({ error: 'Ürün bulunamadı.' });
        }
        res.json(updated);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Sıralama güncellenemedi.';
        res.status(500).json({ error: msg });
      }
    },
  );

  app.put(
    '/api/admin/products/:id/images/:imageId/replace',
    requireAdmin,
    upload.single('file'),
    async (req: AuthRequest, res: Response) => {
      const productId = Number(req.params.id);
      const imageId = Number(req.params.imageId);
      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(imageId) || imageId <= 0) {
        return res.status(400).json({ error: 'Geçersiz fotoğraf veya ürün kimliği.' });
      }
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Lütfen yeni bir fotoğraf dosyası seçin.' });
      }
      try {
        const replaced = await replaceProductImage(productId, imageId, {
          fileName: (file.originalname || 'photo.jpg').slice(0, 180),
          mimeType: file.mimetype,
          base64Data: file.buffer.toString('base64'),
        });
        if (!replaced) {
          return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });
        }
        res.json(replaced);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Fotoğraf değiştirilemedi.';
        res.status(500).json({ error: msg });
      }
    },
  );

  app.put(
    '/api/admin/products/:id/images/:imageId/primary',
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
      const productId = Number(req.params.id);
      const imageId = Number(req.params.imageId);
      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(imageId) || imageId <= 0) {
        return res.status(400).json({ error: 'Geçersiz kimlik.' });
      }
      try {
        const ok = await setPrimaryProductImage(productId, imageId);
        if (!ok) {
          return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });
        }
        res.json({ updated: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Ana fotoğraf güncellenemedi.';
        res.status(500).json({ error: msg });
      }
    },
  );

  app.delete(
    '/api/admin/products/:id/images/:imageId',
    requireAdmin,
    async (req: AuthRequest, res: Response) => {
      const productId = Number(req.params.id);
      const imageId = Number(req.params.imageId);
      if (!Number.isInteger(productId) || productId <= 0 || !Number.isInteger(imageId) || imageId <= 0) {
        return res.status(400).json({ error: 'Geçersiz kimlik.' });
      }
      try {
        const deleted = await deleteProductImage(productId, imageId);
        if (!deleted) {
          return res.status(404).json({ error: 'Fotoğraf bulunamadı.' });
        }
        res.json({ deleted: true });
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Fotoğraf silinemedi.';
        res.status(500).json({ error: msg });
      }
    },
  );

  app.put('/api/admin/settings', requireAdmin, async (req: AuthRequest, res: Response) => {
    const body = (req.body || {}) as Record<string, unknown>;
    try {
      const saved = await updateStoreSettings({
        phoneNumber: typeof body.phoneNumber === 'string' ? body.phoneNumber.trim().slice(0, 60) : '',
        whatsappNumber:
          typeof body.whatsappNumber === 'string' ? body.whatsappNumber.trim().slice(0, 60) : '',
        instagramUsername:
          typeof body.instagramUsername === 'string'
            ? body.instagramUsername.trim().replace(/^@+/, '').slice(0, 80)
            : '',
        instagramUrl: sanitizeHttpUrl(body.instagramUrl),
        email: typeof body.email === 'string' ? body.email.trim().slice(0, 120) : '',
        address: typeof body.address === 'string' ? body.address.trim().slice(0, 300) : '',
        workingHours:
          typeof body.workingHours === 'string' ? body.workingHours.trim().slice(0, 120) : '',
      });
      res.json(saved);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Ayarlar kaydedilemedi.';
      res.status(500).json({ error: msg });
    }
  });

  app.get('/api/admin/orders', requireAdmin, async (_req: AuthRequest, res: Response) => {
    try {
      const allOrders = await listOrders();
      res.json(allOrders);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Siparişler yüklenemedi.';
      res.status(500).json({ error: msg });
    }
  });

  app.patch('/api/admin/orders/:id', requireAdmin, async (req: AuthRequest, res: Response) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Geçersiz sipariş kimliği.' });
    }
    const status =
      typeof (req.body as Record<string, unknown>)?.status === 'string'
        ? ((req.body as Record<string, unknown>).status as string).trim()
        : '';
    if (!status) {
      return res.status(400).json({ error: 'Geçersiz durum.' });
    }
    try {
      const updated = await updateOrderStatus(id, status.slice(0, 60));
      if (!updated) {
        return res.status(404).json({ error: 'Sipariş bulunamadı.' });
      }
      res.json(updated);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Sipariş güncellenemedi.';
      res.status(500).json({ error: msg });
    }
  });

  // Multer & Express error middleware
  app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'Bir görsel dosyası en fazla 15 MB olabilir.' });
      }
      return res.status(400).json({ error: `Dosya yükleme hatası: ${err.message}` });
    }
    if (err instanceof Error) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Beklenmeyen sunucu hatası.' });
  });

  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`MODAPRADA server listening on port ${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MODAPRADA server:', err);
  process.exit(1);
});
