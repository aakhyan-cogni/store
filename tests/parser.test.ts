import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { Parser } from "../src/lib/structures/Parser.js";

function fakeRequest(options: { url?: string; contentType?: string; chunks?: (string | Buffer)[] }) {
	const req = new EventEmitter() as EventEmitter & IncomingMessage;
	req.url = options.url ?? "/";
	req.headers = options.contentType ? { "content-type": options.contentType } : {};
	req.destroy = () => req;

	queueMicrotask(() => {
		for (const chunk of options.chunks ?? []) req.emit("data", Buffer.from(chunk));
		req.emit("end");
	});

	return req;
}

describe("Parser.parseBody", () => {
	it("parses a valid JSON body", async () => {
		const req = fakeRequest({ contentType: "application/json", chunks: [JSON.stringify({ a: 1 })] });
		await expect(Parser.parseBody(req)).resolves.toEqual({ a: 1 });
	});

	it("parses JSON when the content-type carries a charset parameter", async () => {
		const req = fakeRequest({
			contentType: "application/json; charset=utf-8",
			chunks: [JSON.stringify({ ok: true })],
		});
		await expect(Parser.parseBody(req)).resolves.toEqual({ ok: true });
	});

	it("returns the raw string for non-JSON content types", async () => {
		const req = fakeRequest({ contentType: "text/plain", chunks: ["hello world"] });
		await expect(Parser.parseBody(req)).resolves.toBe("hello world");
	});

	it("rejects when content-type is missing", async () => {
		const req = fakeRequest({ chunks: ["irrelevant"] });
		await expect(Parser.parseBody(req)).rejects.toThrow("No Content Type defined");
	});

	it("resolves undefined for an empty JSON body", async () => {
		const req = fakeRequest({ contentType: "application/json", chunks: [] });
		await expect(Parser.parseBody(req)).resolves.toBeUndefined();
	});

	it("rejects on malformed JSON", async () => {
		const req = fakeRequest({ contentType: "application/json", chunks: ["{not valid json"] });
		await expect(Parser.parseBody(req)).rejects.toBeInstanceOf(SyntaxError);
	});

	it("rejects when the body exceeds the size limit", async () => {
		const req = fakeRequest({ contentType: "application/json", chunks: ["a".repeat(1024 * 1024 + 1)] });
		await expect(Parser.parseBody(req)).rejects.toThrow("Request body too large");
	});

	it("rejects when the underlying request errors", async () => {
		const req = fakeRequest({ contentType: "application/json" });
		const promise = Parser.parseBody(req);
		req.emit("error", new Error("socket hang up"));
		await expect(promise).rejects.toThrow("socket hang up");
	});
});

describe("Parser.parseBody across chunk boundaries", () => {
	it("decodes a multi-byte character split between two chunks", async () => {
		// What a TCP boundary does to real traffic: decoding each chunk on its
		// own turns the split character into two replacement characters, and
		// which requests break depends on packet timing.
		const payload = Buffer.from(JSON.stringify({ name: "Café Münster 😀" }), "utf8");
		const split = payload.indexOf(Buffer.from("é", "utf8")) + 1;

		const req = fakeRequest({
			contentType: "application/json",
			chunks: [payload.subarray(0, split), payload.subarray(split)],
		});

		await expect(Parser.parseBody(req)).resolves.toEqual({ name: "Café Münster 😀" });
	});

	it("decodes a body split one byte at a time", async () => {
		const payload = Buffer.from(JSON.stringify({ q: "日本語" }), "utf8");
		const chunks = Array.from(payload, (byte) => Buffer.of(byte));

		const req = fakeRequest({ contentType: "application/json", chunks });
		await expect(Parser.parseBody(req)).resolves.toEqual({ q: "日本語" });
	});
});

describe("Parser.parseURL", () => {
	it("parses query params from the request URL", () => {
		const req = fakeRequest({ url: "/products/1?foo=bar&baz=qux" });
		const query = Parser.parseURL(req);
		expect(query.get("foo")).toBe("bar");
		expect(query.get("baz")).toBe("qux");
	});

	it("falls back to localhost when HOST is not set", () => {
		const req = fakeRequest({ url: "/?x=1" });
		const query = Parser.parseURL(req);
		expect(query.get("x")).toBe("1");
	});
});

describe("Parser.parseBody with no body at all", () => {
	it("resolves undefined when there is no body and no content-type", async () => {
		// A bodyless POST — checkout, for one — has nothing to interpret, so a
		// missing content-type is not an error.
		const req = fakeRequest({ chunks: [] });
		await expect(Parser.parseBody(req)).resolves.toBeUndefined();
	});

	it("still rejects a body sent without a content-type", async () => {
		const req = fakeRequest({ chunks: ["{}"] });
		await expect(Parser.parseBody(req)).rejects.toThrow("No Content Type defined");
	});
});
