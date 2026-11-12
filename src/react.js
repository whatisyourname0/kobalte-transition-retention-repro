import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import "./main.js";

const client = new QueryClient();
function SampleQuery() {
  const query = useQuery({ queryKey: ["sample"], queryFn: async () => ({ value: 1 }), staleTime: Infinity });
  return React.createElement("output", null, query.isSuccess ? "Sample query ready" : "Loading sample query");
}
createRoot(document.getElementById("react-root")).render(
  React.createElement(QueryClientProvider, { client },
    React.createElement(SampleQuery),
    React.createElement(ReactQueryDevtools, { initialIsOpen: true }),
  ),
);
