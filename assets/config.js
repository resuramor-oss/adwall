/* AdWall — connection settings
 *
 * Leave these empty to run the site in local demo mode (ads saved in the browser).
 * Fill both in to make the wall shared through Supabase. The anon key is meant to
 * be public: it is protected by the row-level security rules in supabase/schema.sql.
 *
 * Where to find them: Supabase dashboard → Project Settings → API
 *    supabaseUrl  = "https://<project-ref>.supabase.co"
 *    supabaseKey  = the "anon / public" key (NOT the service_role key)
 */
window.ADWALL_CONFIG = {
  supabaseUrl: "",
  supabaseKey: "",
  table: "ads_public",
  storageBucket: "ad-photos"
};
