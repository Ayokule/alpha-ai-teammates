"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react"
import { cn } from "@/lib/utils"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [activeTab, setActiveTab] = useState("signin")

  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess("")

    try {
      if (isSignUp) {
        if (password !== confirmPassword) {
          throw new Error("Passwords do not match")
        }
        if (password.length < 8) {
          throw new Error("Password must be at least 8 characters")
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`
          }
        })
        if (error) throw error
        setSuccess("Check your email for confirmation link")
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        window.location.href = "/dashboard"
      }
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleOAuthSignIn = async (provider: "github" | "google") => {
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback`
        }
      })
      if (error) throw error
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  const togglePasswordVisibility = () => setShowPassword(!showPassword)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-muted/50 via-background to-muted/50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Alpha</h1>
          <p className="text-muted-foreground mt-2">
            {isSignUp ? "Create your workspace to get started" : "Sign in to your workspace"}
          </p>
        </div>

        <Card className="w-full">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {isSignUp ? "Create Account" : "Welcome Back"}
            </CardTitle>
            <CardDescription>
              {isSignUp
                ? "Create your Alpha workspace to get started with AI teammates"
                : "Sign in to access your AI team dashboard"}
            </CardDescription>
          </CardHeader>

          <CardContent className="pt-0">
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert variant="default" className="mb-4 border-green-500/50 bg-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <AlertDescription className="text-green-700">{success}</AlertDescription>
              </Alert>
            )}

            {/* OAuth Buttons */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Button
                variant="outline"
                onClick={() => handleOAuthSignIn("github")}
                disabled={loading}
                className="w-full"
              >
                <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.305-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.232 3.301-1.232 3.301-1.232.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 11.797 24 7.297 24 12c0-6.627-5.373-12-12-12z"/>
                </svg>
                GitHub
              </Button>
              <Button
                variant="outline"
                onClick={() => handleOAuthSignIn("google")}
                disabled={loading}
                className="w-full"
              >
                <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.28H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.36z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.13-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.02-3.02C15.14 2.09 13.12 1 12 1c-3.86 0-7 2.34-8.43 5.54l2.85 2.14.81.62z"/>
                </svg>
                Google
              </Button>
            </div>

            <div className="relative mb-6">
              <Separator className="mb-4" />
              <span className="absolute top-[-0.5rem] left-1/2 -translate-x-1/2 bg-card px-2 text-xs text-muted-foreground">
                or continue with email
              </span>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={loading}
                    aria-describedby="email-error"
                  />
                </div>
                {error && <p id="email-error" className="text-sm text-destructive" role="alert">{error}</p>}
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {isSignUp && (
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                  )}
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={loading}
                    aria-describedby="password-error"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={togglePasswordVisibility}
                    disabled={loading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                {isSignUp && (
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Confirm password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>
                )}
                {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
              </div>

              {isSignUp && (
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading} size="lg">
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Please wait...
                  </span>
                ) : (
                  isSignUp ? "Create Account" : "Sign In"
                )}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-6">
              {isSignUp ? "Already have an account? " : "Don't have an account? "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(!isSignUp)
                  setError("")
                  setSuccess("")
                }}
                className="text-primary font-medium hover:underline"
              >
                {isSignUp ? "Sign In" : "Sign Up"}
              </button>
            </p>

            <p className="text-center text-xs text-muted-foreground mt-4">
              By continuing, you agree to our{" "}
              <a href="/terms" className="text-primary hover:underline">Terms of Service</a>
              {" and "}
              <a href="/privacy" className="text-primary hover:underline">Privacy Policy</a>
            </p>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by Alpha AI Teammates
        </p>
      </div>
    </div>
  )
}