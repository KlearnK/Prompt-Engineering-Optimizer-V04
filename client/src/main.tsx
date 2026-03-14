import './i18n/config';
import { trpc } from "@/lib/trpc";
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";
import { ModelConfigProvider } from "./contexts/ModelConfigContext";
import i18n from "./i18n/config";

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  window.location.href = getLoginUrl();
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

function getModelConfigHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem("modelConfig");
    if (raw) {
      const cfg = JSON.parse(raw);
      const modelId = cfg.model || cfg.modelId;
      if (cfg.apiKey && cfg.provider && modelId) {
        return {
          "x-model-provider": cfg.provider,
          "x-model-id": modelId,
          "x-api-key": cfg.apiKey,
        };
      }
    }
  } catch {
    // ignore
  }
  return {};
}

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        const modelHeaders = getModelConfigHeaders();
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          headers: {
            ...(init?.headers ?? {}),
            ...modelHeaders,
            "x-ui-language": i18n.language || "zh",
          },
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <ModelConfigProvider>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </ModelConfigProvider>
);