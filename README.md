# NJS-Webping

[![Build](https://github.com/ChokunPlayZ/njs-webping/actions/workflows/release.yml/badge.svg)](https://github.com/ChokunPlayZ/njs-webping/actions/workflows/release.yml)

A small Bun-native TypeScript service that pings a website at a fixed interval.
It uses built-in `fetch` and timestamped console logging, with no runtime dependencies or build step.

## Run with Bun

Install [Bun](https://bun.sh/) 1.3 or newer, then run:

```sh
URL=https://example.com/ bun run start
```

The first request is sent immediately. Requests repeat every `DELAY` milliseconds,
even if a previous request is still in flight. HTTP and network errors are always
logged; successful response times are logged only when `ENABLE_LOG=true`.

Bun also loads environment variables from a local `.env` file automatically.

### Configuration

| Variable | Default | Description |
| --- | --- | --- |
| `URL` | Required | The HTTP or HTTPS URL to ping. |
| `DELAY` | `60000` | Interval between request starts, in milliseconds (integer from 1 to 2147483647). |
| `ENABLE_LOG` | `false` | Log successful response times when set to `true` (case-insensitive). |
| `METHOD` | `HEAD` | HTTP method, such as `HEAD`, `GET`, or `POST` (case-insensitive). |
| `TZ` | System timezone | Timezone used for log timestamps, e.g. `Europe/London`. |

Invalid configuration exits with code `9`.

## Docker

```sh
docker run -d \
  --name=WebPing \
  -e TZ=Europe/London \
  -e ENABLE_LOG=false \
  -e URL=https://example.com/ \
  -e DELAY=30000 \
  -e METHOD=GET \
  --restart unless-stopped \
  chokunplayz/njs-webping:stable
```

To build and run the updated image locally:

```sh
docker build -t njs-webping .
docker run --rm -e URL=https://example.com/ njs-webping
```

Images support `linux/amd64` and `linux/arm64`. Bun does not support the previous
32-bit `linux/arm` target.

## Development

```sh
bun install --frozen-lockfile
bun run typecheck
bun test
URL=https://example.com/ bun run dev
```

Only TypeScript and Bun's type definitions are installed for development.
The Docker image runs TypeScript directly without installing dependencies.

## การใช้งาน

โปรแกรมใช้ Bun รัน TypeScript โดยตรง และยังใช้ตัวแปรสภาพแวดล้อมเดิมได้
`URL` ต้องระบุ ส่วน `DELAY` มีค่าเริ่มต้น 60000 มิลลิวินาที และ `METHOD` มีค่าเริ่มต้นเป็น `HEAD`

```sh
docker run -d \
  --name=WebPing \
  -e TZ=Asia/Bangkok \
  -e ENABLE_LOG=false \
  -e URL=https://example.com/ \
  -e DELAY=30000 \
  -e METHOD=GET \
  --restart unless-stopped \
  chokunplayz/njs-webping:stable
```
