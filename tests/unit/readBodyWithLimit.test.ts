import { describe, expect, it } from "vitest";

import { readBodyWithLimit } from "@/lib/http/readBodyWithLimit";

const URL_UNDER_TEST = "https://honyb.example/api/inquiries";

describe("readBodyWithLimit", () => {
  it("returns the body when it is within the limit", async () => {
    const request = new Request(URL_UNDER_TEST, { method: "POST", body: "hello" });
    expect(await readBodyWithLimit(request, 100)).toBe("hello");
  });

  it("returns an empty string when there is no body", async () => {
    const request = new Request(URL_UNDER_TEST, { method: "GET" });
    expect(await readBodyWithLimit(request, 100)).toBe("");
  });

  it("refuses a body whose declared length is over the limit, without reading it", async () => {
    const request = new Request(URL_UNDER_TEST, { method: "POST", body: "x".repeat(50) });
    expect(await readBodyWithLimit(request, 10)).toBeNull();
  });

  it("refuses a streamed body that grows past the limit, when no length is declared", async () => {
    const chunk = new TextEncoder().encode("x".repeat(8));
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(chunk);
        controller.enqueue(chunk);
        controller.close();
      },
    });
    const request = new Request(URL_UNDER_TEST, { method: "POST", body: stream, duplex: "half" } as RequestInit);
    expect(await readBodyWithLimit(request, 10)).toBeNull();
  });
});
