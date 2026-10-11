/** Erros de formulário: campo -> mensagem. Vazio quando está tudo certo. */
export type FormErrors = Record<string, string>;

const USERNAME_CHARS = /^[A-Za-z0-9._-]+$/;

/** `YYYY-MM-DD` e uma data que existe de verdade (nada de 2026-02-31). */
export function isRealDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [year, month, day] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

export function validateUsername(value: string): string | undefined {
  if (value.length < 3 || value.length > 32) return "Must be 3–32 characters";
  if (!USERNAME_CHARS.test(value)) {
    return 'May only contain letters, numbers, ".", "-" and "_"';
  }
}

export function validatePassword(value: string): string | undefined {
  const length = [...value].length;
  if (length < 8) return `Must be 8–128 characters (${length} now)`;
  if (length > 128) return `Must be 8–128 characters (${length} now)`;
}

function validateName(value: string): string | undefined {
  if (value.trim() === "") return "Required";
  if ([...value].length > 100) return "At most 100 characters";
}

export function validateBirthday(
  value: string,
  today = new Date(),
): string | undefined {
  if (value === "") return "Required";
  if (!isRealDate(value)) return "Use the format YYYY-MM-DD";
  if (value > today.toISOString().slice(0, 10)) return "Can't be in the future";
}

export interface ProfileFields {
  first_name: string;
  last_name: string;
  birthday: string;
}

export function validateProfile(
  fields: ProfileFields,
  today = new Date(),
): FormErrors {
  const errors: FormErrors = {};
  const first = validateName(fields.first_name);
  const last = validateName(fields.last_name);
  const birthday = validateBirthday(fields.birthday, today);
  if (first) errors.first_name = first;
  if (last) errors.last_name = last;
  if (birthday) errors.birthday = birthday;
  return errors;
}

export interface SignUpFields extends ProfileFields {
  username: string;
  password: string;
}

/** Espelha as regras da API, para o cadastro dar erro por campo antes de ir para ela. */
export function validateSignUp(
  fields: SignUpFields,
  today = new Date(),
): FormErrors {
  const errors: FormErrors = {};
  const username = validateUsername(fields.username);
  const password = validatePassword(fields.password);
  if (username) errors.username = username;
  if (password) errors.password = password;
  return { ...errors, ...validateProfile(fields, today) };
}
