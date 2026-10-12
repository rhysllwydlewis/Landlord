import { execFileSync, spawnSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";

const image = process.argv[2] || "property-management-platform:check";
const name = `platform-check-${randomUUID()}`;
const env = {
  ...process.env,
  BETTER_AUTH_SECRET: randomBytes(48).toString("hex"),
};
const docker = (...args) =>
  execFileSync("docker", args, {
    env,
    encoding: "utf8",
    timeout: 60000,
  }).trim();

try {
  docker(
    "run",
    "--detach",
    "--name",
    name,
    "--publish",
    "127.0.0.1::4180",
    "--env",
    "PORT=4180",
    "--env",
    "APP_URL=http://localhost:4180",
    "--env",
    "BETTER_AUTH_URL=http://localhost:4180",
    "--env",
    "DATABASE_URL=postgresql://unused:unused@127.0.0.1:5432/unused",
    "--env",
    "BETTER_AUTH_SECRET",
    image,
  );
  const binding = docker("port", name, "4180/tcp");
  assert.match(binding, /^127\.0\.0\.1:\d+$/);
  const url = `http://${binding}`;
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (response.ok && (await response.text()).includes("More clarity.")) {
        ready = true;
        break;
      }
    } catch {
      // Allow the production server time to start; a failed assertion logs it below.
    }
    await setTimeout(1000);
  }
  assert.ok(
    ready,
    "Container did not serve the homepage on the configured PORT.",
  );
  assert.equal(docker("exec", name, "id", "-u"), "1001");
  docker(
    "exec",
    name,
    "sh",
    "-c",
    "test ! -e /app/.env && test ! -e /app/.dev-accounts.json && test ! -e /run/secrets/proxy_ca",
  );
  const protectedResponse = await fetch(`${url}/api/workspace/properties`, {
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(
    protectedResponse.status,
    401,
    "Anonymous workspace access must be rejected.",
  );
  console.log(
    "Container check passed: custom PORT, homepage, non-root user, private-file exclusions and protected API.",
  );
} catch (error) {
  spawnSync("docker", ["logs", name], {
    env,
    stdio: "inherit",
    timeout: 10000,
  });
  throw error;
} finally {
  spawnSync("docker", ["rm", "--force", name], {
    env,
    stdio: "ignore",
    timeout: 10000,
  });
}
