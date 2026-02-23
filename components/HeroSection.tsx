import Image from 'next/image';
import { heroContent } from '@/data/pageContent';

export function HeroSection() {
  return (
    <section className="section-shell py-12 lg:py-[68px]">
      <div className="grid items-center gap-7 md:gap-8 xl:grid-cols-[0.92fr_1.08fr] xl:gap-10">
        <div className="max-w-xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-green">{heroContent.eyebrow}</p>
          <h1 className="mt-4 text-[34px] font-medium leading-[1.18] text-brand-ink md:text-[40px] xl:text-[45px]">{heroContent.title}</h1>
          <p className="mt-6 max-w-xl text-[15px] leading-[1.62] text-brand-muted">{heroContent.subtitle}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href={heroContent.primaryCta.href}
              className="inline-flex h-12 items-center gap-2 rounded-md bg-brand-green px-8 text-[13px] font-medium text-white transition-colors hover:bg-brand-greenHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            >
              <Image src="/mail.svg" alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
              {heroContent.primaryCta.label}
            </a>
            <a
              href={heroContent.secondaryCta.href}
              className="inline-flex h-12 items-center justify-center rounded-md border border-brand-greenLine bg-white px-8 text-[13px] font-medium text-brand-ink transition-colors hover:bg-brand-greenTint focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
            >
              {heroContent.secondaryCta.label}
            </a>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl2 border border-brand-line/80 bg-white shadow-card xl:ml-auto xl:w-full xl:max-w-[640px]">
          <picture>
            <source srcSet="/meeting-placeholder.png?v=1" type="image/png" />
            <img
              src="/meeting-placeholder.svg?v=1"
              alt="Business meeting placeholder visual"
              className="h-auto w-full object-cover aspect-[16/10] md:aspect-[5/3] xl:aspect-[16/10] max-h-[360px] md:max-h-[330px] xl:max-h-[400px]"
            />
          </picture>
        </div>
      </div>
    </section>
  );
}
