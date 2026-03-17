"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import "@mysten/dapp-kit/dist/index.css";
import "./globals.css";
import { NETWORK } from "@/lib/config";
import { walletTheme } from "@/lib/wallet-theme";

const queryClient = new QueryClient();
const networks = { testnet: { url: getFullnodeUrl("testnet") } };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <title>MCE — Mercenary Contract Exchange</title>
        <meta name="description" content="A programmable war economy for EVE Frontier" />
      </head>
      <body>
        <QueryClientProvider client={queryClient}>
          <SuiClientProvider networks={networks} defaultNetwork={NETWORK as "testnet"}>
            <WalletProvider autoConnect theme={walletTheme}>
              {children}
            </WalletProvider>
          </SuiClientProvider>
        </QueryClientProvider>
      </body>
    </html>
  );
}
