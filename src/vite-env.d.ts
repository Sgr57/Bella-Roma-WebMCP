/// <reference types="vite/client" />

declare global {
  interface ModelContextTool {
    name: string;
    description: string;
    inputSchema: object;
    execute: (
      args: Record<string, unknown>,
      agent: {
        requestUserInteraction: <T>(fn: () => Promise<T> | T) => Promise<T>;
      }
    ) => Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }>;
  }

  interface ModelContext {
    provideContext: (config: { tools: ModelContextTool[] }) => void;
    registerTool?: (tool: ModelContextTool) => void;
    unregisterTool?: (name: string) => void;
  }

  interface Navigator {
    modelContext?: ModelContext;
  }
}

export {};
