import { createClient } from "@supabase/supabase-js"

const supabaseUrl = 'https://vzfndlhoouspepyiwkxi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ6Zm5kbGhvb3VzcGVweWl3a3hpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEyNzU4NTksImV4cCI6MjA2Njg1MTg1OX0.rkTqI3QA1YWd2NzPfKtpxfiqgyja0g8DJAfM9W1KJGo'

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY environment variables.")
}

// Create a single supabase client for the client-side
export const supabase = createClient(supabaseUrl, supabaseAnonKey)
