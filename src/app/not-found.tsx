import Link from 'next/link';
import { Scribble } from '@/components/notebook/Scribble';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Scribble mood="curious" size={88} />
      <h1 className="font-display text-[32px] font-extrabold">This page got torn out</h1>
      <p className="text-ink-2">The page you were looking for isn&apos;t in the notebook.</p>
      <Link href="/" className="font-semibold text-violet-ink">Back to Margin</Link>
    </div>
  );
}
