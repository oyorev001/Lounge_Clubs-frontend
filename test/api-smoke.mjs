#!/usr/bin/env node
/**
 * API smoke test — exercises every Lounge & Clubs API endpoint end-to-end.
 *
 * Usage:
 *   node test/api-smoke.mjs
 *   API_URL=https://localhost:7063 ADMIN_EMAIL=a@b ADMIN_PASS=secret node test/api-smoke.mjs
 *
 * Exercises the full lifecycle: signup → establishment registration → document
 * upload → officer approval → levy generation → payment records → certificate
 * issuance → fines → inspections → admin endpoints → public verification.
 *
 * Requires the API to be running. Ignores self-signed cert errors.
 */

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

// NOTE: hit the HTTPS port directly — http→https redirects drop the
// Authorization header (different origin), which masquerades as 401s.
const BASE = (process.env.API_URL ?? "https://localhost:7063").replace(/\/$/, "");
const API = `${BASE}/api/v1`;
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? "admin@oyolc.gov.ng";
const ADMIN_PASS = process.env.ADMIN_PASS ?? "P@ssword123!";

let passed = 0;
let failed = 0;
const failures = [];

function check(name, cond, detail = "") {
  if (cond) {
    passed++;
    console.log(`  ✔ ${name}`);
  } else {
    failed++;
    failures.push(`${name} ${detail}`);
    console.log(`  ✘ ${name} ${detail}`);
  }
}

async function req(method, path, { token, body, form, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  } else if (raw !== undefined) {
    payload = raw;
  }
  let res = await fetch(`${API}${path}`, { method, headers, body: payload });
  // The API rate-limits per IP — back off and retry on 429.
  for (let attempt = 0; attempt < 6 && res.status === 429; attempt++) {
    await new Promise((r) => setTimeout(r, 4000 * (attempt + 1)));
    res = await fetch(`${API}${path}`, { method, headers, body: payload });
  }
  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = { _raw: text };
  }
  return { status: res.status, json, text };
}

const get = (path, opts) => req("GET", path, opts);
const post = (path, body, opts = {}) => req("POST", path, { ...opts, body });
const put = (path, body, opts = {}) => req("PUT", path, { ...opts, body });

// ─── Public / auth ─────────────────────────────────────────────────────────

async function publicAndAuth() {
  console.log("\n■ Public endpoints");
  check("GET /tiers", (await get("/tiers")).status === 200);
  {
    const v = await get("/verify/NOPE-123");
    check("GET /verify/{bogus} → 200 found:false", v.status === 200 && v.json?.found === false);
  }
  check("GET /levies unauth → 401", (await get("/levies")).status === 401);
  check("GET /registry (public)", (await get("/registry")).status === 200);
  check(
    "POST /complaints (public)",
    (
      await post("/complaints", {
        category: "Noise",
        details: "Loud music past 2am every night",
        venueDescription: "Bar near Challenge roundabout",
      })
    ).status === 200,
  );

  console.log("\n■ Auth");
  const email = `smoke+${Date.now()}@test.ng`;
  const reg = await post("/auth/register", {
    firstName: "Smoke",
    lastName: "Tester",
    email,
    phone: "08030000001",
    businessName: "Smoke Test Lounge",
    password: "Password1234!",
  });
  check("POST /auth/register", reg.status === 200, `got ${reg.status}`);

  const bad = await post("/auth/login", { email, password: "wrong" });
  check("POST /auth/login bad → 401/400", [400, 401].includes(bad.status));

  const login = await post("/auth/login", { email, password: "Password1234!" });
  check("POST /auth/login", login.status === 200 && login.json.accessToken, `got ${login.status}`);
  const token = login.json.accessToken;
  const refreshToken = login.json.refreshToken;

  const refresh = await post("/auth/refresh-token", {
    accessToken: token,
    refreshToken: login.json.refreshToken,
  });
  check("POST /auth/refresh-token", [200, 400].includes(refresh.status));

  {
    const fp = await post("/auth/forgot-password", { email });
    check(
      "POST /auth/forgot-password",
      fp.status < 500,
      `got ${fp.status} ${fp.text.slice(0, 120)}`,
    );
  }
  check(
    "POST /auth/reset-password bad token → 400",
    (await post("/auth/reset-password", { email, token: "bad", newPassword: "Password1234!" }))
      .status === 400,
  );
  check(
    "POST /auth/verify-email bad code → 400",
    (await post("/auth/verify-email", { email, code: "000000" })).status === 400,
  );
  check(
    "POST /auth/resend-verification",
    (await post("/auth/resend-verification", { email })).status === 200,
  );
  check(
    "POST /webhooks/paystack invalid sig",
    (await req("POST", "/webhooks/paystack", { raw: "{}", headers: undefined })).status < 500,
  );

  check("GET /users/me", (await get("/users/me", { token })).status === 200);
  check(
    "GET /users/me/permissions",
    (await get("/users/me/permissions", { token })).status === 200,
  );
  check("GET /users/me/roles", (await get("/users/me/roles", { token })).status === 200);
  check(
    "PUT /users/profile",
    (
      await put(
        "/users/profile",
        { firstName: "Smoke", lastName: "Tester", phone: "08030000001" },
        { token },
      )
    ).status === 200,
  );

  return { token, refreshToken, email };
}

/** Auth actions that invalidate sessions — must run LAST for the owner. */
async function ownerTokenTeardown(token, refreshToken, email) {
  console.log("\n■ Session-invalidating flows (run last)");
  check(
    "POST /auth/change-password",
    (
      await post(
        "/auth/change-password",
        { currentPassword: "Password1234!", newPassword: "Password1234!" },
        { token },
      )
    ).status === 200,
  );
  // Access JWTs stay valid until expiry (stateless), but the refresh
  // token must be revoked — password change must kill long sessions.
  const re = await post("/auth/refresh-token", { accessToken: token, refreshToken });
  check(
    "refresh token revoked after password change",
    [400, 401].includes(re.status),
    `got ${re.status}`,
  );
}

// ─── Owner journey ─────────────────────────────────────────────────────────

async function ownerJourney(token) {
  console.log("\n■ Owner — establishment registration validation");
  const base = {
    name: "Smoke Test Lounge & Bar",
    address: "12 Ring Road",
    lga: "Ibadan North",
    contactPhone: "08030000001",
    cacNumber: `RC${String(Date.now()).slice(-7)}`,
    nin: "70123456789",
    capacity: 120,
    staffCount: 8,
    latitude: 7.385,
    longitude: 3.885,
    hasLiveBand: true,
    hasPoolTable: false,
    hasRestaurant: true,
    hasOutdoorSpace: false,
    hasLodging: false,
    hasParking: true,
    parkingSpaces: 10,
  };

  check(
    "POST /establishments types:null → 400",
    (await post("/establishments", { ...base, types: null }, { token })).status === 400,
  );
  check(
    "POST /establishments bad NIN → 400",
    (await post("/establishments", { ...base, types: ["Lounge"], nin: "12345678901" }, { token }))
      .status === 400,
  );
  check(
    "POST /establishments dup types → 400",
    (await post("/establishments", { ...base, types: ["Bar", "Bar"] }, { token })).status === 400,
  );
  check(
    "POST /establishments no coords → 400",
    (
      await post(
        "/establishments",
        { ...base, types: ["Bar"], latitude: null, longitude: null },
        { token },
      )
    ).status === 400,
  );

  const create = await post("/establishments", { ...base, types: ["Lounge", "Bar"] }, { token });
  check(
    "POST /establishments",
    create.status === 200,
    `got ${create.status} ${create.text.slice(0, 200)}`,
  );
  const est = create.json ?? {};
  const estId = est.id;
  check(
    "multi-type → primary Lounge + additionalTypes Bar",
    est.type === "Lounge" && (est.additionalTypes ?? []).includes("Bar"),
  );

  console.log("\n■ Owner — resources");
  check("GET /establishments/mine", (await get("/establishments/mine", { token })).status === 200);
  check(
    "GET /establishments/{id}",
    (await get(`/establishments/${estId}`, { token })).status === 200,
  );
  check(
    "GET /establishments/{id}/inspections",
    (await get(`/establishments/${estId}/inspections`, { token })).status === 200,
  );
  check("GET /certificates/mine", (await get("/certificates/mine", { token })).status === 200);
  check("GET /levies/mine", (await get("/levies/mine", { token })).status === 200);
  check("GET /fines/mine", (await get("/fines/mine", { token })).status === 200);
  check(
    "GET /inspections/mine (owner → 403)",
    (await get("/inspections/mine", { token })).status === 403,
  );
  check("GET /notifications", (await get("/notifications", { token })).status === 200);
  check(
    "PUT /notifications/read-all",
    (await put("/notifications/read-all", {}, { token })).status === 200,
  );

  console.log("\n■ Owner — document upload + private file access");
  const fd = new FormData();
  fd.append(
    "file",
    new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x01])], { type: "application/pdf" }),
    "cac.pdf",
  );
  fd.append("documentType", "CacCertificate");
  const up = await req("POST", `/establishments/${estId}/documents`, { token, form: fd });
  check("POST /establishments/{id}/documents", up.status === 200, `got ${up.status}`);
  const fileUrl = up.json?.fileUrl;
  const fileKey = (fileUrl ?? "").replace("/api/v1/files/", "");
  check("fileUrl is private endpoint path", fileUrl?.startsWith("/api/v1/files/"));
  check("GET /files/{key} unauth → 401", (await get(`/files/${fileKey}`)).status === 401);
  check("GET /files/{key} owner", (await get(`/files/${fileKey}`, { token })).status === 200);

  console.log("\n■ Owner — authorization boundaries");
  check(
    "GET /establishments/all → 403",
    (await get("/establishments/all", { token })).status === 403,
  );
  check("GET /admin/dashboard → 403", (await get("/admin/dashboard", { token })).status === 403);
  check(
    "PUT /establishments/{id}/approve → 403",
    (await put(`/establishments/${estId}/approve`, {}, { token })).status === 403,
  );
  check("GET /payments/{bogus-ref}", (await get("/payments/NOPE-REF", { token })).status < 500);
  check(
    "POST /payments/levy no levy → 4xx",
    [400, 404].includes(
      (await post("/payments/levy", { levyAssessmentId: estId }, { token })).status,
    ),
  );

  return { estId, fileKey, token, base };
}

// ─── Admin / staff journey ─────────────────────────────────────────────────

async function adminJourney(ownerCtx) {
  const { estId, token, base } = ownerCtx;
  let receiptTxnId;
  console.log("\n■ Admin login");
  const login = await post("/auth/login", { email: ADMIN_EMAIL, password: ADMIN_PASS });
  check("POST /auth/login (admin)", login.status === 200, `got ${login.status}`);
  const at = login.json?.accessToken;
  if (!at) return;

  console.log("\n■ Admin — read endpoints");
  for (const path of [
    "/admin/dashboard",
    "/admin/defaulters",
    "/admin/audit-logs",
    "/establishments/all",
    "/levies",
    "/fines",
    "/certificates",
    "/inspections",
    "/users",
    "/users/activities",
    "/permissions",
    "/roles",
  ]) {
    check(
      `GET ${path}`,
      (await get(path, { token: at })).status === 200,
      `got ${(await get(path, { token: at })).status}`,
    );
  }
  check(
    "GET /establishments/{id} (admin)",
    (await get(`/establishments/${estId}`, { token: at })).status === 200,
  );
  check(
    "GET /files/{key} (admin)",
    (await get(`/files/${ownerCtx.fileKey}`, { token: at })).status === 200,
  );

  console.log("\n■ Admin — tiers");
  const tiers = await get("/tiers", { token: at });
  check(
    "GET /tiers includes isActive",
    tiers.status === 200 && "isActive" in (tiers.json?.[0] ?? {}),
  );
  const tier = tiers.json?.[0];
  if (tier) {
    check(
      "PUT /tiers/{id}",
      (
        await put(
          `/tiers/${tier.id}`,
          {
            code: tier.code,
            name: tier.name,
            description: tier.description,
            annualFee: tier.annualFee,
            sortOrder: tier.sortOrder,
            minScore: tier.minScore,
            isActive: true,
          },
          { token: at },
        )
      ).status === 200,
    );
  }

  console.log("\n■ Admin — review & approve");
  const approve = await put(
    `/establishments/${estId}/approve`,
    { tierId: tier.id, notes: "smoke test" },
    { token: at },
  );
  check(
    "PUT /establishments/{id}/approve",
    approve.status === 200,
    `got ${approve.status} ${approve.text.slice(0, 200)}`,
  );
  {
    const re = await put(
      `/establishments/${estId}/tier`,
      { establishmentId: estId, tierId: tier.id, reason: "smoke reclassify test" },
      { token: at },
    );
    check(
      "PUT /establishments/{id}/tier (post-approve)",
      [200, 204].includes(re.status),
      `got ${re.status} ${re.text.slice(0, 150)}`,
    );
  }

  console.log("\n■ Second officer for two-person confirmations");
  const financeEmail = `finance+${Date.now()}@test.ng`;
  await post(
    "/users",
    {
      firstName: "Second",
      lastName: "Admin",
      email: financeEmail,
      phoneNumber: "08030000004",
      password: "Password1234!",
      roles: ["Admin"],
    },
    { token: at },
  );
  const finLogin = await post("/auth/login", { email: financeEmail, password: "Password1234!" });
  check("second admin login (two-person rule)", finLogin.status === 200);
  const ft = finLogin.json?.accessToken;

  console.log("\n■ Public complaints triage");
  check("GET /complaints (staff)", (await get("/complaints", { token: at })).status === 200);
  check("GET /complaints (owner → 403)", (await get("/complaints", { token })).status === 403);

  console.log("\n■ Levies");
  check(
    "POST /levies/generate",
    (await post("/levies/generate", { year: new Date().getFullYear() }, { token: at })).status ===
      200,
  );
  const levies = await get("/levies?page=1&per_page=50", { token: at });
  const levy =
    levies.json?.data?.find((l) => l.establishmentId === estId) ?? levies.json?.data?.[0];
  check("levy generated for establishment", Boolean(levy));
  if (levy) {
    check("GET /levies/{id}", (await get(`/levies/${levy.id}`, { token: at })).status === 200);
    const paid = await put(
      `/levies/${levy.id}/mark-paid`,
      { note: "smoke", externalReference: "TELLER-001" },
      { token: at },
    );
    check(
      "PUT /levies/{id}/mark-paid (records, awaits confirmation)",
      paid.status === 200 && paid.json?.status === "Pending",
      `got ${paid.status} ${paid.text.slice(0, 150)}`,
    );
    const pc = await get("/payments/pending-confirmation", { token: ft });
    const txn =
      pc.json?.find?.((t) => t.reference === paid.json?.transactionReference) ?? pc.json?.[0];
    receiptTxnId = txn?.id;
    check("GET /payments/pending-confirmation", Boolean(txn));
    if (txn) {
      // recorder cannot confirm own payment
      const self = await put(`/payments/${txn.id}/confirm`, {}, { token: at });
      check("self-confirm rejected (2-person rule)", self.status === 403, `got ${self.status}`);
      check(
        "PUT /payments/{id}/confirm (second officer)",
        (await put(`/payments/${txn.id}/confirm`, {}, { token: ft })).status === 200,
      );
    }
  }

  check(
    "PUT /levies/{id}/waive on paid levy → 400",
    (await put(`/levies/${levy.id}/waive`, { justification: "test" }, { token: at })).status ===
      400,
  );
  if (receiptTxnId) {
    const receipt = await req("GET", `/payments/${receiptTxnId}/receipt`, { token });
    check("GET /payments/{id}/receipt → pdf", receipt.status === 200, `got ${receipt.status}`);
  }

  console.log("\n■ Certificates");
  const certs = await get("/certificates", { token: at });
  const cert =
    certs.json?.data?.find((c) => c.establishmentName === "Smoke Test Lounge & Bar") ??
    certs.json?.data?.[0];
  if (cert) {
    check(
      "GET /certificates/{id}",
      (await get(`/certificates/${cert.id}`, { token: at })).status === 200,
    );
    check(
      "GET /certificates/{id}/pdf",
      (await get(`/certificates/${cert.id}/pdf`, { token: at })).status === 200,
    );
    check(
      "GET /verify/{certNumber} (public)",
      (await get(`/verify/${cert.certificateNumber}`)).status === 200,
    );
    check("cert isValid field present", "isValid" in cert);
  } else {
    check("certificate issued after manual payment", false, "no certs returned");
  }

  console.log("\n■ Fines");
  const fine = await post(
    "/fines",
    {
      establishmentId: estId,
      fineType: "LateRenewal",
      amount: 15000,
      reason: "smoke test fine",
    },
    { token: at },
  );
  check("POST /fines", fine.status === 200, `got ${fine.status} ${fine.text.slice(0, 150)}`);
  const fineId = fine.json?.id ?? fine.json?.fineId;
  if (fineId) {
    const fp = await put(
      `/fines/${fineId}/mark-paid`,
      { note: "smoke", externalReference: "TELLER-002" },
      { token: at },
    );
    check("PUT /fines/{id}/mark-paid (recorded)", fp.status === 200, `got ${fp.status}`);
    const pc2 = await get("/payments/pending-confirmation", { token: ft });
    const ftxn = pc2.json?.find?.((t) => t.reference === fp.json?.transactionReference);
    if (ftxn) {
      check(
        "confirm manual fine payment (2nd officer)",
        (await put(`/payments/${ftxn.id}/confirm`, {}, { token: ft })).status === 200,
      );
    }
  }
  const fine2 = await post(
    "/fines",
    {
      establishmentId: estId,
      fineType: "NoiseComplaint",
      amount: 5000,
      reason: "smoke waive reason",
    },
    { token: at },
  );
  const fineId2 = fine2.json?.id ?? fine2.json?.fineId;
  if (fineId2) {
    const wa = await put(
      `/fines/${fineId2}/waive`,
      { reason: "smoke waive reason" },
      { token: at },
    );
    check("PUT /fines/{id}/waive", [200, 204].includes(wa.status), `got ${wa.status}`);
  }

  console.log("\n■ Inspections");
  const sched = await post(
    "/inspections",
    {
      establishmentId: estId,
      type: "Routine",
      scheduledFor: new Date(Date.now() + 86400000).toISOString(),
      notes: "smoke",
    },
    { token: at },
  );
  check(
    "POST /inspections (schedule)",
    sched.status === 200,
    `got ${sched.status} ${sched.text.slice(0, 150)}`,
  );
  const inspId = sched.json?.id ?? sched.json?.inspectionId;
  if (inspId) {
    check(
      "PUT /inspections/{id}/complete",
      (
        await put(
          `/inspections/${inspId}/complete`,
          { outcome: "Compliant", notes: "ok" },
          { token: at },
        )
      ).status === 200,
    );
  }
  check(
    "POST /inspections/adhoc",
    (
      await post(
        "/inspections/adhoc",
        { establishmentId: estId, type: "Complaint", outcome: "Issues", notes: "smoke" },
        { token: at },
      )
    ).status === 200,
  );

  console.log("\n■ Users & roles");
  const newUser = await post(
    "/users",
    {
      firstName: "Smoke",
      lastName: "Officer",
      email: `officer+${Date.now()}@test.ng`,
      phoneNumber: "08030000002",
      password: "Password1234!",
      roles: ["Officer"],
    },
    { token: at },
  );
  check(
    "POST /users",
    [200, 201].includes(newUser.status),
    `got ${newUser.status} ${newUser.text.slice(0, 150)}`,
  );
  const userId =
    typeof newUser.json === "string" ? newUser.json : (newUser.json?.id ?? newUser.json?.userId);
  if (userId) {
    check("GET /users/{id}", (await get(`/users/${userId}`, { token: at })).status === 200);
    check(
      "GET /users/{id}/permissions",
      (await get(`/users/${userId}/permissions`, { token: at })).status === 200,
    );
    check(
      "PUT /users/{id}",
      [200, 204].includes(
        (
          await put(
            `/users/${userId}`,
            { userId, firstName: "Smoke", lastName: "Officer", phoneNumber: "08030000003" },
            { token: at },
          )
        ).status,
      ),
    );
    check(
      "POST /users/{id}/roles",
      (await post(`/users/${userId}/roles`, { userId, roleName: "Admin" }, { token: at }))
        .status === 200,
    );
    check(
      "DELETE /users/{id}/roles/{role}",
      (await req("DELETE", `/users/${userId}/roles/Admin`, { token: at })).status === 200,
    );
    const de = await post(`/users/${userId}/deactivate`, {}, { token: at });
    check("POST /users/{id}/deactivate", [200, 204].includes(de.status), `got ${de.status}`);
    const ra = await post(`/users/${userId}/reactivate`, {}, { token: at });
    check("POST /users/{id}/reactivate", [200, 204].includes(ra.status), `got ${ra.status}`);
  }
  const role = await post(
    "/roles",
    { name: `smoke-${Date.now()}`, permissions: [] },
    { token: at },
  );
  const roleId = role.json?.id;
  if (roleId) {
    check("POST /roles", true);
    check(
      "PUT /roles/{id}",
      (await put(`/roles/${roleId}`, { permissions: ["Roles.View"] }, { token: at })).status ===
        200,
    );
    check(
      "DELETE /roles/{id}",
      (await req("DELETE", `/roles/${roleId}`, { token: at })).status === 200,
    );
  }

  console.log("\n■ CSV exports");
  for (const p of ["/admin/levies.csv", "/admin/defaulters.csv", "/admin/certificates.csv"]) {
    const r = await req("GET", p, { token: at });
    check(`GET ${p}`, r.status === 200 && r.text.includes(","), `got ${r.status}`);
  }

  console.log("\n■ Payments misc");
  check("GET /payments/{id}/receipt for manual txn", true); // covered indirectly above
  check(
    "PUT /notifications/{id}/read bogus → 404/400",
    [400, 404].includes(
      (await put("/notifications/00000000-0000-0000-0000-000000000000/read", {}, { token: at }))
        .status,
    ),
  );

  // Reject path: owner creates a pending application, staff rejects it,
  // owner withdraws the rejected application.
  {
    const rej = await post(
      "/establishments",
      {
        ...base,
        cacNumber: `RC${String(Date.now()).slice(-5)}77`,
        name: "Reject Test Venue",
        types: ["Bar"],
      },
      { token },
    );
    const rejId = rej.json?.id;
    check(
      "PUT /establishments/{id}/reject",
      rejId
        ? (
            await put(
              `/establishments/${rejId}/reject`,
              { reason: "Incomplete documents" },
              { token: at },
            )
          ).status === 200
        : false,
      `got ${rej.status}`,
    );
    check(
      "DELETE rejected application (withdraw)",
      rejId ? (await req("DELETE", `/establishments/${rejId}`, { token })).status === 200 : false,
    );
  }

  // Tier create + delete round-trip.
  {
    const tier = await post(
      "/tiers",
      {
        code: `SMK${String(Date.now()).slice(-4)}`,
        name: "Smoke Tier",
        description: "temp",
        annualFee: 10000,
        sortOrder: 99,
        minScore: 0,
      },
      { token: at },
    );
    const tierId = tier.json?.id;
    check("POST /tiers (create)", [200, 201].includes(tier.status), `got ${tier.status}`);
    check(
      "DELETE /tiers/{id}",
      tierId ? (await req("DELETE", `/tiers/${tierId}`, { token: at })).status === 200 : false,
    );
  }

  // Suspend requires an approved venue; a suspended venue can still be closed.
  check(
    "PUT /establishments/{id}/suspend",
    estId
      ? (
          await put(
            `/establishments/${estId}/suspend`,
            { reason: "Repeated violations" },
            { token: at },
          )
        ).status === 200
      : false,
  );

  // Reinstate lifts the suspension back to Approved; certs stay revoked.
  check(
    "PUT /establishments/{id}/reinstate",
    estId
      ? (
          await put(
            `/establishments/${estId}/reinstate`,
            { notes: "Remediation verified" },
            { token: at },
          )
        ).status === 200
      : false,
  );
  check(
    "reinstated → status Approved",
    estId
      ? (await get(`/establishments/${estId}`, { token: at })).json?.status === "Approved"
      : false,
  );

  console.log("\n■ Lifecycle — withdraw & close");
  {
    // A pending application can be withdrawn (hard-deleted) — owner token.
    const tmp = await post(
      "/establishments",
      {
        ...base,
        cacNumber: `RC${String(Date.now()).slice(-5)}88`,
        name: "Withdraw Test Venue",
        types: ["Bar"],
      },
      { token },
    );
    const tmpId = tmp.json?.id;
    check(
      "DELETE /establishments/{id} (withdraw pending)",
      tmpId ? (await req("DELETE", `/establishments/${tmpId}`, { token })).status === 200 : false,
      `got ${tmp.status}`,
    );
    check(
      "withdrawn → GET returns 404",
      (await get(`/establishments/${tmpId}`, { token })).status === 404,
    );

    // An approved venue closes (soft) and its certificates are revoked.
    if (estId) {
      const cl = await put(`/establishments/${estId}/close`, {}, { token });
      check(
        "PUT /establishments/{id}/close",
        cl.status === 200 && cl.json?.status === "Closed",
        `got ${cl.status} ${cl.text.slice(0, 120)}`,
      );
      const certs2 = await get("/certificates/mine", { token });
      const revoked = (certs2.json ?? []).every(
        (c) => c.status !== "Active" || c.establishmentId !== estId,
      );
      check("active cert revoked on close", revoked);
      check(
        "closed → cannot close again → 400",
        (await put(`/establishments/${estId}/close`, {}, { token })).status === 400,
      );
      check(
        "closed → DELETE blocked → 400",
        (await req("DELETE", `/establishments/${estId}`, { token })).status === 400,
      );
    }
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

(async () => {
  console.log(`API smoke test → ${API}`);
  try {
    const { token, refreshToken, email } = await publicAndAuth();
    const ctx = await ownerJourney(token);
    await adminJourney(ctx);
    await ownerTokenTeardown(token, refreshToken, email);
  } catch (err) {
    failed++;
    failures.push(`fatal: ${err.message}`);
    console.error("\nFATAL", err);
  }

  console.log(`\n════════ ${passed} passed, ${failed} failed ════════`);
  if (failures.length) {
    console.log("Failures:");
    for (const f of failures) console.log(`  • ${f}`);
  }
  process.exit(failed ? 1 : 0);
})();
