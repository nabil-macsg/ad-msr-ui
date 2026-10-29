import { Check, ChevronDown, Palette, RotateCcw } from 'lucide-react';
import { DropdownMenu } from 'radix-ui';
import { cn } from '../../shared/lib/cn';
import { INTENSITIES, type Intensity, THEMES } from './theme-presets';
import { swatches, themeOf } from './theme-tokens';
import { DEFAULT_CHOICE } from './theme-choice';
import { useThemeChoice } from './theme-context';

const INTENSITY_LABEL: Record<Intensity, string> = {
  soft: 'Soft',
  balanced: 'Balanced',
  vibrant: 'Vibrant',
};

function Swatches({ theme }: { theme: string }) {
  return (
    <span className="flex shrink-0 overflow-hidden rounded-sm ring-1 ring-white/25" aria-hidden>
      {swatches(themeOf(theme)).map((c, i) => (
        <span key={i} className="block h-3.5 w-2" style={{ backgroundColor: c }} />
      ))}
    </span>
  );
}

/**
 * Demo only: compare the eight theme presets at three intensities. It keeps its own neutral
 * colours so it reads the same whichever theme it applies.
 */
export function ThemePreviewToolbar() {
  const { theme, intensity, setTheme, setIntensity, reset } = useThemeChoice();
  const current = themeOf(theme);
  const isDefault = theme === DEFAULT_CHOICE.theme && intensity === DEFAULT_CHOICE.intensity;
  const control =
    'inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white';

  return (
    <section
      aria-label="Theme preview"
      className="sticky top-0 z-[35] flex h-[var(--preview-bar-h)] items-center gap-2.5 overflow-x-auto border-b border-white/10 bg-brand-charcoal px-4 text-white"
    >
      <p className="flex shrink-0 items-center gap-1.5 text-2xs font-semibold tracking-wider text-white/70 uppercase">
        <Palette className="size-3.5" aria-hidden />
        Theme preview
      </p>
      <span className="h-4 w-px shrink-0 bg-white/20" aria-hidden />

      <DropdownMenu.Root>
        <DropdownMenu.Trigger
          className={cn(control, 'shrink-0 bg-white/10 hover:bg-white/20')}
          aria-label={`Theme: ${current.name}`}
        >
          <Swatches theme={theme} />
          <span>{current.name}</span>
          <ChevronDown className="size-3.5 opacity-70" aria-hidden />
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-[70] w-80 rounded-lg border border-white/10 bg-brand-charcoal p-1 text-white shadow-overlay"
          >
            <DropdownMenu.RadioGroup value={theme} onValueChange={setTheme}>
              {THEMES.map((t) => (
                <DropdownMenu.RadioItem
                  key={t.key}
                  value={t.key}
                  className="flex cursor-pointer items-start gap-2.5 rounded-md px-2.5 py-2 outline-none data-[highlighted]:bg-white/10"
                >
                  <span className="mt-0.5">
                    <Swatches theme={t.key} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-xs font-semibold">{t.name}</span>
                    <span className="block text-[11px] leading-snug text-white/70">
                      {t.summary}
                    </span>
                  </span>
                  <DropdownMenu.ItemIndicator>
                    <Check className="mt-0.5 size-3.5" aria-hidden />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <div
        role="radiogroup"
        aria-label="Intensity"
        className="flex shrink-0 items-center gap-0.5 rounded-md bg-white/10 p-0.5"
      >
        {INTENSITIES.map((i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={intensity === i}
            onClick={() => setIntensity(i)}
            className={cn(
              control,
              'h-5 px-2',
              intensity === i
                ? 'bg-white text-brand-charcoal'
                : 'text-white/80 hover:bg-white/15 hover:text-white',
            )}
          >
            {INTENSITY_LABEL[i]}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={reset}
        disabled={isDefault}
        className={cn(
          control,
          'ml-auto shrink-0 text-white/80 hover:bg-white/10 hover:text-white disabled:opacity-40',
        )}
      >
        <RotateCcw className="size-3.5" aria-hidden />
        Reset to default
      </button>
    </section>
  );
}
