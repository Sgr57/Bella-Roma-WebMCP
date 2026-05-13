export interface SuggestedPrompt {
  id: string;
  text: string;
}

export const TOP_PROMPTS: SuggestedPrompt[] = [
  { id: "S1", text: "Qualcosa di leggero e fruttato, senza latte, sotto i 4 euro" },
  { id: "S2", text: "Sto prendendo un cappuccino, abbinaci qualcosa di dolce ma non pesante" },
  { id: "S3", text: "Vorrei un cappuccino con latte di soia" },
  { id: "S4", text: "Componi un ordine colazione per 3 persone, max 15 euro, uno deve essere decaffeinato" },
  { id: "S5", text: "Mi è piaciuto il Filtro Etiopia, voglio portarmene a casa 250g" },
  { id: "S6", text: "Cappuccino grande con latte d'avena, senza zucchero" },
  { id: "S8", text: "Cosa va bene con quello che ho già nel carrello?" },
];

export const CART_EMPTY_PROMPT_IDS = ["S1", "S4", "S6"] as const;

export function getPromptsByIds(ids: readonly string[]): SuggestedPrompt[] {
  return ids
    .map((id) => TOP_PROMPTS.find((p) => p.id === id))
    .filter((p): p is SuggestedPrompt => Boolean(p));
}
