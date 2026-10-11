/** Texto de um campo do formulário, ou "" se faltar (ou for um arquivo). */
export function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value : "";
}

/** Primeira letra maiúscula: as mensagens da API vêm em minúsculas ("must be 3 to 32…"). */
export function sentence(message: string): string {
  return message.charAt(0).toUpperCase() + message.slice(1);
}

/**
 * Erros de campo de um 422 da API (`campo: mensagem`), com a primeira letra maiúscula. Sem
 * nenhum campo na mensagem, o texto inteiro vai para `fallbackField`.
 */
export function fieldErrorsFrom(
  error: { fields: Record<string, string>; message: string },
  fallbackField: string,
): Record<string, string> {
  const fields = Object.fromEntries(
    Object.entries(error.fields).map((
      [name, message],
    ) => [name, sentence(message)]),
  );
  return Object.keys(fields).length > 0
    ? fields
    : { [fallbackField]: sentence(error.message) };
}
