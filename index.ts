export interface Config {
    url: string;
    delay: number;
    enableLog: boolean;
    method: string;
}

interface Logger {
    log(message: string): void;
    error(message: string): void;
}

const userAgent = "Mozilla/5.0 (compatible; ChokunPlayZ WebPing/2.0; https://github.com/ChokunPlayZ/njs-webping/)";

function timestamp(): string {
    const now = new Date();
    const pad = (value: number) => String(value).padStart(2, "0");
    const date = `${pad(now.getDate())}.${pad(now.getMonth() + 1)}.${now.getFullYear()}`;
    const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    return `[${date}][${time}]`;
}

const logger: Logger = {
    log: (message) => console.log(`${timestamp()} ${message}`),
    error: (message) => console.error(`${timestamp()} ${message}`),
};

export function loadConfig(env: Record<string, string | undefined> = Bun.env): Config {
    if (!env.URL) {
        throw new Error('"URL" environment variable is required.');
    }

    let url: URL;
    try {
        url = new URL(env.URL);
    } catch {
        throw new Error('"URL" must be a valid HTTP or HTTPS URL.');
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new Error('"URL" must be a valid HTTP or HTTPS URL.');
    }

    const delay = env.DELAY ? Number(env.DELAY) : 60_000;
    if (!Number.isInteger(delay) || delay <= 0 || delay > 2_147_483_647) {
        throw new Error('"DELAY" must be an integer between 1 and 2147483647 milliseconds.');
    }

    const method = (env.METHOD || "HEAD").toUpperCase();
    if (!/^[!#$%&'*+.^_`|~0-9A-Z-]+$/.test(method) || ["CONNECT", "TRACE", "TRACK"].includes(method)) {
        throw new Error('"METHOD" must be an HTTP method supported by fetch.');
    }

    return {
        url: url.href,
        delay,
        enableLog: env.ENABLE_LOG?.toLowerCase() === "true",
        method,
    };
}

export async function ping(config: Config, output: Logger = logger): Promise<void> {
    const startTime = performance.now();

    try {
        const response = await fetch(config.url, {
            method: config.method,
            headers: { "User-Agent": userAgent },
        });

        // Drain the body without buffering it, allowing the connection to be reused.
        if (response.body) {
            for await (const chunk of response.body) {
                void chunk;
            }
        }

        if (!response.ok) {
            throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
        }

        if (config.enableLog) {
            const responseTime = ((performance.now() - startTime) / 1000).toFixed(3);
            output.log(`Response time: ${responseTime} seconds`);
        }
    } catch (error) {
        output.error(`Request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function startPinging(config: Config, output: Logger = logger): () => void {
    void ping(config, output);
    const timer = setInterval(() => void ping(config, output), config.delay);
    return () => clearInterval(timer);
}

if (import.meta.main) {
    try {
        const config = loadConfig();

        logger.log("---------------------------");
        logger.log(`WebPing (Bun ${Bun.version})`);
        logger.log("Written By: Chokun Rojanapron");
        logger.log("https://github.com/ChokunPlayZ/");
        logger.log("---------------------------");
        logger.log(`Ping URL: ${config.url}`);
        logger.log(`Ping Delay: ${config.delay} (ms)`);
        logger.log(`HTTP Method: ${config.method}`);
        logger.log(`Request Logging: ${config.enableLog}`);
        logger.log(`System Timezone: ${Intl.DateTimeFormat().resolvedOptions().timeZone}`);
        logger.log("---------------------------");
        logger.log("Sending first request");

        startPinging(config);
    } catch (error) {
        logger.error(error instanceof Error ? error.message : String(error));
        process.exit(9);
    }
}
