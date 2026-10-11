/** Texto de um campo do formulário, ou "" se faltar (ou for um arquivo). */
export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Primeira letra maiúscula: as mensagens da API vêm em minúsculas ("must be 3 to 32…"). */
export function sentence(message: string): string {
  return message.charAt(0).toUpperCase() + message.slice(1);
}
