import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { DemoBanner } from "./components/DemoBanner";
import { Hero } from "./components/Hero";
import { ProductGrid } from "./components/ProductGrid";
import { Cart } from "./components/Cart";
import { ToolActivityLog } from "./components/ToolActivityLog";
import { CheckoutModal } from "./components/CheckoutModal";
import { Footer } from "./components/Footer";
import { ensureWebMCP, type WebMCPMode } from "./lib/polyfill";
import { registerTools } from "./lib/webmcp";
import {
  connectRelay,
  isRelayEnabled,
  type RelayVariant,
} from "./lib/relay";
import { onRelayState, type RelayState } from "./lib/relay-client";

export default function App() {
  const [connection, setConnection] = useState<WebMCPMode>("unavailable");
  const [relayVariant, setRelayVariant] = useState<RelayVariant>("off");
  const [relayState, setRelayState] = useState<RelayState>("idle");
  const relay = isRelayEnabled();

  useEffect(() => {
    let stopFn: (() => void) | undefined;
    let cancelled = false;
    (async () => {
      const mode = await ensureWebMCP();
      if (cancelled) return;
      setConnection(mode);
      if (mode !== "unavailable") await registerTools();
      if (relay) {
        const { variant, stop } = await connectRelay(mode);
        if (cancelled) {
          stop();
          return;
        }
        setRelayVariant(variant);
        stopFn = stop;
      }
    })();
    const unsub = onRelayState(setRelayState);
    return () => {
      cancelled = true;
      stopFn?.();
      unsub();
    };
  }, [relay]);

  return (
    <div className="min-h-screen">
      <Header
        connection={connection}
        relay={relay}
        relayVariant={relayVariant}
        relayState={relayState}
      />
      <Hero />
      <DemoBanner />
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6 p-4">
        <ProductGrid />
        <Cart />
      </main>
      <Footer />
      <ToolActivityLog />
      <CheckoutModal />
    </div>
  );
}
