import Image from 'next/image';
import { AgentVideoModule } from '@/components/AgentVideoModule';
import { BenefitCard } from '@/components/BenefitCard';
import { Footer } from '@/components/Footer';
import { HeroSection } from '@/components/HeroSection';
import { Navbar } from '@/components/Navbar';
import { SectionBlock } from '@/components/SectionBlock';
import { ValueCreationWorkflow } from '@/components/ValueCreationWorkflow';
import { benefits, ctaContent, maximizeSection, whyChoose } from '@/data/pageContent';
import { CALENDLY_URL } from '@/data/siteConfig';

export default function Home() {
  return (
    <main className="bg-brand-bg text-brand-ink">
      <Navbar />
      <HeroSection />

      {/* Core PE narrative blocks: insight framing, outcomes, operating proof, and conversion touchpoints. */}
      <SectionBlock id={maximizeSection.id} title={maximizeSection.title} paragraphs={maximizeSection.paragraphs} />

      <section id="outcomes" className="section-shell scroll-mt-28 py-10 lg:py-12">
        <div className="grid gap-6 md:grid-cols-3">
          {benefits.map((benefit) => (
            <BenefitCard key={benefit.title} iconSrc={benefit.iconSrc} title={benefit.title} description={benefit.description} />
          ))}
        </div>
      </section>

      <section id={whyChoose.id} className="section-shell scroll-mt-28 py-12 lg:py-14">
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="section-title">{whyChoose.title}</h2>
          <p className="body-copy mx-auto mt-4 max-w-4xl">{whyChoose.subtitle}</p>
        </div>

        <div className="mx-auto mt-10 grid max-w-6xl gap-x-12 gap-y-8 md:grid-cols-2">
          {whyChoose.points.map((point) => (
            <article key={point.heading} className="flex gap-4">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-md bg-brand-greenTint text-[14px] text-brand-green">
                {point.icon}
              </div>
              <div>
                <h3 className="text-[23px] font-medium leading-[1.2] text-brand-ink md:text-[25px]">{point.heading}</h3>
                <p className="body-copy mt-2">{point.body}</p>
              </div>
            </article>
          ))}
        </div>
        <div className="mx-auto mt-10 max-w-6xl">
          <div className="section-divider" />
        </div>
      </section>

      {/* Prototype feature insertion retained for concept validation */}
      <AgentVideoModule />

      <ValueCreationWorkflow />

      <section id={ctaContent.id} className="section-shell scroll-mt-28 py-10 lg:py-12">
        <div className="space-y-5">
          <div className="h-1.5 w-16 rounded-full bg-brand-green" />
          <h2 className="max-w-4xl text-[28px] font-medium leading-[1.24] md:text-[34px]">{ctaContent.title}</h2>
          <p className="body-copy max-w-3xl">{ctaContent.body}</p>
          <a
            href={CALENDLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-12 items-center gap-2 rounded-md bg-brand-green px-8 text-[13px] font-medium text-white transition-colors hover:bg-brand-greenHover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green"
          >
            <Image src="/statistic.svg" alt="" width={14} height={14} className="h-3.5 w-3.5 object-contain" />
            {ctaContent.button}
          </a>
          <div className="section-divider" />
        </div>
      </section>

      <Footer />
    </main>
  );
}
