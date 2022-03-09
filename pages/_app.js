import Head from "next/head";
import { Provider } from "react-redux";
import store from "../src/store/index";
import { ToneContextProvider } from "../src/store/tone-context";

export default function MyApp(props) {
  const { Component, pageProps } = props;

  return (
    <>
      <Head>
        <title>Boomcat</title>
        <meta
          name="viewport"
          content="minimum-scale=1, initial-scale=1, width=device-width"
        />
      </Head>

      <Provider store={store}>
        <ToneContextProvider>
          <Component {...pageProps} />
        </ToneContextProvider>
      </Provider>
    </>
  );
}
