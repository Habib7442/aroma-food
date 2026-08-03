type Section = {
  heading: string;
  body: React.ReactNode;
};

export function LegalArticle({
  title,
  updated,
  intro,
  sections,
}: {
  title: string;
  updated: string;
  intro?: string;
  sections: Section[];
}) {
  return (
    <article>
      <h1 className="font-display text-3xl font-extrabold tracking-[-0.01em] text-on-surface sm:text-4xl">
        {title}
      </h1>
      <p className="mt-2 text-sm text-on-surface-variant">Last updated: {updated}</p>

      {intro && <p className="mt-6 text-base leading-7 text-on-surface-variant">{intro}</p>}

      <div className="mt-10 space-y-10">
        {sections.map((section) => (
          <section key={section.heading}>
            <h2 className="font-display text-xl font-bold text-on-surface">{section.heading}</h2>
            <div className="mt-3 space-y-4 text-base leading-7 text-on-surface-variant [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
              {section.body}
            </div>
          </section>
        ))}
      </div>
    </article>
  );
}
