import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { loadConfig, ping, startPinging } from "./index.ts";

describe("configuration", () => {
    test("uses the existing defaults", () => {
        expect(loadConfig({ URL: "https://example.com/" })).toEqual({
            url: "https://example.com/",
            delay: 60_000,
            enableLog: false,
            method: "HEAD",
        });
    });

    test("reads the existing environment variables", () => {
        expect(loadConfig({
            URL: "https://example.com/ping",
            DELAY: "30000",
            ENABLE_LOG: "TrUe",
            METHOD: "get",
        })).toEqual({
            url: "https://example.com/ping",
            delay: 30_000,
            enableLog: true,
            method: "GET",
        });
    });

    test("treats empty optional values as defaults", () => {
        expect(loadConfig({
            URL: "https://example.com/",
            DELAY: "",
            ENABLE_LOG: "",
            METHOD: "",
        })).toEqual(loadConfig({ URL: "https://example.com/" }));
    });

    test("only enables response logging for true", () => {
        expect(loadConfig({ URL: "https://example.com/", ENABLE_LOG: "false" }).enableLog).toBe(false);
        expect(loadConfig({ URL: "https://example.com/", ENABLE_LOG: "1" }).enableLog).toBe(false);
    });

    test("requires a URL", () => {
        expect(() => loadConfig({})).toThrow('"URL" environment variable is required.');
    });

    test.each(["not a URL", "ftp://example.com/", "file:///etc/hosts"])("rejects URL %s", (url) => {
        expect(() => loadConfig({ URL: url })).toThrow('"URL" must be a valid HTTP or HTTPS URL.');
    });

    test.each(["0", "-1", "NaN", "Infinity", "abc", "1.5", "2147483648"])("rejects delay %s", (delay) => {
        expect(() => loadConfig({ URL: "https://example.com/", DELAY: delay })).toThrow('"DELAY"');
    });

    test.each(["bad method", "CONNECT", "TRACE", "TRACK"])("rejects method %s", (method) => {
        expect(() => loadConfig({ URL: "https://example.com/", METHOD: method })).toThrow('"METHOD"');
    });
});

test("the CLI reports invalid configuration with a timestamp and exit code 9", async () => {
    const child = Bun.spawn([process.execPath, `${import.meta.dir}/index.ts`], {
        env: { ...Bun.env, URL: "" },
        stdout: "pipe",
        stderr: "pipe",
    });
    const [exitCode, stderr] = await Promise.all([
        child.exited,
        new Response(child.stderr).text(),
    ]);

    expect(exitCode).toBe(9);
    expect(stderr).toMatch(/^\[\d{2}\.\d{2}\.\d{4}\]\[\d{2}:\d{2}:\d{2}\] "URL" environment variable is required\./);
});

describe("requests", () => {
    let server: ReturnType<typeof Bun.serve>;
    let requests: { method: string; userAgent: string | null }[];
    let output: {
        log: ReturnType<typeof mock<(message: string) => void>>;
        error: ReturnType<typeof mock<(message: string) => void>>;
    };

    beforeEach(() => {
        requests = [];
        output = {
            log: mock<(message: string) => void>(() => {}),
            error: mock<(message: string) => void>(() => {}),
        };
        server = Bun.serve({
            hostname: "127.0.0.1",
            port: 0,
            fetch(request) {
                requests.push({
                    method: request.method,
                    userAgent: request.headers.get("user-agent"),
                });
                switch (new URL(request.url).pathname) {
                    case "/error":
                        return new Response("Unavailable", { status: 503 });
                    case "/redirect":
                        return Response.redirect(new URL("/", request.url).href);
                    default:
                        return new Response("OK");
                }
            },
        });
    });

    afterEach(async () => {
        await server.stop(true);
    });

    test("sends HEAD requests with the existing user agent and no success log by default", async () => {
        await ping(loadConfig({ URL: server.url.href }), output);

        expect(requests).toHaveLength(1);
        expect(requests[0]?.method).toBe("HEAD");
        expect(requests[0]?.userAgent).toContain("ChokunPlayZ WebPing");
        expect(output.log).not.toHaveBeenCalled();
        expect(output.error).not.toHaveBeenCalled();
    });

    test("supports GET and logs a numeric response time", async () => {
        await ping(loadConfig({
            URL: server.url.href,
            METHOD: "GET",
            ENABLE_LOG: "true",
        }), output);

        expect(requests[0]?.method).toBe("GET");
        expect(output.log).toHaveBeenCalledWith(expect.stringMatching(/^Response time: \d+\.\d{3} seconds$/));
        expect(output.error).not.toHaveBeenCalled();
    });

    test("follows redirects", async () => {
        await ping(loadConfig({ URL: new URL("/redirect", server.url).href }), output);

        expect(requests).toHaveLength(2);
        expect(output.error).not.toHaveBeenCalled();
    });

    test("reports HTTP failures even when response logging is disabled", async () => {
        await ping(loadConfig({ URL: new URL("/error", server.url).href }), output);

        expect(output.error).toHaveBeenCalledWith(expect.stringContaining("HTTP 503"));
        expect(output.log).not.toHaveBeenCalled();
    });

    test("reports network failures without rejecting", async () => {
        const url = server.url.href;
        await server.stop(true);

        await expect(ping(loadConfig({ URL: url }), output)).resolves.toBeUndefined();
        expect(output.error).toHaveBeenCalledWith(expect.stringContaining("Request failed:"));
    });

    test("pings immediately and repeats after failures", async () => {
        const completed = Promise.withResolvers<void>();
        let failures = 0;
        output.error.mockImplementation(() => {
            if (++failures === 2) {
                completed.resolve();
            }
        });
        const stop = startPinging(loadConfig({
            URL: new URL("/error", server.url).href,
            DELAY: "20",
        }), output);

        try {
            await completed.promise;
            expect(requests.length).toBeGreaterThanOrEqual(2);
            expect(output.error).toHaveBeenCalled();
        } finally {
            stop();
        }
    });
});
