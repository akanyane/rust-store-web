import { HttpError, type PageProps } from "fresh";
import { Head } from "fresh/runtime";
import { StatePanel } from "../components/StatePanel.tsx";

export default function ErrorPage(props: PageProps) {
  const status = props.error instanceof HttpError ? props.error.status : 500;

  if (status === 503) {
    return (
      <>
        <Head>
          <title>Store unavailable · Rust Store</title>
        </Head>
        <StatePanel
          title="We couldn't reach the store"
          tone="danger"
          action={{
            href: props.url.pathname + props.url.search,
            label: "Try again",
          }}
        >
          The store didn't respond. Your cart is unaffected.
        </StatePanel>
      </>
    );
  }

  if (status === 404) {
    return (
      <>
        <Head>
          <title>Not found · Rust Store</title>
        </Head>
        <StatePanel
          title="We can't find that page"
          code="404 · Not found"
          action={{ href: "/", label: "Back to the catalog" }}
        >
          The product or order may not exist, or the link is wrong.
        </StatePanel>
      </>
    );
  }
  if (status === 403) {
    return (
      <>
        <Head>
          <title>Not allowed · Rust Store</title>
        </Head>
        <StatePanel
          title="You don't have access to this"
          code="403 · Not allowed"
          action={{ href: "/", label: "Back to the catalog" }}
        >
          This page belongs to another account or to store staff.
        </StatePanel>
      </>
    );
  }
  return (
    <>
      <Head>
        <title>Something went wrong · Rust Store</title>
      </Head>
      <StatePanel
        title="Something went wrong"
        tone="danger"
        code={`${status}`}
        action={{ href: "/", label: "Back to the catalog" }}
      >
        We couldn't show this page. Try again in a moment.
      </StatePanel>
    </>
  );
}
