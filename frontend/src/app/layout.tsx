"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import "@mysten/dapp-kit/dist/index.css";
import { NETWORK } from "@/lib/config";

const queryClient = new QueryClient();
const networks = { testnet: { url: getFullnodeUrl("testnet") } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>Mercenary Contract Exchange</title>
        <meta name="description" content="A programmable war economy for EVE Frontier" />
        <style>{`
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            background: #050a12;
            color: #e0eaf8;
            font-family: 'Segoe UI', system-ui, sans-serif;
            min-height: 100vh;
          }
          ::-webkit-scrollbar { width: 6px; }
          ::-webkit-scrollbar-track { background: #0a1520; }
          ::-webkit-scrollbar-thumb { background: #1a3050; border-radius: 3px; }
        `}</style>
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <SuiClientProvider networks={networks} defaultNetwork={NETWORK as "testnet"}>
            <WalletProvider autoConnect>
              {children}
            </WalletProvider>
          </SuiClientProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
