/* AdWall — connection settings
 *
 * Both values are required. Without them the site shows a setup message instead
 * of the wall. They are not secret: the anon/publishable key is protected by the
 * row-level security rules in supabase/schema.sql, so it is safe in a public repo.
 *
 * Where to find them: Supabase dashboard → Project Settings → API
 *    supabaseUrl  = "https://<project-ref>.supabase.co"
 *    supabaseKey  = the "anon" / "public" / "sb_publishable_..." key
 *                   (NOT the secret / service_role key)
 */
window.ADWALL_CONFIG = {
  supabaseUrl: "https://lqpoqwdmfhanlhztwcvj.supabase.co",
  supabaseKey: "sb_publishable_YuSEbCXG5b3awd4xXtAG3g_STwbNSe4",
  table: "ads_public",
  storageBucket: "ad-photos"
};
