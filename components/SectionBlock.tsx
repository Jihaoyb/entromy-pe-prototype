interface SectionBlockProps {
  id?: string;
  title: string;
  paragraphs: string[];
}

export function SectionBlock({ id, title, paragraphs }: SectionBlockProps) {
  return (
    <section id={id} className="section-shell scroll-mt-28 py-10 lg:py-12">
      {/* Flat content section: intentional spacing + typography, no outer card shell. */}
      <div className="space-y-4">
        <div className="h-1 w-14 rounded-full bg-brand-green/70" />
        <h2 className="section-title max-w-4xl">{title}</h2>
        <div className="max-w-3xl space-y-4">
          {paragraphs.map((paragraph) => (
            <p key={paragraph} className="body-copy">
              {paragraph}
            </p>
          ))}
        </div>
        <div className="section-divider" />
      </div>
    </section>
  );
}
