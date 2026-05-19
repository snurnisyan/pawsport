import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { ChakraProvider } from "@chakra-ui/react";
import { theme } from "@/theme/theme";
import { QueryProvider } from "@/lib/queryClient";
import { AuthSessionBootstrap } from "@/lib/session";
import { AppToaster } from "@/components/ui/toaster";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider value={theme}>
      <QueryProvider>
        <AuthSessionBootstrap />
        <Head>
          <meta name="viewport" content="width=device-width, initial-scale=1" />
        </Head>
        <Component {...pageProps} />
        <AppToaster />
      </QueryProvider>
    </ChakraProvider>
  );
}
