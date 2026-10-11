import { useSignal } from "@preact/signals";
import { useEffect } from "preact/hooks";

interface Props {
  label: string;
  /** Texto enquanto o formulário é enviado: "Placing order…", "Paying…". */
  pendingLabel: string;
  variant?: "primary" | "secondary" | "danger";
  block?: boolean;
  /** `id` de um texto que explica o botão (ex.: por que ele está desabilitado). */
  describedBy?: string;
}

/**
 * Botão de envio com estado de carregamento: no primeiro clique mostra o texto e o
 * spinner e passa a ignorar cliques repetidos, para um duplo clique não mandar a ação duas
 * vezes (e a segunda resposta não virar um 409 confuso depois de dar certo). Sem JavaScript
 * é um botão de envio comum e o formulário funciona do mesmo jeito.
 */
export default function PendingButton(
  { label, pendingLabel, variant = "primary", block, describedBy }: Props,
) {
  const pending = useSignal(false);

  // Voltar com o botão do navegador pode restaurar a página já "carregando": destrava.
  useEffect(() => {
    const reset = () => (pending.value = false);
    addEventListener("pageshow", reset);
    return () => removeEventListener("pageshow", reset);
  }, []);

  return (
    <button
      type="submit"
      class={`rs-btn rs-btn--${variant} ${block ? "rs-btn--block" : ""}`}
      aria-busy={pending.value ? "true" : undefined}
      aria-describedby={describedBy}
      onClick={(event) => {
        if (pending.value) return event.preventDefault();
        // Só marca como carregando se o formulário vai mesmo ser enviado.
        if (event.currentTarget.form?.checkValidity() !== false) {
          pending
            .value = true;
        }
      }}
    >
      {pending.value && <span class="rs-spinner" aria-hidden="true" />}
      {pending.value ? pendingLabel : label}
    </button>
  );
}
