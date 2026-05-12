import { useEffect, useState } from "react";
import { Header } from "./components/Header";
import { DemoBanner } from "./components/DemoBanner";
import { ProductGrid } from "./components/ProductGrid";
import { Cart } from "./components/Cart";
import { ToolActivityLog } from "./components/ToolActivityLog";
import { ensureWebMCP, type WebMCPMode } from "./lib/polyfill";
import { registerTools } from "./lib/webmcp";

export default function App() {
  const [connection, setConnection] = useState<WebMCPMode>("unavailable");

  useEffect(() => {
    ensureWebMCP().then((mode) => {
      setConnection(mode);
      if (mode !== "unavailable") registerTools();
    });
  }, []);

  return (
    <div className="min-h-screen">
      <Header connection={connection} />
      <DemoBanner />
      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 p-4">
        <ProductGrid />
        <Cart />
      </main>
      <ToolActivityLog />
    </div>
  );
}
