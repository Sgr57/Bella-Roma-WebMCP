type Listener = (total: number, resolve: (ok: boolean) => void) => void;

let listener: Listener | null = null;

export function setCheckoutListener(fn: Listener | null) {
  listener = fn;
}

export function requestCheckoutConfirmation(total: number): Promise<boolean> {
  if (!listener) {
    return Promise.resolve(
      window.confirm(`Vuoi confermare il pagamento di €${total.toFixed(2)}?`)
    );
  }
  return new Promise<boolean>((resolve) => {
    listener!(total, resolve);
  });
}
