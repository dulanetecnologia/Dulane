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

// Weekly attendance hours: Monday-Friday 8am-6pm, Saturday 8am-noon, closed Sundays.
const HORARIO_SEMANA: FaixaHorario = { min: '08:00', max: '18:00' };
const HORARIO_SABADO: FaixaHorario = { min: '08:00', max: '12:00' };

// The bookable time range for an ISO date (YYYY-MM-DD): narrower on
// Saturdays, null (nothing bookable) on Sundays or an invalid date.
export function faixaHorarioDoDia(iso: string): FaixaHorario | null {
  const partes = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!partes) return null;

  const [, ano, mes, dia] = partes.map(Number);
  const diaDaSemana = new Date(ano, mes - 1, dia).getDay();
  if (diaDaSemana === 0) return null;
  return diaDaSemana === 6 ? HORARIO_SABADO : HORARIO_SEMANA;
}

// True when the business attends on the given ISO date (i.e. not a Sunday).
export function isDiaUtil(iso: string): boolean {
  return faixaHorarioDoDia(iso) !== null;
}

// True when `hora` (HH:MM) falls within the bookable range for `dataIso`.
export function isHorarioValido(hora: string, dataIso: string): boolean {
  if (!/^\d{2}:\d{2}$/.test(hora)) return false;
  const faixa = faixaHorarioDoDia(dataIso);
  return faixa !== null && hora >= faixa.min && hora <= faixa.max;
}
