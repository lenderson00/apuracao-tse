import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { renderShareImage, shareFileName, shareText, SITE_URL, type ShareInput } from '../lib/share';
import type { ParsedResult } from '../lib/tse/types';
import { Icon } from './ui/Icon';

interface Shot {
  key: string;
  file: File;
  url: string;
}

const canShareFiles = (file: File) =>
  typeof navigator !== 'undefined' &&
  typeof navigator.canShare === 'function' &&
  window.matchMedia('(pointer: coarse)').matches &&
  navigator.canShare({ files: [file] });

export function ShareButton({
  data,
  title,
  photoUf,
  className,
  compact,
}: {
  data: ParsedResult | null;
  title: string;
  photoUf: string;
  className?: string;
  compact?: boolean;
}) {
  const [shot, setShot] = useState<Shot | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const input = useRef<ShareInput | null>(null);
  if (data) input.current = { data, title, photoUf };

  useEffect(() => () => void (shot && URL.revokeObjectURL(shot.url)), [shot]);

  const make = async (): Promise<Shot | null> => {
    const inp = input.current;
    if (!inp) return null;
    const key = `${inp.data.electionId}|${inp.data.scopeCode}|${inp.data.updatedAt}|${inp.title}`;
    if (shot?.key === key) return shot;
    const blob = await renderShareImage(inp);
    const file = new File([blob], shareFileName(inp), { type: 'image/png' });
    const next = { key, file, url: URL.createObjectURL(blob) };
    setShot(next);
    return next;
  };

  const onClick = async () => {
    if (busy || !input.current) return;
    setBusy(true);
    try {
      const s = await make();
      if (!s) return;
      if (canShareFiles(s.file)) {
        try {
          await navigator.share({ files: [s.file], text: `${shareText(input.current)} ${SITE_URL}` });
          return;
        } catch (e) {
          if ((e as Error).name === 'AbortError') return;
        }
      }
      setOpen(true);
    } finally {
      setBusy(false);
    }
  };

  const text = input.current ? shareText(input.current) : '';
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(SITE_URL);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* sem permissão de área de transferência */
    }
  };

  return (
    <>
      <button
        type="button"
        className={clsx('btn', compact ? 'btn-icon' : 'gap-1.5 px-2.5', className)}
        onClick={onClick}
        disabled={!data || busy}
        aria-label="Compartilhar placar"
        title="Compartilhar placar"
        data-share
      >
        <Icon name="share" size={compact ? 17 : 14} className={clsx(busy && 'animate-pulse')} />
        {!compact && <span>Compartilhar</span>}
      </button>
      {open &&
        shot &&
        createPortal(
          <ShareDialog
            shot={shot}
            text={text}
            copied={copied}
            onCopy={copy}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )}
    </>
  );
}

function ShareDialog({
  shot,
  text,
  copied,
  onCopy,
  onClose,
}: {
  shot: Shot;
  text: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const wa = `https://wa.me/?text=${encodeURIComponent(`${text} ${SITE_URL}`)}`;
  const x = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE_URL)}`;
  const item = 'btn h-10 w-full justify-start gap-2.5 px-3 text-small';
  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-label="Compartilhar placar"
      data-share-dialog
    >
      <div className="flex max-h-full w-full max-w-[620px] flex-col gap-5 overflow-auto rounded-2xl bg-raised p-5 shadow-2xl sm:flex-row">
        <img
          src={shot.url}
          alt="Prévia da imagem do placar"
          className="mx-auto w-full max-w-[260px] shrink-0 self-start rounded-lg sm:w-[260px]"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-body font-medium text-ink">Compartilhar placar</p>
              <p className="mt-1 text-small text-ink-3">Imagem com os números da última totalização.</p>
            </div>
            <button type="button" className="btn btn-icon -mr-1.5 -mt-1.5" onClick={onClose} aria-label="Fechar">
              <Icon name="close" size={16} />
            </button>
          </div>
          <div className="mt-4 flex flex-col gap-1">
            <a className={clsx(item, 'btn-solid')} href={shot.url} download={shot.file.name}>
              <Icon name="download" size={15} /> Baixar imagem
            </a>
            <button type="button" className={item} onClick={onCopy}>
              <Icon name="link" size={15} /> {copied ? 'Link copiado' : 'Copiar link'}
            </button>
            <a className={item} href={wa} target="_blank" rel="noreferrer">
              <WhatsAppMark /> WhatsApp
            </a>
            <a className={item} href={x} target="_blank" rel="noreferrer">
              <XMark /> Postar no X
            </a>
          </div>
          <p className="mt-auto pt-4 font-mono text-nano text-ink-4">{shot.file.name}</p>
        </div>
      </div>
    </div>
  );
}

function WhatsAppMark() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.4.1-.7.3-.2.3-.9.9-.9 2.2s.9 2.5 1 2.7c.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z" />
    </svg>
  );
}

function XMark() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.77L17.75 3Zm-1.08 16.17h1.7L7.4 4.73H5.58l11.09 14.44Z" />
    </svg>
  );
}
