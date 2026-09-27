// Pure validation rules for the quote request form. The backend (api/_lib/mailer.js)
// applies the same rules, since anything checked only in the browser can be bypassed.

const REGEX_EMAIL = /^[a-z0-9._%+-]+@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/i;

// Accepts a normal address (name@domain.tld): no spaces, no leading/trailing/double
// dots in the local part, and a domain with a real TLD.
export function isValidEmail(valor: string): boolean {
  const email = valor.trim();
  if (email.length > 254 || !REGEX_EMAIL.test(email)) return false;
  const local = email.slice(0, email.lastIndexOf('@'));
  return local.length <= 64 && !/^\.|\.\.|\.$/.test(local);
}

// Computes a check digit: the digits are weighted, summed, and the remainder
// of the sum against 11 decides the digit (10 and 11 remainders map to 0).
function digitoVerificador(digitos: number[], pesos: number[]): number {
  const soma = digitos.reduce((total, digito, i) => total + digito * pesos[i], 0);
  const resto = soma % 11;
  return resto < 2 ? 0 : 11 - resto;
}

// True for a well-formed CPF (11 digits, valid check digits, not a repeated
// sequence like 111.111.111-11). Accepts masked or unmasked input.
export function isValidCpf(valor: string): boolean {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length !== 11 || /^(\d)\1{10}$/.test(digitos)) return false;

  const numeros = digitos.split('').map(Number);
  const primeiro = digitoVerificador(numeros.slice(0, 9), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoVerificador(numeros.slice(0, 10), [11, 10, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === numeros[9] && segundo === numeros[10];
}

// True for a well-formed CNPJ (14 digits, valid check digits, not a repeated sequence).
export function isValidCnpj(valor: string): boolean {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;

  const numeros = digitos.split('').map(Number);
  const primeiro = digitoVerificador(numeros.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const segundo = digitoVerificador(numeros.slice(0, 13), [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return primeiro === numeros[12] && segundo === numeros[13];
}

// Today's date in the visitor's local time zone as YYYY-MM-DD. (toISOString()
// would give the UTC date, which is already "tomorrow" in Brazil after 9 p.m.)
export function todayIso(agora: Date = new Date()): string {
  const mes = String(agora.getMonth() + 1).padStart(2, '0');
  const dia = String(agora.getDate()).padStart(2, '0');
  return `${agora.getFullYear()}-${mes}-${dia}`;
}

// True when an ISO date (YYYY-MM-DD) is a real calendar date and is today or later.
export function isTodayOrFuture(iso: string, agora: Date = new Date()): boolean {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!partes) return false;

  const [, ano, mes, dia] = partes.map(Number);
  const data = new Date(ano, mes - 1, dia);
  const existe =
    data.getFullYear() === ano && data.getMonth() === mes - 1 && data.getDate() === dia;
  return existe && iso >= todayIso(agora);
}

export interface FaixaHorario {
  min: string;
  max: string;
}

// Weekly attendance hours: Monday-Friday 8am-6pm. Closed on weekends and
// national holidays.
const HORARIO_SEMANA: FaixaHorario = { min: '08:00', max: '18:00' };

// Fixed-date Brazilian national holidays (month/day, 1-indexed).
const FERIADOS_FIXOS: Array<[number, number]> = [
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

// Easter Sunday (Gregorian calendar) for a given year, via the standard
// "anonymous Gregorian algorithm" — needed because Carnaval, Sexta-feira
// Santa and Corpus Christi are all anchored to it and move every year.
function domingoDePascoa(ano: number): Date {
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
  return new Date(ano, mes - 1, dia);
}

function somarDias(data: Date, dias: number): Date {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

function paraIso(data: Date): string {
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${data.getFullYear()}-${mes}-${dia}`;
}

// All national holidays for one calendar year, as a set of ISO dates: the
// fixed-date ones plus the Easter-anchored ones (Carnaval is 2 days).
function feriadosDoAno(ano: number): Set<string> {
  const pascoa = domingoDePascoa(ano);
  const datas = [
    ...FERIADOS_FIXOS.map(([mes, dia]) => new Date(ano, mes - 1, dia)),
    somarDias(pascoa, -47), // Segunda-feira de Carnaval
    somarDias(pascoa, -46), // Terça-feira de Carnaval
    somarDias(pascoa, -2), // Sexta-feira Santa
    somarDias(pascoa, 60), // Corpus Christi
  ];
  return new Set(datas.map(paraIso));
}

// Cached per year: the date picker asks this repeatedly for dates that
// mostly fall in the same one or two calendar years.
const cacheFeriados = new Map<number, Set<string>>();

function isFeriado(iso: string, ano: number): boolean {
  if (!cacheFeriados.has(ano)) {
    cacheFeriados.set(ano, feriadosDoAno(ano));
  }
  return cacheFeriados.get(ano)!.has(iso);
}

// The bookable time range for an ISO date (YYYY-MM-DD): null (nothing
// bookable) on weekends, national holidays, or an invalid date.
export function faixaHorarioDoDia(iso: string): FaixaHorario | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!partes) return null;

  const [, ano, mes, dia] = partes.map(Number);
  const diaDaSemana = new Date(ano, mes - 1, dia).getDay();
  if (diaDaSemana === 0 || diaDaSemana === 6) return null;
  if (isFeriado(iso, ano)) return null;
  return HORARIO_SEMANA;
}

// True when the business attends on the given ISO date (weekday, not a holiday).
export function isDiaUtil(iso: string): boolean {
  return faixaHorarioDoDia(iso) !== null;
}

// True when `hora` (HH:MM) falls within the bookable range for `dataIso`.
export function isHorarioValido(hora: string, dataIso: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(hora)) return false;
  const faixa = faixaHorarioDoDia(dataIso);
  return faixa !== null && hora >= faixa.min && hora <= faixa.max;
}
