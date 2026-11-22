"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Loader2, CheckCircle2, AlertCircle, Mail, Users } from "lucide-react"
import { useSearchParams } from "next/navigation"

export default function AcceptInvitationPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error" | "idle">("loading")
  const [message, setMessage] = useState("")
  const [invitationDetails, setInvitationDetails] = useState<{
    email?: string
    workspace_name?: string
    role?: string
  }>({})
  const searchParams = useSearchParams()
  const token = searchParams.get("token")

  const supabase = createClient()

  useEffect(() => {
    const acceptInvitation = async () => {
      if (!token) {
        setStatus("error")
        setMessage("Invalid invitation link")
        return
      }

      try {
        // First, get invitation details
        const { data: invitation, error: inviteError } = await supabase
          .from("workspace_invitations")
          .select(`
            email,
            role,
            workspace:workspaces(name),
            expires_at
          `)
          .eq("token", token)
          .single()

        if (inviteError || !invitation) {
          setStatus("error")
          setMessage("Invalid or expired invitation")
          return
        }

        // Check if expired
        if (new Date(invitation.expires_at) < new Date()) {
          setStatus("error")
          setMessage("This invitation has expired")
          return
        }

        setInvitationDetails({
          email: invitation.email,
          workspace_name: invitation.workspace?.name,
          role: invitation.role,
        })

        // Check if user is logged in
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
          setStatus("idle")
          return
        }

        // Check if email matches
        if (user.email !== invitation.email) {
          setStatus("error")
          setMessage(`This invitation is for ${invitation.email}. Please log in with that email.`)
          return
        }

        // Accept invitation
        const { error } = await supabase.rpc("accept_invitation", { p_token: token })

        if (error) {
          setStatus("error")
          setMessage(error.message)
          return
        }

        setStatus("success")
        setMessage(`Welcome to ${invitation.workspace?.name}!`)

      } catch (err) {
        console.error("Accept invitation error:", err)
        setStatus("error")
        setMessage("Failed to accept invitation")
      }
    }

    acceptInvitation()
  }, [token])

  const handleSignIn = () => {
    window.location.href = `/login?redirect=/accept-invitation?token=${token}`
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (status === "error") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <CardTitle>Invalid Invitation</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button variant="outline" onClick={() => window.location.href = "/"}>
              Go Home
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "success") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <CardTitle>Invitation Accepted!</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button onClick={() => window.location.href = "/dashboard"}>
              Go to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Idle state - user needs to sign in
  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex items-center justify-center gap-2">
            <Mail className="h-10 w-10 text-primary" />
            <Users className="h-10 w-10 text-primary" />
          </div>
          <CardTitle>You've Been Invited!</CardTitle>
          <CardDescription>
            {invitationDetails.workspace_name && (
              <>Join <strong>{invitationDetails.workspace_name}</strong> as {invitationDetails.role}</>
            )}
            {invitationDetails.email && (
              <p className="mt-2 text-sm text-muted-foreground">
                Invitation sent to: {invitationDetails.email}
              </p>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              You need to sign in with the email this invitation was sent to.
            </AlertDescription>
          </Alert>
          <Button className="w-full" size="lg" onClick={handleSignIn}>
            Sign In to Accept
          </Button>
          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <a href={`/login?redirect=/accept-invitation?token=${token}`} className="text-primary hover:underline">
              Sign up
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}