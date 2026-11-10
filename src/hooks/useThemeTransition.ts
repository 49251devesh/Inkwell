import { useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useInkwell } from '../store/inkwellStore';

export function useThemeTransition() {
  const { data, toggleTheme } = useInkwell();
  const theme = data?.settings?.theme ?? 'daylight';

  const switchThemeWithInkSpread = useCallback(
    (event?: React.MouseEvent<HTMLElement>) => {
      const root = document.documentElement;
      const prefersReducedMotion =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      let x = window.innerWidth - 64;
      let y = 32;

      if (event) {
        const rect = event.currentTarget.getBoundingClientRect();
        x = rect.left + rect.width / 2;
        y = rect.top + rect.height / 2;
      }

      root.style.setProperty('--ink-x', `${Math.round(x)}px`);
      root.style.setProperty('--ink-y', `${Math.round(y)}px`);

      if (!prefersReducedMotion && typeof document.startViewTransition === 'function') {
        document.startViewTransition(() => {
          flushSync(() => {
            const next = toggleTheme();
            if (next === 'midnight') {
              root.classList.add('dark');
            } else {
              root.classList.remove('dark');
            }
          });
        });
      } else {
        toggleTheme();
      }
    },
    [toggleTheme]
  );

  return {
    theme,
    isMidnight: theme === 'midnight',
    switchThemeWithInkSpread,
  };
}
