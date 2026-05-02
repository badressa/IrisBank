require("dotenv").config();

const BASE_URL = process.env.APP_URL || "http://localhost:3000";

let cookieJar = "";
let csrfToken = "";

function mergeCookies(setCookieHeader) {
  if (!setCookieHeader) return;

  const incoming = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  const map = new Map();

  if (cookieJar) {
    cookieJar.split(";").map((v) => v.trim()).filter(Boolean).forEach((pair) => {
      const idx = pair.indexOf("=");
      if (idx > 0) map.set(pair.slice(0, idx), pair.slice(idx + 1));
    });
  }

  incoming.forEach((raw) => {
    const pair = String(raw).split(";")[0];
    const idx = pair.indexOf("=");
    if (idx > 0) map.set(pair.slice(0, idx), pair.slice(idx + 1));
  });

  cookieJar = Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join("; ");
}

async function request(path, { method = "GET", json, withCsrf = false } = {}) {
  const headers = { Accept: "application/json, text/html;q=0.9,*/*;q=0.8" };

  if (cookieJar) headers.Cookie = cookieJar;
  if (json) headers["Content-Type"] = "application/json";
  if (withCsrf && csrfToken) headers["CSRF-Token"] = csrfToken;

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: json ? JSON.stringify(json) : undefined,
    redirect: "manual"
  });

  const rawSetCookie = res.headers.get("set-cookie");
  if (rawSetCookie) mergeCookies(rawSetCookie);

  const text = await res.text();
  let data = null;
  try {
    data = JSON.parse(text);
  } catch (_) {
    data = text;
  }

  return { status: res.status, data };
}

function okStatus(actual, expected) {
  return expected.includes(actual);
}

async function run() {
  const tests = [];

  function add(name, path, options, expectedStatuses) {
    tests.push({ name, path, options, expectedStatuses });
  }

  // Public pages
  add("GET /", "/", {}, [200]);
  add("GET /login", "/login", {}, [200]);
  add("GET /register", "/register", {}, [200]);

  // Initialize csrf/cookie
  const csrfRes = await request("/api/csrf-token");
  if (csrfRes.status === 200 && csrfRes.data && csrfRes.data.csrfToken) {
    csrfToken = csrfRes.data.csrfToken;
  }

  // Auth routes (unauth and invalid payloads)
  add("POST /api/auth/login (empty body)", "/api/auth/login", { method: "POST", json: {}, withCsrf: true }, [400]);
  add("POST /api/auth/login (bad credentials)", "/api/auth/login", { method: "POST", json: { email: "nobody@example.com", password: "Wrong1234" }, withCsrf: true }, [401]);
  add("POST /api/auth/verify-secret-code (no pending session)", "/api/auth/verify-secret-code", { method: "POST", json: { code: "1234" }, withCsrf: true }, [400]);
  add("POST /api/auth/verify-otp (no pending session)", "/api/auth/verify-otp", { method: "POST", json: { code: "123456" }, withCsrf: true }, [400]);
  add("GET /api/auth/me", "/api/auth/me", {}, [401]);

  // Protected APIs should reject unauthenticated access, not crash
  add("GET /api/accounts", "/api/accounts", {}, [401, 403]);
  add("GET /api/transactions/history", "/api/transactions/history", {}, [401, 403, 404]);
  add("GET /api/profile", "/api/profile", {}, [401, 403]);
  add("GET /api/notifications", "/api/notifications", {}, [401, 403]);
  add("GET /api/admin/stats", "/api/admin/stats", {}, [401, 403]);
  add("GET /api/admin/search", "/api/admin/search", {}, [401, 403]);
  add("GET /api/cards", "/api/cards", {}, [401, 403]);
  add("GET /api/kyc", "/api/kyc", {}, [401, 403]);
  add("GET /api/tickets", "/api/tickets", {}, [401, 403]);
  add("GET /api/rgpd/check-consent", "/api/rgpd/check-consent", {}, [401, 403]);
  add("GET /api/stripe/config", "/api/stripe/config", {}, [401, 403]);
  add("GET /api/contracts/mon-contrat", "/api/contracts/mon-contrat", {}, [401, 403]);
  add("GET /api/contracts/check-and-pay", "/api/contracts/check-and-pay", {}, [401, 403]);
  add("POST /api/contracts/add", "/api/contracts/add", { method: "POST", json: {}, withCsrf: true }, [401, 403]);

  // Forgot / reset password
  add("GET /reset-password", "/reset-password", {}, [200]);
  add("POST /api/auth/forgot-password (missing email)", "/api/auth/forgot-password", { method: "POST", json: {}, withCsrf: true }, [400]);
  add("POST /api/auth/forgot-password (email inconnu)", "/api/auth/forgot-password", { method: "POST", json: { email: "nobody@example.com" }, withCsrf: true }, [200]);
  add("POST /api/auth/reset-password (params manquants)", "/api/auth/reset-password", { method: "POST", json: {}, withCsrf: true }, [400]);
  add("POST /api/auth/reset-password (token invalide)", "/api/auth/reset-password", { method: "POST", json: { token: "faketoken", userId: "999", password: "Fake1234!" }, withCsrf: true }, [400]);

  let passed = 0;
  const failures = [];

  for (const t of tests) {
    try {
      const result = await request(t.path, t.options || {});
      const good = okStatus(result.status, t.expectedStatuses);

      if (good) {
        passed += 1;
        console.log(`PASS ${t.name} -> ${result.status}`);
      } else {
        failures.push({ name: t.name, status: result.status, expected: t.expectedStatuses, body: result.data });
        console.log(`FAIL ${t.name} -> ${result.status} (expected ${t.expectedStatuses.join(",")})`);
      }
    } catch (err) {
      failures.push({ name: t.name, status: "EXCEPTION", expected: t.expectedStatuses, body: err.message });
      console.log(`FAIL ${t.name} -> EXCEPTION ${err.message}`);
    }
  }

  console.log("\n====================");
  console.log(`Smoke tests: ${passed}/${tests.length} passed`);
  console.log("====================");

  if (failures.length) {
    console.log("\nFailures:");
    failures.forEach((f) => {
      console.log(`- ${f.name}`);
      console.log(`  got: ${f.status}`);
      console.log(`  expected: ${Array.isArray(f.expected) ? f.expected.join(",") : f.expected}`);
      console.log(`  body: ${typeof f.body === "string" ? f.body : JSON.stringify(f.body)}`);
    });
    process.exit(1);
  }

  process.exit(0);
}

run().catch((err) => {
  console.error("Smoke test runner failed:", err);
  process.exit(1);
});
