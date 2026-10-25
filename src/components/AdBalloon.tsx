import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import NumberFlow from '@number-flow/react';
import clsx from 'clsx';
import gsap from 'gsap';
import { Icon } from './ui/Icon';
import { dur, prefersReducedMotion } from '../lib/ui/motion';
import { MINI_BR, MINI_BR_SIZE } from '../lib/ui/miniBrazil';

export const ANUNCIE_PATH = '/anuncie';

/* números reais do próprio site: UFs no mapa e municípios no índice do TSE */
const STATS = { ufs: 27, muns: 5571 } as const;

const PERKS: Array<{ icon: Parameters<typeof Icon>[0]['name']; text: string }> = [
  { icon: 'activity', text: 'Quem abre o site está acompanhando a contagem dos votos.' },
  { icon: 'map', text: 'O anúncio aparece em todas as telas, do Brasil inteiro até cada município.' },
  { icon: 'devices', text: 'Vale para computador e celular.' },
  { icon: 'clock', text: 'Fica no ar até o fim da apuração.' },
];

const NEUTRAL = '#3a3a42';
const ACCENT = '#43d1b5';

/**
 * Balão discreto "Anuncie aqui". Abre um painel com as vantagens e um link
 * para /anuncie. Fecha no X, no Esc e com clique fora.
 */
export function AdBalloon({
  align,
  className,
  style,
}: {
  /** lado do balão em que o painel se alinha */
  align: 'left' | 'right';
  className?: string;
  style?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [stats, setStats] = useState({ ufs: 0, muns: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const tl = useRef<gsap.core.Timeline | null>(null);
  const loop = useRef<gsap.core.Timeline | null>(null);
  const id = useId();
  const panelId = `${id}-anuncie`;
  const titleId = `${id}-titulo`;

  const show = () => {
    setStats({ ufs: 0, muns: 0 });
    setMounted(true);
    setOpen(true);
  };

  const close = useCallback((restoreFocus: boolean) => {
    setOpen(false);
    loop.current?.kill();
    tl.current?.kill();
    const panel = panelRef.current;
    const done = () => {
      setMounted(false);
      if (restoreFocus) btnRef.current?.focus();
    };
    if (!panel || prefersReducedMotion()) return done();
    gsap.to(panel, { opacity: 0, y: 6, scale: 0.98, duration: 0.16, ease: 'power2.in', onComplete: done });
  }, []);

  /* animação de entrada + mini mapa "ao vivo" */
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!open || !panel) return;
    const q = gsap.utils.selector(panel);
    const states = q('[data-mini-uf]');
    const reduced = prefersReducedMotion();
    panel.focus({ preventScroll: true });

    if (reduced) {
      gsap.set(states, { fill: NEUTRAL, opacity: 1 });
      setStats({ ...STATS });
      return;
    }

    const t = gsap.timeline({ defaults: { ease: 'power3.out' } });
    t.fromTo(
      panel,
      { opacity: 0, y: 10, scale: 0.96 },
      { opacity: 1, y: 0, scale: 1, duration: dur(0.34) },
    )
      .fromTo(
        states,
        { opacity: 0, scale: 0.6, transformOrigin: '50% 50%' },
        { opacity: 1, scale: 1, duration: dur(0.4), stagger: { each: 0.022, from: 'random' } },
        0.08,
      )
      .fromTo(q('[data-live]'), { opacity: 0, x: -4 }, { opacity: 1, x: 0, duration: dur(0.3) }, 0.18)
      .call(() => setStats({ ...STATS }), undefined, 0.22)
      .fromTo(
        q('[data-slot]'),
        { scaleX: 0, transformOrigin: '0% 50%' },
        { scaleX: 1, duration: dur(0.5), ease: 'power4.out' },
        0.3,
      )
      .fromTo(q('[data-slot-text]'), { opacity: 0 }, { opacity: 1, duration: dur(0.25) }, 0.6)
      .fromTo(q('[data-perk]'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: dur(0.36), stagger: 0.07 }, 0.24)
      .fromTo(q('[data-cta]'), { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: dur(0.3) }, 0.5);
    tl.current = t;

    /* estados acendendo um de cada vez, como resultado chegando */
    const l = gsap.timeline({ repeat: -1, delay: 0.9 });
    const order = gsap.utils.shuffle([...states]);
    order.forEach((el, i) => {
      l.to(el, { fill: ACCENT, duration: 0.35, ease: 'power2.out' }, i * 0.32).to(
        el,
        { fill: NEUTRAL, duration: 1.1, ease: 'power2.inOut' },
        i * 0.32 + 0.45,
      );
    });
    loop.current = l;

    return () => {
      t.kill();
      l.kill();
    };
  }, [open]);

  /* Esc e clique fora. Captura no window para o Esc não voltar o mapa um nível. */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      close(true);
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close(false);
    };
    window.addEventListener('keydown', onKey, true);
    const tid = window.setTimeout(() => window.addEventListener('pointerdown', onDown), 0);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearTimeout(tid);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [open, close]);

  return (
    <div className={clsx('pointer-events-none', className)} style={style}>
      <div className="relative">
        <button
          ref={btnRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={mounted ? panelId : undefined}
          onClick={() => (open ? close(false) : show())}
          className={clsx(
            'float pointer-events-auto flex h-8 items-center gap-1.5 rounded-full px-3 text-micro font-medium transition-colors duration-150',
            open ? 'text-ink' : 'text-ink-2 hover:text-ink',
          )}
        >
          <Icon name="megaphone" size={13} />
          Anuncie aqui
        </button>

        {mounted && (
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={clsx(
              'tooltip pointer-events-auto absolute bottom-full z-50 mb-2 w-[min(20rem,calc(100vw-1rem))] p-3 text-caption text-ink-2 outline-none',
              align === 'right' ? 'right-0 origin-bottom-right' : 'left-0 origin-bottom-left',
            )}
            style={{ opacity: 0 }}
          >
            <div className="flex items-start justify-between gap-3 pl-1 pt-0.5">
              <p id={titleId} className="text-small font-medium text-ink">
                Anuncie no site da apuração
              </p>
              <button
                type="button"
                className="btn btn-icon -mr-1 -mt-1 size-7 shrink-0"
                aria-label="Fechar"
                onClick={() => close(true)}
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <MiniVisual stats={stats} />

            <ul className="mt-3 flex flex-col gap-2 px-1">
              {PERKS.map((p) => (
                <li key={p.text} data-perk className="flex items-start gap-2.5">
                  <span className="grid size-6 shrink-0 place-items-center rounded-(--r-inner) bg-white/5 text-ink-2">
                    <Icon name={p.icon} size={13} />
                  </span>
                  <span className="pt-[3px] leading-[1.35]">{p.text}</span>
                </li>
              ))}
            </ul>

            <a data-cta href={ANUNCIE_PATH} className="btn btn-solid mt-3.5 w-full">
              Quero anunciar
              <Icon name="arrow-right" size={14} />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

/** Mini "tela" do site: mapa acendendo, selo ao vivo, contadores e o espaço do anúncio. */
function MiniVisual({ stats }: { stats: { ufs: number; muns: number } }) {
  return (
    <div className="mt-2.5 grid grid-cols-[6.5rem_minmax(0,1fr)] gap-3 rounded-(--r-control) bg-white/[0.035] p-3" aria-hidden>
      <svg viewBox={`-2 -2 ${MINI_BR_SIZE + 4} ${MINI_BR_SIZE + 4}`} className="h-26 w-26 self-center">
        {MINI_BR.map((s) => (
          <path
            key={s.uf}
            data-mini-uf={s.uf}
            d={s.d}
            style={{ fill: NEUTRAL, stroke: 'var(--map-stroke)', strokeWidth: 0.6, strokeLinejoin: 'round' }}
          />
        ))}
      </svg>
      <div className="flex min-w-0 flex-col justify-between gap-2">
        <span data-live className="pill pill-live self-start shadow-none">
          <span className="live-dot" />
          ao vivo
        </span>
        <div className="flex flex-col gap-1">
          <Stat value={stats.ufs} label="UFs no mapa" />
          <Stat value={stats.muns} label="municípios" />
        </div>
        <div data-slot className="ad-slot relative overflow-hidden rounded-[6px] bg-accent-soft px-2 py-1">
          <span data-slot-text className="block truncate font-mono text-nano text-accent">
            Seu anúncio aqui
          </span>
        </div>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-title font-semibold text-ink">
        <NumberFlow
          value={value}
          locales="pt-BR"
          format={{ maximumFractionDigits: 0, useGrouping: true }}
          className="tnum"
          transformTiming={{ duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
          spinTiming={{ duration: 900, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' }}
          respectMotionPreference
          willChange={false}
        />
      </span>
      <span className="truncate font-mono text-nano text-ink-3">{label}</span>
    </div>
  );
}
