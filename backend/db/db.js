import dotenv from "dotenv";
import { createClient } from '@supabase/supabase-js'

dotenv.config();

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;
// For admin tasks (migrations, background jobs), use service role key stored securely on the server:
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

 export const Supabase = createClient(url, serviceRole ?? anonKey); 

