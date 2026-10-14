// BukuKas Pro — Edge Function "send-reminders"
// Dipanggil pg_cron tiap 15 menit. Menghitung pengingat setiap usaha (stok menipis,
// hutang/piutang jatuh tempo, anggaran, target, pengingat harian) lalu mengirim Web Push
// ke semua perangkat pengguna — tetap muncul walau aplikasi ditutup.
// Tanpa library push eksternal: enkripsi (RFC 8291) & VAPID (RFC 8292) memakai WebCrypto bawaan.
//   POST {}                + header x-cron-secret   -> jalankan semua pengingat
//   POST {"test":true}     + Authorization user JWT -> kirim notifikasi uji ke perangkat pengguna
//   POST {"selftest":true} + header x-cron-secret   -> cek konfigurasi & enkripsi
import { createClient } from "npm:@supabase/supabase-js@2";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, "Content-Type": "application/json" } });

/* ---------------- Web Push (VAPID + aes128gcm) ---------------- */
const te = new TextEncoder();
const b64uDec = (s: string) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)); return Uint8Array.from(b, (c) => c.charCodeAt(0)); };
const b64uEnc = (u: Uint8Array) => { let s = ""; for (const x of u) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const concat = (...a: Uint8Array[]) => { const o = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { o.set(x, i); i += x.length; } return o; };
async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, len: number) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}
export async function encryptPayload(p256dh: string, authSecret: string, data: Uint8Array) {
  const uaPub = b64uDec(p256dh), auth = b64uDec(authSecret);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ecdh = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(auth, ecdh, concat(te.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, concat(data, new Uint8Array([2]))));
  const rs = new Uint8Array(4); new DataView(rs.buffer).setUint32(0, 4096);
  return concat(salt, rs, new Uint8Array([asPub.length]), asPub, ct);
}
let VKEY: CryptoKey | null = null;
export async function vapidHeader(endpoint: string, pub: string, priv: string, subject: string) {
  if (!VKEY) { const p = b64uDec(pub); VKEY = await crypto.subtle.importKey("jwk", { kty: "EC", crv: "P-256", x: b64uEnc(p.slice(1, 33)), y: b64uEnc(p.slice(33, 65)), d: priv, ext: true }, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]); }
  const h = b64uEnc(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const c = b64uEnc(te.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: subject })));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, VKEY, te.encode(h + "." + c)));
  return `vapid t=${h}.${c}.${b64uEnc(sig)}, k=${pub}`;
}

/* ---------------- konfigurasi dari Vault ---------------- */
type Cfg = Record<string, string>;
let CFG: Cfg | null = null;
async function cfg(): Promise<Cfg> {
  if (CFG) return CFG;
  const { data, error } = await sb.rpc("get_push_config");
  if (error) throw error;
  CFG = data as Cfg;
  if (!CFG.bukukas_vapid_public || !CFG.bukukas_vapid_private) throw new Error("Kunci VAPID belum ada di Vault (jalankan 003_secrets_cron.sql)");
  return CFG;
}

async function send(sub: any, payload: Record<string, unknown>) {
  const c = await cfg();
  try {
    const body = await encryptPayload(sub.p256dh, sub.auth, te.encode(JSON.stringify(payload)));
    const r = await fetch(sub.endpoint, { method: "POST", headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: "21600", Urgency: "normal", Authorization: await vapidHeader(sub.endpoint, c.bukukas_vapid_public, c.bukukas_vapid_private, c.bukukas_vapid_subject || "mailto:admin@example.com") }, body });
    if (r.status === 404 || r.status === 410) { await sb.from("push_subscriptions").delete().eq("id", sub.id); return false; }
    if (!r.ok) { console.error("push gagal", r.status, await r.text()); return false; }
    await sb.from("push_subscriptions").update({ last_ok: new Date().toISOString() }).eq("id", sub.id);
    return true;
  } catch (e: any) { console.error("push error", e?.message || e); return false; }
}

/* ---------------- perhitungan pengingat ---------------- */
const N = (v: unknown) => Number(v) || 0;
const DEF = { stok: true, piutang: true, hutang: true, anggaran: true, catat: true, harian: true, ringkasan: false, target: true, push: false, jam: "19:00", hari_jatuh_tempo: 3 };
const MODS = { kasir: true, stok: true, hutang: true, harian: false, anggaran: true };
function localNow(tz: string) {
  const opt: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false };
  let f: Intl.DateTimeFormat;
  try { f = new Intl.DateTimeFormat("en-CA", { ...opt, timeZone: tz }); } catch { f = new Intl.DateTimeFormat("en-CA", { ...opt, timeZone: "Asia/Jakarta" }); }
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: (N(p.hour) % 24) * 60 + N(p.minute) };
}
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diffDays = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const fmtDate = (s: string) => new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const numf = (n: number) => N(n).toLocaleString("id-ID", { maximumFractionDigits: 2 });
const money = (n: number) => "Rp " + Math.round(N(n)).toLocaleString("id-ID");

type Alert = { id: string; e: string; t: string; b: string; page: string; lv: string };

async function bizAlerts(biz: any, today: string, nowMin: number): Promise<Alert[]> {
  const st = biz.settings || {}, ns = { ...DEF, ...(st.notif || {}) }, m = { ...MODS, ...(st.mods || {}) };
  if (!ns.push) return [];
  const monthStart = today.slice(0, 8) + "01", id = biz.id;
  const [P, MV, D, Bu, C, T, L, K] = await Promise.all([
    sb.from("products").select("id,name,stock,stock_base,min_stock,unit,track_stock,active").eq("business_id", id),
    sb.from("stock_moves").select("product_id,qty").eq("business_id", id),
    sb.from("debts").select("id,kind,amount,paid,due_date,contact_id,contact_name").eq("business_id", id),
    sb.from("budgets").select("id,category_id,amount").eq("business_id", id),
    sb.from("categories").select("id,name").eq("business_id", id),
    sb.from("transactions").select("date,type,amount,category_id").eq("business_id", id).gte("date", monthStart),
    sb.from("production_logs").select("id").eq("business_id", id).eq("date", today).limit(1),
    sb.from("contacts").select("id,name").eq("business_id", id),
  ]);
  const mv: Record<string, number> = {}; for (const m of (MV.data || []) as any[]) if (m.product_id) mv[m.product_id] = (mv[m.product_id] || 0) + N(m.qty);
  const prods = ((P.data || []) as any[]).map((p) => ({ ...p, stock: p.stock_base == null ? N(p.stock) : N(p.stock_base) + (mv[p.id] || 0) })), debts = D.data || [], buds = Bu.data || [], tx = T.data || [];
  const catName = new Map((C.data || []).map((c: any) => [c.id, c.name]));
  const cName = new Map((K.data || []).map((c: any) => [c.id, c.name]));
  const A: Alert[] = [];
  const [hh, mm] = String(ns.jam || "19:00").split(":").map(Number);
  const pastJam = nowMin >= hh * 60 + (mm || 0);

  if (ns.stok && m.stok) for (const p of prods) {
    if (p.active === false || p.track_stock === false || N(p.min_stock) <= 0 || N(p.stock) > N(p.min_stock)) continue;
    A.push({ id: "stok-" + p.id + "-" + N(p.stock), lv: N(p.stock) <= 0 ? "danger" : "warn", e: "📦", t: (N(p.stock) <= 0 ? "Stok habis: " : "Stok menipis: ") + p.name, b: "Sisa " + numf(p.stock) + " " + (p.unit || "") + " (minimum " + numf(p.min_stock) + ")", page: "stok" });
  }
  const H = N(ns.hari_jatuh_tempo) || 3;
  for (const k of ["piutang", "hutang"]) {
    if (!(ns as any)[k] || !m.hutang) continue;
    for (const d of debts) {
      const left = N(d.amount) - N(d.paid);
      if (d.kind !== k || left <= 0.5 || !d.due_date || d.due_date > addDays(today, H)) continue;
      const dd = diffDays(today, d.due_date), who = cName.get(d.contact_id) || d.contact_name || "-";
      A.push({ id: k + "-" + d.id + "-" + d.due_date, lv: dd < 0 ? "danger" : "warn", e: k === "piutang" ? "📥" : "📤", t: (k === "piutang" ? "Piutang " : "Hutang ke ") + who + (dd < 0 ? " terlambat " + (-dd) + " hari" : dd === 0 ? " jatuh tempo hari ini" : " jatuh tempo " + dd + " hari lagi"), b: "Sisa " + money(left) + " • tempo " + fmtDate(d.due_date), page: "hutang" });
    }
  }
  if (ns.anggaran && m.anggaran) for (const b of buds) {
    if (!N(b.amount) || !catName.has(b.category_id)) continue;
    const sp = tx.filter((t: any) => t.type === "out" && t.category_id === b.category_id).reduce((a: number, t: any) => a + N(t.amount), 0), p = sp / N(b.amount) * 100;
    if (p >= 80) A.push({ id: "ang-" + b.id + "-" + (p >= 100 ? "x" : "w") + monthStart, lv: p >= 100 ? "danger" : "warn", e: "🎯", t: "Anggaran " + catName.get(b.category_id) + (p >= 100 ? " terlampaui" : " hampir habis"), b: "Terpakai " + money(sp) + " dari " + money(b.amount) + " (" + Math.round(p) + "%)", page: "anggaran" });
  }
  if (ns.target && N(st.target)) {
    const inc = tx.filter((t: any) => t.type === "in" && t.category_id).reduce((a: number, t: any) => a + N(t.amount), 0);
    if (inc >= N(st.target)) A.push({ id: "target-" + monthStart, lv: "info", e: "🏆", t: "Target omzet bulan ini tercapai!", b: money(inc) + " dari target " + money(st.target), page: "dashboard" });
  }
  if (pastJam) {
    const todayTx = tx.filter((t: any) => t.date === today);
    if (ns.catat && !todayTx.length) A.push({ id: "catat-" + today, lv: "info", e: "✍️", t: "Belum ada transaksi hari ini", b: "Jangan lupa catat pemasukan & pengeluaran hari ini.", page: "transaksi" });
    const metrics = st.metrics || [];
    if (ns.harian && m.harian && metrics.length && !(L.data || []).length) A.push({ id: "harian-" + today, lv: "info", e: "📋", t: "Catatan harian belum diisi", b: "Isi data " + metrics.slice(0, 2).map((x: any) => String(x.label).toLowerCase()).join(", ") + " hari ini.", page: "harian" });
    if (ns.ringkasan) {
      const ci = todayTx.filter((t: any) => t.type === "in").reduce((a: number, t: any) => a + N(t.amount), 0), co = todayTx.filter((t: any) => t.type === "out").reduce((a: number, t: any) => a + N(t.amount), 0);
      A.push({ id: "ring-" + today, lv: "info", e: "📊", t: "Ringkasan hari ini", b: "Masuk " + money(ci) + " • Keluar " + money(co), page: "dashboard" });
    }
  }
  return A.map((a) => ({ ...a, id: biz.id.slice(0, 8) + ":" + a.id, b: a.b + " — " + biz.name }));
}

async function runAll() {
  const { data: subs, error } = await sb.from("push_subscriptions").select("*");
  if (error) throw error;
  const byUser = new Map<string, any[]>();
  for (const s of subs || []) { if (!byUser.has(s.user_id)) byUser.set(s.user_id, []); byUser.get(s.user_id)!.push(s); }
  let users = 0, sent = 0;
  for (const [uid, list] of byUser) {
    const { data: bizs } = await sb.from("businesses").select("id,name,settings").eq("user_id", uid);
    const { date } = localNow(bizs?.[0]?.settings?.tz || list[0].tz || "Asia/Jakarta");
    const all: Alert[] = [];
    for (const b of bizs || []) { const l = localNow(b.settings?.tz || "Asia/Jakarta"); all.push(...await bizAlerts(b, l.date, l.min)); }
    if (!all.length) continue;
    const { data: done } = await sb.from("push_log").select("alert_id").eq("user_id", uid).eq("sent_on", date);
    const doneSet = new Set((done || []).map((r: any) => r.alert_id));
    const fresh = all.filter((a) => !doneSet.has(a.id));
    if (!fresh.length) continue;
    users++;
    const msgs = fresh.slice(0, 4).map((a) => ({ title: a.e + " " + a.t, body: a.b, page: a.page, tag: a.id }));
    if (fresh.length > 4) msgs.push({ title: "🔔 " + (fresh.length - 4) + " pemberitahuan lain", body: "Buka BukuKas untuk melihat semuanya.", page: "dashboard", tag: "more-" + date });
    for (const msg of msgs) for (const s of list) if (await send(s, msg)) sent++;
    await sb.from("push_log").upsert(fresh.map((a) => ({ user_id: uid, alert_id: a.id, sent_on: date })), { onConflict: "user_id,alert_id,sent_on", ignoreDuplicates: true });
  }
  await sb.from("push_log").delete().lt("sent_on", addDays(new Date().toISOString().slice(0, 10), -40));
  return { ok: true, users, sent, subscriptions: (subs || []).length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const c = await cfg();
    const body = await req.json().catch(() => ({}));
    if (body.test) {
      const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
      const { data, error } = await sb.auth.getUser(token);
      if (error || !data?.user) return json({ error: "unauthorized" }, 401);
      const { data: subs } = await sb.from("push_subscriptions").select("*").eq("user_id", data.user.id);
      let sent = 0;
      for (const s of subs || []) if (await send(s, { title: "🔔 BukuKas", body: "Notifikasi push dari server berfungsi! Pengingat tetap muncul walau aplikasi ditutup.", page: "dashboard", tag: "test" })) sent++;
      return json({ sent, devices: (subs || []).length });
    }
    if (req.headers.get("x-cron-secret") !== c.bukukas_cron_secret) return json({ error: "forbidden" }, 403);
    if (body.selftest) {
      const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]) as CryptoKeyPair;
      const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
      const enc = await encryptPayload(b64uEnc(raw), b64uEnc(crypto.getRandomValues(new Uint8Array(16))), te.encode("tes"));
      const vh = await vapidHeader("https://fcm.googleapis.com/fcm/send/x", c.bukukas_vapid_public, c.bukukas_vapid_private, c.bukukas_vapid_subject);
      return json({ ok: true, encrypted_bytes: enc.length, vapid: vh.startsWith("vapid t=") });
    }
    return json(await runAll());
  } catch (e: any) {
    console.error(e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
