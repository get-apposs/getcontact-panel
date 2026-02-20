import { createClient } from "@supabase/supabase-js";

// Te 2 zmienne ustawisz jako ENV w Netlify (frontend):
// SUPABASE_URL, SUPABASE_ANON_KEY
const SUPABASE_URL = import.meta.env?.SUPABASE_URL || window.SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env?.SUPABASE_ANON_KEY || window.SUPABASE_ANON_KEY;

// Fallback: jeśli Netlify nie poda import.meta.env, wstrzykniemy przez <script> (opcjonalnie).
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn("Brak SUPABASE_URL / SUPABASE_ANON_KEY. Ustaw w Netlify ENV i/lub wstrzyknij w index.html.");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const el = (id) => document.getElementById(id);

const loginCard = el("loginCard");
const appCard = el("appCard");
const loginMsg = el("loginMsg");
const who = el("who");
const logoutBtn = el("logoutBtn");

const landingSelect = el("landingSelect");
const statusFilter = el("statusFilter");
const refreshBtn = el("refreshBtn");
const csvBtn = el("csvBtn");
const tbody = el("tbody");
const info = el("info");

function fmtDate(iso) {
  try { return new Date(iso).toLocaleString("pl-PL"); } catch { return iso; }
}

function escapeCsv(v){
  const s = (v ?? "").toString();
  if (/[",\n]/.test(s)) return `"${s.replaceAll('"','""')}"`;
  return s;
}

async function setUIFromSession() {
  const { data } = await supabase.auth.getSession();
  const user = data.session?.user;

  if (!user) {
    loginCard.classList.remove("hide");
    appCard.classList.add("hide");
    who.classList.add("hide");
    logoutBtn.classList.add("hide");
    return;
  }

  who.textContent = user.email || user.id;
  who.classList.remove("hide");
  logoutBtn.classList.remove("hide");

  loginCard.classList.add("hide");
  appCard.classList.remove("hide");

  await loadLandings();
  await loadLeads();
}

async function loadLandings() {
  // RLS: zwróci tylko landingi klienta
  const { data, error } = await supabase
    .from("landings")
    .select("id, name, public_path, active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    info.textContent = "Błąd pobierania landingów.";
    console.error(error);
    return;
  }

  landingSelect.innerHTML = "";
  (data || []).forEach((l) => {
    const opt = document.createElement("option");
    const label = l.name ? `${l.name} (${l.public_path})` : l.public_path;
    opt.value = l.id;
    opt.textContent = label + (l.active ? "" : " [OFF]");
    landingSelect.appendChild(opt);
  });

  if (!data?.length) {
    info.textContent = "Brak landingów przypisanych do konta.";
  }
}

async function loadLeads() {
  tbody.innerHTML = "";
  const landingId = landingSelect.value;
  if (!landingId) return;

  const status = statusFilter.value;

  let q = supabase
    .from("leads")
    .select("id, created_at, name, email, phone, status")
    .eq("landing_id", landingId)
    .order("created_at", { ascending: false })
    .limit(200);

  if (status) q = q.eq("status", status);

  const { data, error } = await q;

  if (error) {
    info.textContent = "Błąd pobierania leadów.";
    console.error(error);
    return;
  }

  info.textContent = `Leadów: ${data?.length || 0}`;

  (data || []).forEach((r) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td>${fmtDate(r.created_at)}</td>
      <td>${r.name || ""}</td>
      <td>${r.email || ""}</td>
      <td>${r.phone || ""}</td>
      <td>${r.status || "new"}</td>
      <td>
        <select data-id="${r.id}" class="statusSel">
          <option value="new" ${r.status === "new" ? "selected" : ""}>new</option>
          <option value="seen" ${r.status === "seen" ? "selected" : ""}>seen</option>
          <option value="contacted" ${r.status === "contacted" ? "selected" : ""}>contacted</option>
        </select>
      </td>
    `;
    tbody.appendChild(tr);
  });

  // bind status change
  document.querySelectorAll(".statusSel").forEach((s) => {
    s.addEventListener("change", async (e) => {
      const id = e.target.getAttribute("data-id");
      const value = e.target.value;

      const { error: updErr } = await supabase
        .from("leads")
        .update({ status: value })
        .eq("id", id);

      if (updErr) {
        alert("Nie udało się zmienić statusu.");
        console.error(updErr);
        await loadLeads();
      }
    });
  });
}

async function exportCSV() {
  const landingId = landingSelect.value;
  if (!landingId) return;

  const status = statusFilter.value;

  let q = supabase
    .from("leads")
    .select("created_at, name, email, phone, status")
    .eq("landing_id", landingId)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (status) q = q.eq("status", status);

  const { data, error } = await q;
  if (error) return alert("Błąd eksportu.");

  const header = ["created_at","name","email","phone","status"];
  const rows = [header.join(",")].concat(
    (data || []).map(r => header.map(k => escapeCsv(r[k])).join(","))
  );

  const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "leads.csv";
  a.click();
  URL.revokeObjectURL(a.href);
}

// --- events ---
el("loginBtn").addEventListener("click", async () => {
  loginMsg.textContent = "";
  const email = el("email").value.trim();
  const password = el("pass").value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginMsg.textContent = "Błędny email lub hasło.";
    console.error(error);
    return;
  }
  await setUIFromSession();
});

logoutBtn.addEventListener("click", async () => {
  await supabase.auth.signOut();
  await setUIFromSession();
});

landingSelect.addEventListener("change", loadLeads);
statusFilter.addEventListener("change", loadLeads);
refreshBtn.addEventListener("click", async () => { await loadLandings(); await loadLeads(); });
csvBtn.addEventListener("click", exportCSV);

// init
await setUIFromSession();
supabase.auth.onAuthStateChange(() => setUIFromSession());
