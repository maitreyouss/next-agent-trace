import { describe, expect, it } from "vitest";

import { contentSecurityPolicy, securityHeaders } from "@/lib/http/headers";

describe("security headers", () => {
  it("keeps the production policy free of eval", () => {
    expect(contentSecurityPolicy("production")).not.toContain("unsafe-eval");
    expect(contentSecurityPolicy("development")).toContain("unsafe-eval");
    const names = securityHeaders("production").map((header) => header.key);
    expect(names).toContain("Content-Security-Policy");
    expect(names).toContain("Strict-Transport-Security");
    expect(securityHeaders("development").map((header) => header.key)).not.toContain(
      "Strict-Transport-Security",
    );
  });
});
