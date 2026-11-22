'use client';
import { AppShell } from '@/components/layout/AppShell';
import { useProfile } from '@/stores/profile';
import { SKILLS } from '@/content';
import { ACHIEVEMENTS } from '@/lib/game/achievements';
import { levelProgress } from '@/lib/game/levels';
import { Label, NoteCard, ProgressBar, cx } from '@/components/ui';
import { AchievementSticker, LevelStamp, MasteryStamp, Spark } from '@/components/game';
import { Scribble } from '@/components/notebook/Scribble';
import { TopicGlyph } from '@/components/notebook/LearningPath';
import { Tape } from '@/components/notebook/Annotations';

export default function RewardsPage() {
  return <AppShell><Rewards /></AppShell>;
}

function Rewards() {
  const { user, achievements, mastery } = useProfile();
  if (!user) return null;
  const lp = levelProgress(user.xp);
  const got = ACHIEVEMENTS.filter((a) => achievements[a.id]).length;
  return (
    <div className="space-y-8">
      <div>
        <Label>Rewards</Label>
        <h1 className="mt-2 font-display text-[32px] font-extrabold leading-10 sm:text-[36px]">Your collection</h1>
      </div>

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="relative overflow-hidden rounded-[24px] border border-line bg-white p-6 shadow-[var(--shadow-card)] lg:col-span-5 sm:p-8">
          <Tape className="absolute -top-1 right-10 rotate-[8deg]" color="rgba(118,87,232,0.25)" />
          <Label>Your learning level</Label>
          <div className="mt-4 flex items-center gap-4">
            <LevelStamp level={lp.level} size={76} />
            <div>
              <div className="font-display text-[28px] font-extrabold leading-8">{lp.rank} <Spark /></div>
              <div className="text-ink-2 tabular">{user.xp} XP</div>
            </div>
          </div>
          <ProgressBar className="mt-6" value={lp.pct} label={<span className="tabular">{user.xp} XP</span>} right={<span className="tabular">{user.xp + lp.toNext} XP</span>} />
          <p className="mt-2 font-hand text-[22px] text-violet-ink">{lp.toNext} XP until your next level.</p>
        </div>

        <div className="rounded-[24px] border border-line bg-white p-6 shadow-[var(--shadow-card)] lg:col-span-7 sm:p-8">
          <div className="flex items-center justify-between gap-3"><Label>Sticker book</Label><span className="text-sm tabular text-muted">{got} of {ACHIEVEMENTS.length}</span></div>
          <div className="paper-dots mt-5 grid grid-cols-2 gap-6 rounded-[18px] p-4 sm:grid-cols-4">
            {ACHIEVEMENTS.map((a, i) => (
              <div key={a.id} className="flex flex-col items-center gap-1">
                <AchievementSticker def={a} unlocked={!!achievements[a.id]} size={76} tilt={[-6, 4, -3, 7][i % 4]} />
                <span className={cx('text-center text-xs', achievements[a.id] ? 'text-ink-2' : 'text-muted')}>{a.meaning}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div>
        <h2 className="font-display text-[22px] font-bold">Mastery stamps</h2>
        <p className="text-ink-2">A topic earns its stamp at 80% mastery, after 3+ challenges, with the last two done with two hints or fewer.</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {SKILLS.map((s) => {
            const m = mastery[s.id];
            return (
              <NoteCard key={s.id} tone={m?.mastered ? 'mint' : 'white'} className="flex flex-col items-center gap-3 p-5 text-center">
                <TopicGlyph id={s.id} size={44} dim={!m?.mastered} />
                <div className="font-semibold leading-5">{s.name}</div>
                {m?.mastered ? <MasteryStamp size={72} /> : (
                  <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-dashed border-line text-sm tabular text-muted">{Math.round((m?.value ?? 0) * 100)}%</div>
                )}
              </NoteCard>
            );
          })}
        </div>
      </div>

      {got === 0 && (
        <div className="flex items-center gap-4"><Scribble mood="encouraging" size={56} /><p className="font-hand text-[24px] text-ink-2">Your first sticker is one solved challenge away.</p></div>
      )}
    </div>
  );
}
