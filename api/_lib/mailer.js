const MailComposer = require('nodemailer/lib/mail-composer');
const { google } = require('googleapis');

const OAuth2 = google.auth.OAuth2;

// The email logos are PNGs from the site's public/images/ folder. They have to
// be PNG (WebP doesn't render in many mail clients) and referenced by absolute
// HTTPS URL: Gmail blocks data: URIs, and cid: attachments broke for recipients
// on other mail hosts. The URL uses the production domain rather than a
// *.vercel.app one so it keeps working wherever the site and this API are
// hosted (Vercel today, AWS later). Bump the version whenever a logo file
// changes so mail proxies don't keep serving a cached (or cached-as-missing) copy.
// Update this once the Dulane site is actually deployed at its real domain —
// this must be a public https URL (no *.vercel.app), since email clients
// fetch it directly and can't reach localhost or a Vercel preview URL.
const LOGOS_BASE_URL = 'https://dulane.com.br/images';
const VERSAO_LOGOS = 3;

function urlDaLogo(nomeArquivo) {
  return `${LOGOS_BASE_URL}/${nomeArquivo}?v=${VERSAO_LOGOS}`;
}

// Lets this API be called cross-origin — the site is meant to work whether
// it's served from this same Vercel deployment or from a static host (e.g.
// AWS S3/CloudFront) that can't run these functions itself, so the frontend
// always calls this backend's absolute URL regardless of its own origin.
// No cookies/credentials are involved, so a wildcard origin is safe here.
function aplicarCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}

// Reused across warm invocations of this function instance, so a repeat
// request doesn't have to round-trip to Google's OAuth endpoint again for
// an access token that's often still valid for most of an hour.
let cachedAccessToken = null;
let cachedAccessTokenExpiry = 0;

async function getAuthClient() {
  const oauth2Client = new OAuth2(
    process.env.GMAIL_CLIENT_ID,
    process.env.GMAIL_CLIENT_SECRET,
    'https://developers.google.com/oauthplayground',
  );

  const bufferMs = 60_000;
  if (cachedAccessToken && Date.now() < cachedAccessTokenExpiry - bufferMs) {
    oauth2Client.setCredentials({
      refresh_token: process.env.GMAIL_REFRESH_TOKEN,
      access_token: cachedAccessToken,
      expiry_date: cachedAccessTokenExpiry,
    });
    return oauth2Client;
  }

  oauth2Client.setCredentials({ refresh_token: process.env.GMAIL_REFRESH_TOKEN });
  const { token } = await oauth2Client.getAccessToken();
  cachedAccessToken = token;
  cachedAccessTokenExpiry = oauth2Client.credentials.expiry_date || Date.now() + 30 * 60_000;
  return oauth2Client;
}

// Builds the raw RFC 2822 MIME message (locally, no network) and delivers it
// with a single HTTPS call to the Gmail API - avoids opening a full SMTP
// session, which tends to be slower and less reliable from serverless functions.
async function enviarEmail(mailOptions) {
  const mail = new MailComposer(mailOptions);
  const message = await mail.compile().build();
  const raw = message
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const auth = await getAuthClient();
  const gmail = google.gmail({ version: 'v1', auth });
  await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
}

const TAMANHO_MAX_ANEXO_BYTES = 3 * 1024 * 1024;

// The rules below mirror src/app/pages/dulane/shared/components/orcamento-modal/
// orcamento-validators.ts (the browser-side check); the API repeats them because
// anything validated only in the browser can be bypassed.

const REGEX_EMAIL = /^[a-z0-9._%+-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

function isValidEmail(value) {
  const email = String(value || '').trim();
  if (email.length > 254 || !REGEX_EMAIL.test(email)) return false;
  const local = email.slice(0, email.lastIndexOf('@'));
  return local.length <= 64 && !/^\.|\.\.|\.$/.test(local);
}

function digitoVerificador(digitos, pesos) {
  const soma = digitos.reduce((total, digito, i) => total + digito * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

function isValidCpf(value) {
  const digitos = String(value || '').replace(/\D/g, '');
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;
  const numeros = digitos.split('').map(Number);
  return (
    digitoVerificador(numeros.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]) === numeros[9] &&
    digitoVerificador(numeros.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]) === numeros[10]
  );
}

function isValidCnpj(value) {
  const digitos = String(value || '').replace(/\D/g, '');
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;
  const numeros = digitos.split('').map(Number);
  return (
    digitoVerificador(numeros.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) ===
      numeros[12] &&
    digitoVerificador(numeros.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]) ===
      numeros[13]
  );
}

// True when a DD/MM/YYYY date (the format the form sends) is a real calendar
// date and is today or later. "Today" is Brazil's date, not the server's: the
// function runs in UTC, which is already "tomorrow" in Brazil after 9 p.m.
function isTodayOrFuture(dataBr, agora = new Date()) {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dataBr || ''));
  if (!partes) return false;

  const [dia, mes, ano] = partes.slice(1).map(Number);
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  const existe =
    data.getUTCFullYear() === ano && data.getUTCMonth() === mes - 1 && data.getUTCDate() === dia;

  const hoje = agora.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
  return existe && `${partes[3]}-${partes[2]}-${partes[1]}` >= hoje;
}

// Weekly attendance hours: Monday-Friday 8am-6pm. Closed on weekends and
// national holidays.
const HORARIO_SEMANA = { min: '08:00', max: '18:00' };

// Fixed-date Brazilian national holidays (month/day, 1-indexed).
const FERIADOS_FIXOS = [
  [1, 1], // Confraternização Universal
  [4, 21], // Tiradentes
  [5, 1], // Dia do Trabalho
  [9, 7], // Independência
  [10, 12], // Nossa Senhora Aparecida
  [11, 2], // Finados
  [11, 15], // Proclamação da República
  [11, 20], // Consciência Negra
  [12, 25], // Natal
];

// Easter Sunday (Gregorian calendar, UTC) for a given year, via the standard
// "anonymous Gregorian algorithm" — needed because Carnaval, Sexta-feira
// Santa and Corpus Christi are all anchored to it and move every year.
function domingoDePascoa(ano) {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

function somarDias(data, dias) {
  const resultado = new Date(data);
  resultado.setUTCDate(resultado.getUTCDate() + dias);
  return resultado;
}

function paraIso(data) {
  const mes = String(data.getUTCMonth() + 1).padStart(2, '0');
  const dia = String(data.getUTCDate()).padStart(2, '0');
  return `${data.getUTCFullYear()}-${mes}-${dia}`;
}

// All national holidays for one calendar year, as a set of ISO dates: the
// fixed-date ones plus the Easter-anchored ones (Carnaval is 2 days).
function feriadosDoAno(ano) {
  const pascoa = domingoDePascoa(ano);
  const datas = [
    ...FERIADOS_FIXOS.map(([mes, dia]) => new Date(Date.UTC(ano, mes - 1, dia))),
    somarDias(pascoa, -47), // Segunda-feira de Carnaval
    somarDias(pascoa, -46), // Terça-feira de Carnaval
    somarDias(pascoa, -2), // Sexta-feira Santa
    somarDias(pascoa, 60), // Corpus Christi
  ];
  return new Set(datas.map(paraIso));
}

// Cached per year: the form submits repeatedly for dates that mostly fall
// in the same one or two calendar years.
const cacheFeriados = new Map();

function isFeriado(iso, ano) {
  if (!cacheFeriados.has(ano)) {
    cacheFeriados.set(ano, feriadosDoAno(ano));
  }
  return cacheFeriados.get(ano).has(iso);
}

// The bookable time range for a DD/MM/YYYY date: null (nothing bookable)
// on weekends, national holidays, or an invalid date.
function faixaHorarioDoDia(dataBr) {
  const partes = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(String(dataBr || ''));
  if (!partes) return null;

  const [dia, mes, ano] = partes.slice(1).map(Number);
  const diaDaSemana = new Date(Date.UTC(ano, mes - 1, dia)).getUTCDay();
  if (diaDaSemana === 0 || diaDaSemana === 6) return null;
  const iso = `${ano}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  if (isFeriado(iso, ano)) return null;
  return HORARIO_SEMANA;
}

// Checks the fields that need more than "is present". Returns the error
// message to send back with a 400, or null when everything is fine. The
// document (CPF or CNPJ), preferred date and preferred time are optional
// server-side, but must be valid when provided.
function erroDeValidacao({ email, document, preferredDate, preferredTime }) {
  if (!isValidEmail(email)) return 'Email inválido';
  if (document && !isValidCpf(document) && !isValidCnpj(document)) {
    return 'CPF ou CNPJ inválido';
  }
  if (preferredDate && !isTodayOrFuture(preferredDate)) {
    return 'A data preferida deve ser de hoje em diante';
  }
  if (preferredDate) {
    const faixa = faixaHorarioDoDia(preferredDate);
    if (!faixa) return 'Não atendemos aos finais de semana e feriados';
    if (
      preferredTime &&
      !(/^\d{2}:\d{2}$/.test(preferredTime) && preferredTime >= faixa.min && preferredTime <= faixa.max)
    ) {
      return `Escolha um horário entre ${faixa.min} e ${faixa.max}`;
    }
  }
  return null;
}

// Validates an { nome, tipo, base64 } attachment payload and converts it to
// the shape nodemailer expects. Returns null for an absent/empty attachment.
function paraAnexoNodemailer(anexo) {
  if (!anexo || !anexo.base64) return null;
  if (!anexo.nome || typeof anexo.base64 !== 'string') {
    throw new Error('Anexo inválido');
  }
  const bytesAproximados = Math.ceil((anexo.base64.length * 3) / 4);
  if (bytesAproximados > TAMANHO_MAX_ANEXO_BYTES) {
    throw new Error('Anexo excede o tamanho máximo permitido (3 MB)');
  }
  return {
    filename: anexo.nome,
    content: anexo.base64,
    encoding: 'base64',
    contentType: anexo.tipo || 'application/octet-stream',
  };
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Plain-text fallback for the quote-request notification, shown by clients
// that don't render HTML email.
function montarTextoPlano(campos) {
  return [
    ['Nome', campos.name],
    ['Documento', campos.document],
    ['Endereço', campos.address],
    ['E-mail', campos.email],
    ['Telefone', campos.phone],
    ['Data agendada', campos.preferredDate],
    ['Hora agendada', campos.preferredTime],
    ['Descrição', campos.description],
  ]
    .filter(([, valor]) => valor)
    .map(([campo, valor]) => `${campo}: ${valor}`)
    .join('\n');
}

// Shared HTML body for the quote-request notification emails. Each LP in
// this project passes its own logo and colors; the layout, field handling
// and attachment/footer notes stay identical so a fix here applies
// everywhere at once.
function montarEmailHtml({
  logoUrl,
  logoAlt,
  logoLargura,
  logoAltura,
  corPrimaria,
  corEscura,
  corFundoSuave,
  corFundoTopo = '#ffffff',
  corTextoTopo = '#64748b',
  subtitulo,
  siteUrl,
  campos: { name, document, address, email, phone, preferredDate, preferredTime, description },
  temAnexo,
}) {
  const linha = (rotulo, valor) =>
    valor
      ? `<tr><td style="padding: 6px 0; color: ${corEscura}; font-size: 14px;"><strong>${rotulo}:</strong> ${escapeHtml(valor)}</td></tr>`
      : '';

  // A dark header background by default; pass corFundoTopo: '#ffffff' for a
  // white header with a colored accent border instead.
  const estiloTopo =
    corFundoTopo === '#ffffff'
      ? `background-color: #ffffff; border-bottom: 3px solid ${corPrimaria};`
      : `background-color: ${corFundoTopo};`;

  return `
    <div style="max-width: 520px; margin: 0 auto; font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; border: 1px solid #e2e2e2; border-radius: 12px; overflow: hidden;">
      <div style="${estiloTopo} padding: 20px 24px;">
        <img
          src="${logoUrl}"
          alt="${escapeHtml(logoAlt)}"
          width="${logoLargura}"
          height="${logoAltura}"
          style="display: block; width: ${logoLargura}px; height: ${logoAltura}px; margin: 0 0 8px;"
        />
        <p style="margin: 0; font-size: 13px; color: ${corTextoTopo};">${subtitulo}</p>
      </div>

      <div style="padding: 24px; background-color: #ffffff;">
        <p style="margin: 0 0 16px; font-size: 14px; color: #333333;">
          ${subtitulo}, enviado por <strong>${escapeHtml(name)}</strong>.
        </p>

        <div style="background-color: ${corFundoSuave}; border-radius: 10px; padding: 16px; margin-bottom: 16px;">
          <div style="font-weight: 700; font-size: 15px; color: ${corEscura}; margin-bottom: 4px;">${escapeHtml(name)}</div>
          ${document ? `<div style="font-size: 12px; color: #64748b; margin-bottom: 12px;">Documento: ${escapeHtml(document)}</div>` : ''}

          <table style="width: 100%; border-collapse: collapse;">
            ${linha('Endereço', address)}
            ${linha('E-mail', email)}
            ${linha('Telefone', phone)}
            ${linha('Data agendada', preferredDate)}
            ${linha('Hora agendada', preferredTime)}
          </table>
        </div>

        <div>
          <p style="margin: 0 0 8px; font-size: 14px; font-weight: 700; color: ${corEscura};">Descrição</p>
          <div style="background-color: ${corFundoSuave}; border-left: 3px solid ${corPrimaria}; padding: 12px 16px; font-size: 14px; line-height: 1.6; text-align: left; color: #333333; border-radius: 0 6px 6px 0; white-space: pre-wrap;">
            ${escapeHtml(description)}
          </div>
        </div>

        ${
          temAnexo
            ? `<p style="margin: 16px 0 0; font-size: 13px; color: ${corEscura};">📎 Este e-mail inclui anexo(s) enviado(s) pelo formulário.</p>`
            : ''
        }
      </div>

      <div style="background-color: #f8fafc; padding: 14px 24px; text-align: center;">
        <p style="margin: 0; font-size: 12px; color: #94a3b8;">
          Enviado automaticamente pelo formulário do site${
            siteUrl
              ? ` — <a href="${siteUrl}" style="color: ${corPrimaria}; text-decoration: none;">${siteUrl.replace(/^https?:\/\//, '')}</a>`
              : ''
          }
        </p>
      </div>
    </div>
  `;
}

module.exports = {
  enviarEmail,
  isValidEmail,
  isValidCpf,
  isValidCnpj,
  isTodayOrFuture,
  erroDeValidacao,
  paraAnexoNodemailer,
  escapeHtml,
  montarTextoPlano,
  montarEmailHtml,
  aplicarCors,
  urlDaLogo,
};
