/**
 * Mensagem de uma só vez, que sobrevive a um redirecionamento (POST → 303 → GET): vai num
 * cookie curto, é lida e apagada na página seguinte. Funciona sem JavaScript.
 */
export interface Flash {
  /** Onde a mensagem aparece: "account", "cart", ou "add:<variantId>" na página de produto. */
  scope: string;
  tone: "success" | "error";
  message: string;
  /** Quantidade adicionada, para a mensagem "2 × 50 g tin" (só no "add:"). */
  quantity?: number;
}

export function serializeFlash(flash: Flash): string {
  return encodeURIComponent(JSON.stringify(flash));
}

/** Lê o cookie de flash; qualquer coisa que não tenha o formato esperado é descartada. */
export function parseFlash(value: string | undefined): Flash | undefined {
  if (!value) return undefined;
  try {
    const data = JSON.parse(decodeURIComponent(value));
    if (
      typeof data?.scope === "string" &&
      (data.tone === "success" || data.tone === "error") &&
      typeof data.message === "string" &&
      (data.quantity === undefined || Number.isInteger(data.quantity))
    ) {
      return {
        scope: data.scope,
        tone: data.tone,
        message: data.message,
        quantity: data.quantity,
      };
    }
  } catch {
    // Cookie adulterado ou cortado: ignora.
  }
  return undefined;
}
