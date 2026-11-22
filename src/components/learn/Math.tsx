'use client';
import katex from 'katex';
import { useMemo } from 'react';

export function MathText({ latex, display, className }: { latex: string; display?: boolean; className?: string }) {
  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, { throwOnError: false, displayMode: !!display, output: 'html' });
    } catch {
      return null;
    }
  }, [latex, display]);
  if (!html) return <span className={className}>{latex}</span>;
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}

/** Problem statement: KaTeX when the content provides LaTeX, plain text for word problems. */
export function Statement({ latex, statement, className }: { latex?: string; statement: string; className?: string }) {
  if (latex) return <MathText latex={latex} className={className} />;
  return <span className={className}>{statement}</span>;
}
