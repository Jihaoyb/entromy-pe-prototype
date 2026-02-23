import Image from 'next/image';

interface BenefitCardProps {
  iconSrc: string;
  title: string;
  description: string;
}

export function BenefitCard({ iconSrc, title, description }: BenefitCardProps) {
  return (
    <article className="h-full rounded-md border border-brand-line bg-brand-panel p-8 text-center shadow-card">
      <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center">
        <Image src={iconSrc} alt={`${title} icon`} width={48} height={48} className="h-12 w-12 object-contain" />
      </div>
      <h3 className="text-[17px] font-medium leading-[1.25] text-brand-ink md:text-[19px]">{title}</h3>
      <p className="mt-4 text-[15px] leading-[1.5] text-brand-muted">{description}</p>
    </article>
  );
}
