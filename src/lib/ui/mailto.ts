export const CONTACT_EMAIL = 'contato@lenderson.com.br';
const SUBJECT = 'Anuncio no site da apuracao';

export interface AdFields {
  nome: string;
  marca: string;
  contato: string;
  mensagem: string;
}

/** Texto da mensagem (o mesmo do e-mail e do botão de copiar). */
export function buildBody(f: AdFields): string {
  return [
    'Oi, Lenderson. Quero anunciar no site da apuração.',
    '',
    `Nome: ${f.nome.trim()}`,
    `Empresa ou marca: ${f.marca.trim() || '-'}`,
    `WhatsApp ou e-mail: ${f.contato.trim()}`,
    '',
    'Mensagem:',
    f.mensagem.trim() || '-',
  ].join('\n');
}

/** Monta o mailto com assunto e corpo já preenchidos (tudo codificado). */
export function buildMailto(f: AdFields): string {
  const body = buildBody(f);
  return `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(SUBJECT)}&body=${encodeURIComponent(body)}`;
}

