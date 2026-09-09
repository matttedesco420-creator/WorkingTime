// ============================================================
// Supabase-Zugangsdaten
// ============================================================
// Trage hier die Werte aus deinem Supabase-Projekt ein:
// Supabase Dashboard → Project Settings → API
//   - "Project URL"        → SUPABASE_URL
//   - "anon" / "public" key → SUPABASE_ANON_KEY
//
// Der anon/public key ist bewusst öffentlich sichtbar (er landet im
// Browser) — der eigentliche Datenschutz kommt über die Row-Level-
// Security-Regeln aus supabase-schema.sql, die dafür sorgen, dass
// jede/r Nutzer:in nur die eigenen Daten lesen/schreiben kann.
//
// Solange SUPABASE_URL leer bleibt, läuft die App im lokalen Modus:
// kein Login, keine Cloud-Synchronisierung, alles bleibt nur auf
// diesem Gerät (localStorage) — genau wie zuvor.
// ============================================================

window.APP_CONFIG = {
  SUPABASE_URL: "https://wxmdhywlgtucgjmcamgb.supabase.co",
  SUPABASE_ANON_KEY: "sb_publishable_3ShYriAFDxFaWhxMmxw_Eg_jnc4fedu",
};
