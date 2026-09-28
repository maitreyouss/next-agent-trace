function compact(value: string) {
  return value.replace(/\s{2,}/g, " ").trim();
}

export function contentSecurityPolicy(nodeEnv = process.env.NODE_ENV ?? "production") {
  const dev = nodeEnv !== "production";
  return compact(`
    default-src 'self';
    script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""};
    script-src-attr 'none';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data:;
    font-src 'self';
    connect-src 'self'${dev ? " ws: wss:" : ""};
    object-src 'none';
    frame-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
    ${dev ? "" : "upgrade-insecure-requests;"}
  `);
}

export function securityHeaders(nodeEnv = process.env.NODE_ENV ?? "production") {
  const headers = [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(nodeEnv) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=(), payment=()",
    },
  ];
  if (nodeEnv === "production") {
    headers.push({
      key: "Strict-Transport-Security",
      value: "max-age=63072000; includeSubDomains",
    });
  }
  return headers;
}
