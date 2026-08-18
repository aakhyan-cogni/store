import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { describe, expect, it } from "vitest";
import { Parser } from "../src/lib/structures/Parser.js";

function fakeRequest(options: { url?: string; contentType?: string; chunks?: string[] }) {
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
