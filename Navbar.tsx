import { useState } from 'react';
import { Menu, ShoppingBag, ShieldCheck, X } from 'lucide-react';

export type ActivePage = 'store' | 'contact' | 'admin';

interface NavbarProps {
  activePage: ActivePage;
  cartCount: number;
  onNavigate: (page: ActivePage, sectionId?: string) => void;
  onOpenCart: () => void;
}

export function Navbar({ activePage, cartCount, onNavigate, onOpenCart }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: Array<{ label: string; page: ActivePage; sectionId?: string }> = [
    { label: 'Yeni Gelenler', page: 'store', sectionId: 'yeni-gelenler' },
    { label: 'Tüm Ürünler', page: 'store', sectionId: 'tum-urunler' },
    { label: 'Koleksiyonlar', page: 'store', sectionId: 'koleksiyonlar' },
    { label: 'İletişim', page: 'contact' },
  ];

  const handleLinkClick = (page: ActivePage, sectionId?: string) => {
    setMobileMenuOpen(false);
    onNavigate(page, sectionId);
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-md border-b border-white/10 text-white">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
        {/* Zone 1: Brand Wordmark */}
        <button
          type="button"
          onClick={() => handleLinkClick('store', 'hero')}
          className="font-display text-xl sm:text-2xl font-bold tracking-[0.22em] text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-white"
        >
          MODAPRADA
        </button>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-[#B8B8BE]">
          {navItems.map((item) => {
            const isCurrent =
              (item.page === 'contact' && activePage === 'contact') ||
              (item.page === 'store' && activePage === 'store' && !item.sectionId);
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleLinkClick(item.page, item.sectionId)}
                className={`whitespace-nowrap shrink-0 py-1 border-b transition-colors cursor-pointer ${
                  isCurrent
                    ? 'text-white border-white'
                    : 'border-transparent hover:text-white hover:border-white/50'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Zone 3: Primary Action Cluster */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => handleLinkClick('admin')}
            className={`hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              activePage === 'admin'
                ? 'bg-white text-[#0A0A0A] border-white'
                : 'border-white/20 text-white/90 hover:border-white hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Yönetim</span>
          </button>

          <button
            type="button"
            onClick={onOpenCart}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold bg-white text-[#0A0A0A] hover:bg-[#E5E5E5] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Sepet</span>
            <span className="font-mono tabular-nums">({cartCount})</span>
          </button>

          <button
            type="button"
            aria-label="Menüyü aç"
            onClick={() => setMobileMenuOpen((prev) => !prev)}
            className="lg:hidden p-2 text-white hover:bg-white/10 transition-colors cursor-pointer"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Navigation Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden bg-[#0A0A0A] border-t border-white/10 px-4 py-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => handleLinkClick(item.page, item.sectionId)}
              className="w-full text-left px-3 py-3 text-sm font-medium text-[#D4D4D8] hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => handleLinkClick('admin')}
            className="w-full text-left px-3 py-3 text-sm font-medium text-white border-t border-white/10 mt-2 pt-3 flex items-center gap-2 cursor-pointer"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Yönetim Paneli</span>
          </button>
        </div>
      )}
    </header>
  );
}
