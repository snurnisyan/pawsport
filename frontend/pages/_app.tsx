import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Head from "next/head";
import { ChakraProvider } from "@chakra-ui/react";
import { system } from "@/theme/system";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider value={system}>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <Component {...pageProps} />
    </ChakraProvider>
  );
}
