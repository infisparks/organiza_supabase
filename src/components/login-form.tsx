"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"

export default function LoginForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Check and redirect if the user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        // If a session exists, perform the role check to redirect them correctly
        handleRoleRedirect(session.user.id);
      }
    };
    checkUser();
  }, [router]);
  
  // New helper function to check role and redirect
  const handleRoleRedirect = async (userId: string) => {
    // Note: We don't call setLoading(true) here because it's already set in handleLogin
    // We only set it to false on completion if it's the final action.
    
    // Check if the user ID exists in the 'companies' table
    const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("user_id")
        .eq("user_id", userId)
        .single();
        
    setLoading(false); // Reset loading after redirect check

    if (!companyError && companyData) {
        // Company User: Redirect to dashboard
        router.replace("/company/dashboard");
    } else {
        // Regular User (or no company profile found): Redirect to home
        router.replace("/");
    }
  }

  // FIX: Changed React.FormFormEvent to React.FormEvent
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) throw signInError
      
      const userId = data.user?.id;
      if (!userId) throw new Error("Authentication succeeded but user ID is missing.");
      
      toast({
        title: "Logged in successfully!",
        variant: "success",
      })
      
      // Perform the role check and conditional redirect
      await handleRoleRedirect(userId);

    } catch (err: any) {
      setError(err.message || "Login failed. Please check your credentials.")
      toast({
        title: "Login Failed",
        description: err.message || "Please check your credentials.", 
        variant: "destructive",
      })
      // If login fails, loading must be set to false immediately.
      setLoading(false);
    } 
    // The handleRoleRedirect function handles the final setLoading(false) on success.
  }

  // FIX: Added 'finally' block to handle loading state in Google login
  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      // Note: For OAuth, the role check happens on the callback route.
      const { error } = await supabase.auth.signInWithOAuth({ 
          provider: 'google', 
          options: { 
              redirectTo: `${window.location.origin}/auth/callback` 
          } 
      })
      if (error) throw error
    } catch (err: any) {
      setError(err.message || 'Google login failed.')
      toast({
        title: 'Google Login Failed',
        description: err.message || 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      // Ensure loading is reset if redirection fails or an error occurs locally
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-gray-900">Welcome Back</CardTitle>
          <CardDescription className="text-gray-600">Sign in to your account</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-6">
            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm p-3 bg-red-50 rounded-md border border-red-200">
                <AlertCircle className="h-4 w-4" />
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="m@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <Button type="submit" className="w-full h-11" disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {loading ? "Signing In..." : "Login"}
            </Button>
          </form>
          <div className="mt-4 flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              className="w-full h-11 flex items-center justify-center gap-2"
              onClick={handleGoogleLogin}
              disabled={loading}
            >
              <svg width="20" height="20" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <g clipPath="url(#clip0_17_40)">
                  <path d="M47.5 24.5C47.5 22.6 47.3 20.8 47 19H24V29.1H37.4C36.7 32.2 34.7 34.7 31.8 36.4V42.1H39.5C44 38.1 47.5 32.1 47.5 24.5Z" fill="#4285F4"/>
                  <path d="M24 48C30.6 48 36.1 45.9 39.5 42.1L31.8 36.4C29.9 37.6 27.3 38.4 24 38.4C17.7 38.4 12.2 34.3 10.3 28.7H2.3V34.6C5.7 41.1 14.1 48 24 48Z" fill="#34A853"/>
                  <path d="M10.3 28.7C9.7 26.9 9.4 24.9 9.4 23C9.4 21.1 9.7 19.1 10.3 17.3V11.4H2.3C0.8 14.3 0 17.6 0 21C0 24.4 0.8 27.7 2.3 30.6L10.3 28.7Z" fill="#FBBC05"/>
                  <path d="M24 9.6C27.7 9.6 30.7 10.9 32.8 12.8L39.7 6C36.1 2.7 30.6 0 24 0C14.1 0 5.7 6.9 2.3 13.4L10.3 17.3C12.2 11.7 17.7 9.6 24 9.6Z" fill="#EA4335"/>
                </g>
                <defs>
                  <clipPath id="clip0_17_40">
                    <rect width="48" height="48" fill="white"/>
                  </clipPath>
                </defs>
              </svg>
              {loading ? 'Redirecting...' : 'Sign in with Google'}
            </Button>
          </div>
          <p className="mt-6 text-center text-sm text-gray-600">
            Don't have an account?{" "}
            <Link href="/register" className="font-medium text-blue-600 hover:underline">
              Register
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}