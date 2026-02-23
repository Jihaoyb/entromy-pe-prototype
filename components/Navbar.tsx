import Image from 'next/image';
import { navLinks } from '@/data/pageContent';

export function Navbar() {
  return (
    <header className="sticky top-0 z-30 border-b border-brand-line bg-white/95 backdrop-blur">
      <div className="section-shell flex h-[74px] items-center justify-between">
        <a href="#" className="inline-flex items-center">
          <Image src="/company-logo.png" alt="Entromy" width={124} height={31} className="h-7 w-auto object-contain" />
        </a>

        <div className="flex items-center gap-4 md:gap-8">
          <nav className="hidden items-center gap-8 text-[13px] font-medium text-brand-muted md:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="inline-flex items-center gap-1 transition-colors hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
              >
                <span>{link.label}</span>
                {link.hasCaret ? <span className="text-[10px] text-brand-muted">▾</span> : null}
              </a>
            ))}
          </nav>

          <a
            href="#cta"
            className="inline-flex h-10 items-center rounded-md bg-brand-green px-4 text-[13px] font-medium text-white transition-colors hover:bg-brand-greenHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green md:h-11 md:px-7"
          >
            <Image src="/mail.svg" alt="" width={14} height={14} className="mr-2 h-3.5 w-3.5 object-contain" />
            <span>Book Demo</span>
          </a>
          <a
            href="#"
            className="hidden text-[13px] text-brand-muted transition-colors hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green sm:inline"
          >
            Sign in
          </a>
        </div>
      </div>
    </header>
  );
}
