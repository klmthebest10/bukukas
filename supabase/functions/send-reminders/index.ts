// BukuKas Pro — Edge Function "send-reminders"
// Dipanggil pg_cron tiap 15 menit. Menghitung pengingat setiap usaha (stok menipis,
// hutang/piutang jatuh tempo, anggaran, target, pengingat harian) lalu mengirim Web Push
// ke semua perangkat pengguna — tetap muncul walau aplikasi ditutup.
//   POST {}               + header x-cron-secret  -> jalankan semua pengingat
//   POST {"test":true}    + Authorization user JWT -> kirim notifikasi uji ke perangkat pengguna
//   POST {"selftest":true}+ header x-cron-secret  -> cek konfigurasi & enkripsi push
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, "Content-Type": "application/json" } });

type Cfg = Record<string, string>;
let CFG: Cfg | null = null;
async function cfg(): Promise<Cfg> {
  if (CFG) return CFG;
  const { data, error } = await sb.rpc("get_push_config");
  if (error) throw error;
  CFG = data as Cfg;
  webpush.setVapidDetails(CFG.bukukas_vapid_subject, CFG.bukukas_vapid_public, CFG.bukukas_vapid_private);
  return CFG;
}

const N = (v: unknown) => Number(v) || 0;
const DEF = { stok: true, piutang: true, hutang: true, anggaran: true, catat: true, harian: true, ringkasan: false, target: true, push: false, jam: "19:00", hari_jatuh_tempo: 3 };
const MODS = { kasir: true, stok: true, hutang: true, harian: false, anggaran: true };
function localNow(tz: string) {
  let f: Intl.DateTimeFormat;
  try { f = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }); }
  catch { f = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }); }
  const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
  return { date: `${p.year}-${p.month}-${p.day}`, min: (N(p.hour) % 24) * 60 + N(p.minute) };
}
const addDays = (s: string, n: number) => { const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const diffDays = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / 864e5);
const fmtDate = (s: string) => new Date(s + "T00:00:00Z").toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const numf = (n: number) => N(n).toLocaleString("id-ID", { maximumFractionDigits: 2 });

type Alert = { id: string; e: string; t: string; b: string; page: string; lv: string };

async function bizAlerts(biz: any, today: string, nowMin: number): Promise<Alert[]> {
  const st = biz.settings || {}, ns = { ...DEF, ...(st.notif || {}) }, m = { ...MODS, ...(st.mods || {}) };
  if (!ns.push) return [];
  const cur = biz.currency || "IDR";
  const money = (n: number) => { try { return new Intl.NumberFormat("id-ID", { style: "currency", currency: cur, maximumFractionDigits: cur === "IDR" || cur === "KRW" ? 0 : 2 }).format(N(n)); } catch { return "Rp " + Math.round(N(n)).toLocaleString("id-ID"); } };
  const monthStart = today.slice(0, 8) + "01";
  const id = biz.id;
  const [P, D, Bu, C, T, L, K] = await Promise.all([
    sb.from("products").select("id,name,stock,min_stock,unit,track_stock,active").eq("business_id", id),
    sb.from("debts").select("id,kind,amount,paid,due_date,contact_id,contact_name").eq("business_id", id),
    sb.from("budgets").select("id,category_id,amount").eq("business_id", id),
    sb.from("categories").select("id,name").eq("business_id", id),
    sb.from("transactions").select("date,type,amount,category_id").eq("business_id", id).gte("date", monthStart),
    sb.from("production_logs").select("id").eq("business_id", id).eq("date", today).limit(1),
    sb.from("contacts").select("id,name").eq("business_id", id),
  ]);
  const prods = P.data || [], debts = D.data || [], buds = Bu.data || [], tx = T.data || [];
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

async function send(sub: any, payload: Record<string, unknown>) {
  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 6 * 3600, urgency: "normal" });
    await sb.from("push_subscriptions").update({ last_ok: new Date().toISOString() }).eq("id", sub.id);
    return true;
  } catch (e: any) {
    if (e?.statusCode === 404 || e?.statusCode === 410) await sb.from("push_subscriptions").delete().eq("id", sub.id);
    else console.error("push gagal", e?.statusCode, e?.body || e?.message);
    return false;
  }
}

async function runAll() {
  const { data: subs, error } = await sb.from("push_subscriptions").select("*");
  if (error) throw error;
  const byUser = new Map<string, any[]>();
  for (const s of subs || []) { if (!byUser.has(s.user_id)) byUser.set(s.user_id, []); byUser.get(s.user_id)!.push(s); }
  let users = 0, sent = 0;
  for (const [uid, list] of byUser) {
    const { data: bizs } = await sb.from("businesses").select("id,name,currency,settings").eq("user_id", uid);
    const { date, min } = localNow(bizs?.[0]?.settings?.tz || list[0].tz || "Asia/Jakarta");
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
  // bersihkan log lama (> 40 hari)
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
      const kp = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
      const raw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
      const b64u = (u: Uint8Array) => btoa(String.fromCharCode(...u)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
      try {
        const r = await webpush.generateRequestDetails({ endpoint: "https://fcm.googleapis.com/fcm/send/selftest", keys: { p256dh: b64u(raw), auth: b64u(crypto.getRandomValues(new Uint8Array(16))) } }, "tes");
        return json({ ok: true, encrypted_bytes: (r.body as Uint8Array).length, has_vapid_header: String(r.headers.Authorization || "").startsWith("vapid") });
      } catch (e: any) { return json({ ok: false, error: String(e?.message || e) }, 500); }
    }
    return json(await runAll());
  } catch (e: any) {
    console.error(e);
    return json({ error: String(e?.message || e) }, 500);
  }
});
