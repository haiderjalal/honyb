import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import type { NextConfig } from "next";

// Vitest runs from the repository root (npm test), so the project files are found relative to it.
const ROOT = process.cwd();

type HeaderRules = { source: string; headers: { key: string; value: string }[] }[];

async function loadHeaderRules(config: NextConfig): Promise<HeaderRules> {
  if (!config.headers) throw new Error("next.config.ts must define headers()");
  return (await config.headers()) as HeaderRules;
}

function headerValue(rules: HeaderRules, source: string, key: string): string | undefined {
  return rules.find((rule) => rule.source === source)?.headers.find((header) => header.key === key)?.value;
}

describe("security headers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("applies the core headers to every route", async () => {
    const { default: config } = await import("../../next.config");
    const rules = await loadHeaderRules(config);

    expect(headerValue(rules, "/:path*", "X-Frame-Options")).toBe("DENY");
    expect(headerValue(rules, "/:path*", "X-Content-Type-Options")).toBe("nosniff");
    expect(headerValue(rules, "/:path*", "Strict-Transport-Security")).toContain("max-age=");
    expect(headerValue(rules, "/:path*", "Cross-Origin-Opener-Policy")).toBe("same-origin");
  });

  it("forbids framing, plugin content and foreign script sources in the content security policy", async () => {
    const { default: config } = await import("../../next.config");
    const policy = headerValue(await loadHeaderRules(config), "/:path*", "Content-Security-Policy") ?? "";

    expect(policy).toContain("default-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("base-uri 'self'");
  });

  it("allows eval only in development, and upgrades insecure requests in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { default: production } = await import("../../next.config");
    const productionPolicy = headerValue(await loadHeaderRules(production), "/:path*", "Content-Security-Policy") ?? "";
    expect(productionPolicy).not.toContain("unsafe-eval");
    expect(productionPolicy).toContain("upgrade-insecure-requests");

    vi.stubEnv("NODE_ENV", "development");
    vi.resetModules();
    const { default: development } = await import("../../next.config");
    const developmentPolicy =
      headerValue(await loadHeaderRules(development), "/:path*", "Content-Security-Policy") ?? "";
    expect(developmentPolicy).toContain("'unsafe-eval'");
  });

  it("keeps private pages out of shared caches and search engines", async () => {
    const { default: config } = await import("../../next.config");
    const rules = await loadHeaderRules(config);

    for (const source of ["/admin/:path*", "/membership/account/:path*"]) {
      expect(headerValue(rules, source, "Cache-Control")).toBe("private, no-store");
      expect(headerValue(rules, source, "X-Robots-Tag")).toBe("noindex, nofollow");
    }
  });
});

describe("environment example file", () => {
  const envLines = readFileSync(join(ROOT, ".env.example"), "utf8")
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z][A-Z0-9_]*)=(.*)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map(([, name, value]) => ({ name, value: value.trim() }));

  const SECRET_NAME = /SERVICE_ROLE|PRIVATE_KEY|API_KEY|SECRET|TOKEN|PASSWORD/;

  it("has no real value for any secret", () => {
    const filled = envLines.filter((entry) => SECRET_NAME.test(entry.name) && entry.value !== "");
    expect(filled.map((entry) => entry.name)).toEqual([]);
  });

  it("never gives a secret a NEXT_PUBLIC_ name, which would ship it to every browser", () => {
    const exposed = envLines.filter((entry) => SECRET_NAME.test(entry.name) && entry.name.startsWith("NEXT_PUBLIC_"));
    expect(exposed.map((entry) => entry.name)).toEqual([]);
  });
});

describe("database migrations", () => {
  const migrationsDir = join(ROOT, "supabase", "migrations");
  const migrationFiles = readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  const sql = migrationFiles.map((file) => readFileSync(join(migrationsDir, file), "utf8")).join("\n");
  const tables = [...sql.matchAll(/create table (?:if not exists )?([a-z_][a-z0-9_]*)/gi)].map((match) =>
    match[1].toLowerCase(),
  );

  it("creates tables, so the row level security check below is meaningful", () => {
    expect(tables.length).toBeGreaterThan(0);
  });

  it.each(tables)("%s has row level security enabled", (table) => {
    expect(sql).toMatch(new RegExp(`alter table ${table} enable row level security`, "i"));
  });

  it("removes direct table access from the public API roles", () => {
    const lockdown = readFileSync(join(migrationsDir, "20261116120000_lock_down_public_tables.sql"), "utf8");
    expect(lockdown).toContain("revoke all on all tables in schema public from %I");
    expect(lockdown).toContain("['anon', 'authenticated']");
  });
});
