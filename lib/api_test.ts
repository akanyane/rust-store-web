import { assertEquals, assertRejects } from "@std/assert";
import {
  ApiError,
  ApiUnavailableError,
  apiUrl,
  DEFAULT_API_URL,
  getProduct,
  listProducts,
  parseFieldErrors,
} from "./api.ts";

/** Troca o `fetch` global por um dublê durante o teste e registra as URLs pedidas. */
async function withFetch(
  respond: (url: string) => Response | Promise<Response>,
  run: (requested: string[]) => Promise<void>,
) {
  const original = globalThis.fetch;
  const requested: string[] = [];
  globalThis.fetch = ((input: Request | URL | string) => {
    const url = String(input);
    requested.push(url);
    return Promise.resolve(respond(url));
  }) as typeof fetch;
  Deno.env.set("API_URL", "http://api.test");
  try {
    await run(requested);
  } finally {
    globalThis.fetch = original;
    Deno.env.delete("API_URL");
  }
}

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", ...init.headers },
    status: init.status,
  });

Deno.test("parseFieldErrors: 'field: message; other: message'", () => {
  assertEquals(
    parseFieldErrors(
      "username: must be 3 to 32 characters; password: too short",
    ),
    {
      username: "must be 3 to 32 characters",
      password: "too short",
    },
  );
  // A mensagem pode ter ": " depois do primeiro (só o primeiro separa o campo).
  assertEquals(parseFieldErrors("limit: must be between 1 and 200"), {
    limit: "must be between 1 and 200",
  });
  assertEquals(parseFieldErrors("a: x: y"), { a: "x: y" });
  // Mensagens gerais, sem campo, não viram campo.
  assertEquals(parseFieldErrors("Invalid request body"), {});
  assertEquals(parseFieldErrors(""), {});
});

Deno.test("apiUrl: env var, trailing slash removed, default", () => {
  Deno.env.delete("API_URL");
  assertEquals(apiUrl(), DEFAULT_API_URL);
  Deno.env.set("API_URL", "http://example.test:9000///");
  assertEquals(apiUrl(), "http://example.test:9000");
  Deno.env.delete("API_URL");
});

Deno.test("listProducts: query string and X-Total-Count", async () => {
  await withFetch(
    () =>
      json([{ id: "a", name: "Mug" }], { headers: { "x-total-count": "57" } }),
    async (requested) => {
      const page = await listProducts({
        sort: "newest",
        limit: 12,
        offset: 24,
      });
      assertEquals(page.total, 57);
      assertEquals(page.products.length, 1);
      assertEquals(requested, [
        "http://api.test/products?sort=newest&limit=12&offset=24",
      ]);
    },
  );
  await withFetch(() => json([]), async (requested) => {
    assertEquals((await listProducts()).total, 0);
    assertEquals(requested, ["http://api.test/products"]);
  });
});

Deno.test("listProducts: a missing or invalid X-Total-Count falls back to the list size", async () => {
  await withFetch(() => json([{}, {}, {}]), async () => {
    assertEquals((await listProducts()).total, 3);
  });
  await withFetch(
    () => json([{}, {}], { headers: { "x-total-count": "many" } }),
    async () => {
      assertEquals((await listProducts()).total, 2);
    },
  );
});

Deno.test("listProducts: 422 becomes ApiError with fields; 5xx and network become unavailable", async () => {
  await withFetch(
    () => json({ error: "limit: must be between 1 and 200" }, { status: 422 }),
    async () => {
      const error = await assertRejects(
        () => listProducts({ limit: 0 }),
        ApiError,
      );
      assertEquals(error.status, 422);
      assertEquals(error.fields, { limit: "must be between 1 and 200" });
    },
  );
  await withFetch(
    () => json({ error: "Internal error" }, { status: 500 }),
    async () => {
      await assertRejects(() => listProducts(), ApiUnavailableError);
    },
  );
  await withFetch(() => {
    throw new TypeError("connection refused");
  }, async () => {
    await assertRejects(() => listProducts(), ApiUnavailableError);
  });
  await withFetch(() => new Response("not json", { status: 502 }), async () => {
    await assertRejects(() => listProducts(), ApiUnavailableError);
  });
});

Deno.test("getProduct: found, 404 is null, id is URL-encoded, other errors propagate", async () => {
  await withFetch(
    () => json({ id: "x", name: "Mug", variants: [] }),
    async (requested) => {
      assertEquals((await getProduct("a/b c"))?.name, "Mug");
      assertEquals(requested, ["http://api.test/products/a%2Fb%20c"]);
    },
  );
  await withFetch(
    () => json({ error: "Resource not found" }, { status: 404 }),
    async () => {
      assertEquals(await getProduct("nope"), null);
    },
  );
  await withFetch(
    () => json({ error: "Internal error" }, { status: 500 }),
    async () => {
      await assertRejects(() => getProduct("x"), ApiUnavailableError);
    },
  );
});
