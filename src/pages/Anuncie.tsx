import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import gsap from 'gsap';
import { Mark } from '../components/Chrome';
import { Icon } from '../components/ui/Icon';
import { dur } from '../lib/ui/motion';
import { buildBody, buildMailto, type AdFields } from '../lib/ui/mailto';

export default function Anuncie() {
  const [f, setF] = useState<AdFields>({ nome: '', marca: '', contato: '', mensagem: '' });
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.title = 'Anuncie · Apuração 2026';
  }, []);

  useLayoutEffect(() => {
    if (!root.current) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(
        '[data-in]',
        { opacity: 0, y: 10 },
        { opacity: 1, y: 0, duration: dur(0.45), ease: 'power3.out', stagger: 0.06 },
      );
    }, root);
    return () => ctx.revert();
  }, []);

  const set = (k: keyof AdFields) => (e: { target: { value: string } }) => {
    setCopied(false);
    setF((p) => ({ ...p, [k]: e.target.value }));
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    window.location.href = buildMailto(f);
    setSent(true);
  };

  return (
    <div ref={root} className="h-dvh overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full w-full max-w-[26rem] flex-col px-5 pb-10 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <a
          data-in
          href="/"
          className="-ml-2 flex h-9 w-fit items-center gap-1.5 rounded-(--r-inner) px-2 text-caption text-ink-3 transition-colors hover:bg-hover hover:text-ink"
        >
          <Icon name="arrow-left" size={14} />
          Voltar para a apuração
        </a>

        <header data-in className="mt-8 flex items-center gap-3">
          <Mark size={36} />
          <h1 className="text-title font-semibold text-ink">Anuncie no site da apuração</h1>
        </header>
        <p data-in className="mt-3 text-small leading-relaxed text-ink-2">
          Conta um pouco da sua marca e do que você quer mostrar. Te respondo com os valores e os detalhes do espaço.
        </p>

        <form data-in onSubmit={submit} className="mt-7 flex flex-col gap-4">
          <Field label="Nome" id="nome">
            <input id="nome" required autoComplete="name" className="field ad-field" value={f.nome} onChange={set('nome')} />
          </Field>
          <Field label="Empresa ou marca" id="marca">
            <input id="marca" autoComplete="organization" className="field ad-field" value={f.marca} onChange={set('marca')} />
          </Field>
          <Field label="WhatsApp ou e-mail" id="contato">
            <input
              id="contato"
              required
              autoComplete="email"
              className="field ad-field"
              value={f.contato}
              onChange={set('contato')}
            />
          </Field>
          <Field label="Mensagem" id="mensagem">
            <textarea
              id="mensagem"
              rows={4}
              className="field ad-field resize-none py-2 leading-relaxed"
              placeholder="O que você quer anunciar e por quanto tempo"
              value={f.mensagem}
              onChange={set('mensagem')}
            />
          </Field>

          <button type="submit" className="btn btn-solid mt-1 h-10 w-full">
            <Icon name="mail" size={15} />
            Enviar por e-mail
          </button>
          <p className="text-caption leading-relaxed text-ink-3" aria-live="polite">
            {sent ? 'Abri o seu app de e-mail com a mensagem pronta.' : 'O botão abre o seu app de e-mail com a mensagem pronta.'}
          </p>
          {sent && (
            <button
              type="button"
              className="btn btn-outline h-10 w-full"
              onClick={() => {
                void navigator.clipboard?.writeText(buildBody(f)).then(() => setCopied(true));
              }}
            >
              {copied ? 'Mensagem copiada' : 'Copiar mensagem'}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

function Field({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-caption font-medium text-ink-2">
        {label}
      </label>
      {children}
    </div>
  );
}
