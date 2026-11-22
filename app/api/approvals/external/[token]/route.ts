import { createClient } from "@/lib/supabase/server"
import { NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = await createClient()
    const { token } = await params

    // Get approval by external token
    const { data: approval, error: approvalError } = await supabase
      .from("approvals")
      .select(`
        *,
        bot:bots(
          id, name, role, avatar_color, department:departments(name)
        ),
        task:tasks(payload)
      `)
      .eq("external_trigger_token", token)
      .single()

    if (approvalError || !approval) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
        <head><title>Approval Not Found</title></head>
        <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F5F0E8;">
          <div style="text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 400px;">
            <div style="font-size: 48px; margin-bottom: 1rem;">❌</div>
            <h1 style="color: #2D2D2D; margin-bottom: 0.5rem;">Approval Not Found</h1>
            <p style="color: #6B6B6B;">This approval link is invalid or has expired.</p>
          </div>
        </body>
        </html>`,
        { status: 404, headers: { "Content-Type": "text/html" } }
      )
    }

    if (approval.status !== "pending") {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
        <head><title>Already Resolved</title></head>
        <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F5F0E8;">
          <div style="text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 400px;">
            <div style="font-size: 48px; margin-bottom: 1rem;">${approval.status === "approved" ? "✅" : "❌"}</div>
            <h1 style="color: #2D2D2D; margin-bottom: 0.5rem;">${approval.status === "approved" ? "Already Approved" : "Already Denied"}</h1>
            <p style="color: #6B6B6B;">This approval was ${approval.status} on ${new Date(approval.resolved_at || approval.updated_at).toLocaleString()}.</p>
            ${approval.resolution_note && `<p style="color: #6B6B6B; font-size: 14px;">Note: ${approval.resolution_note}</p>`}
          </div>
        </body>
        </html>`,
        { status: 200, headers: { "Content-Type": "text/html" } }
      )
    }

    // Check if expired
    if (new Date(approval.expires_at) < new Date()) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html>
        <head><title>Expired</title></head>
        <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F5F0E8;">
          <div style="text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 400px;">
            <div style="font-size: 48px; margin-bottom: 1rem;">⏰</div>
            <h1 style="color: #2D2D2D; margin-bottom: 0.5rem;">Approval Expired</h1>
            <p style="color: #6B6B6B;">This approval request expired on ${new Date(approval.expires_at).toLocaleString()}.</p>
          </div>
        </body>
        </html>`,
        { status: 200, headers: { "Content-Type": "text/html" } }
      )
    }

    // Render approval page
    const actionLabel = approval.action_type.replace(/_/g, " ").replace(/\b\w/g, (l: string) => l.toUpperCase())
    const isBlocking = approval.is_blocking

    return new NextResponse(
      `<!DOCTYPE html>
      <html>
      <head>
        <title>Approval Request - ${actionLabel}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          * { box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #F5F0E8; margin: 0; padding: 1rem; }
          .container { max-width: 480px; margin: 0 auto; }
          .card { background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.08); overflow: hidden; }
          .header { padding: 1.5rem; text-align: center; }
          .icon { width: 64px; height: 64px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 1rem; }
          .icon-yellow { background: #FFF3E0; color: #F57C00; }
          .icon-red { background: #FFEBEE; color: #C62828; }
          .icon-green { background: #E8F5E9; color: #2E7D32; }
          .icon-blue { background: #E3F2FD; color: #1565C0; }
          h1 { color: #2D2D2D; font-size: 1.25rem; font-weight: 600; margin: 0 0 0.5rem; }
          .subtitle { color: #6B6B6B; font-size: 0.875rem; }
          .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; margin-top: 0.75rem; }
          .badge-yellow { background: #FFF3E0; color: #F57C00; }
          .badge-blue { background: #E3F2FD; color: #1565C0; }
          .content { padding: 0 1.5rem 1.5rem; }
          .section { margin-bottom: 1.5rem; }
          .section-title { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6B6B6B; margin-bottom: 0.5rem; }
          .preview-box { background: #F5F0E8; border: 1px solid #E8E0D0; border-radius: 8px; padding: 1rem; font-family: monospace; font-size: 0.875rem; color: #2D2D2D; white-space: pre-wrap; overflow-x: auto; }
          .bot-info { display: flex; align-items: center; gap: 0.75rem; padding: 0.75rem; background: #F5F0E8; border-radius: 8px; }
          .bot-avatar { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: 600; font-size: 1rem; }
          .bot-name { font-weight: 600; color: #2D2D2D; }
          .bot-role { font-size: 0.75rem; color: #6B6B6B; text-transform: capitalize; }
          .actions { display: flex; gap: 0.75rem; padding-top: 1rem; border-top: 1px solid #E8E0D0; }
          .btn { flex: 1; padding: 0.875rem 1rem; border: none; border-radius: 10px; font-size: 1rem; font-weight: 600; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; }
          .btn-approve { background: #2E7D32; color: white; }
          .btn-approve:hover { background: #1B5E20; }
          .btn-deny { background: #C62828; color: white; }
          .btn-deny:hover { background: #B71C1C; }
          .btn:disabled { opacity: 0.6; cursor: not-allowed; }
          .loading { display: inline-block; width: 16px; height: 16px; border: 2px solid transparent; border-top-color: currentColor; border-radius: 50%; animation: spin 0.8s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
          .footer { padding: 1rem 1.5rem; text-align: center; color: #6B6B6B; font-size: 0.75rem; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="card">
            <div class="header">
              <div class="icon icon-yellow">⚠️</div>
              <h1>Approval Request</h1>
              <p class="subtitle">${actionLabel}</p>
              <span class="badge ${isBlocking ? "badge-yellow" : "badge-blue"}">
                ${isBlocking ? "⏸ Blocking - Bot is waiting" : "▶ Non-blocking - Bot continues working"}
              </span>
            </div>

            <div class="content">
              <div class="section">
                <div class="section-title">What will happen</div>
                <div class="preview-box">${approval.action_preview}</div>
              </div>

              <div class="section">
                <div class="section-title">Requested by</div>
                <div class="bot-info">
                  <div class="bot-avatar" style="background: ${approval.bot?.avatar_color || "#6366F1"}">
                    ${approval.bot?.name?.charAt(0).toUpperCase() || "🤖"}
                  </div>
                  <div>
                    <div class="bot-name">${approval.bot?.name || "Unknown Bot"}</div>
                    <div class="bot-role">${approval.bot?.role || "worker"} ${approval.bot?.department ? `· ${approval.bot.department.name}` : ""}</div>
                  </div>
                </div>
              </div>

              <div class="section">
                <div class="section-title">Expires</div>
                <div style="color: #6B6B6B; font-size: 0.875rem;">
                  ${new Date(approval.expires_at).toLocaleString()}
                </div>
              </div>

              <div class="actions">
                <button class="btn btn-approve" id="approveBtn" onclick="handleAction('approved')">
                  <span id="approveText">✅ Approve</span>
                </button>
                <button class="btn btn-deny" id="denyBtn" onclick="handleAction('denied')">
                  <span id="denyText">❌ Deny</span>
                </button>
              </div>
            </div>

            <div class="footer">
              Alpha AI Teammates • This link is single-use and expires automatically
            </div>
          </div>
        </div>

        <script>
          let isProcessing = false;

          async function handleAction(action) {
            if (isProcessing) return;
            isProcessing = true;

            const approveBtn = document.getElementById('approveBtn');
            const denyBtn = document.getElementById('denyBtn');
            const approveText = document.getElementById('approveText');
            const denyText = document.getElementById('denyText');

            approveBtn.disabled = true;
            denyBtn.disabled = true;

            if (action === 'approved') {
              approveText.innerHTML = '<span class="loading"></span> Approving...';
            } else {
              denyText.innerHTML = '<span class="loading"></span> Denying...';
            }

            try {
              const response = await fetch(window.location.href, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: action })
              });

              const result = await response.json();

              if (!response.ok) {
                throw new Error(result.error || 'Failed to process approval');
              }

              // Show success
              if (action === 'approved') {
                approveText.textContent = '✅ Approved!';
                denyBtn.style.display = 'none';
              } else {
                denyText.textContent = '❌ Denied';
                approveBtn.style.display = 'none';
              }

              // Refresh page after 1.5s to show final state
              setTimeout(() => window.location.reload(), 1500);
            } catch (error) {
              alert('Error: ' + error.message);
              approveBtn.disabled = false;
              denyBtn.disabled = false;
              approveText.textContent = '✅ Approve';
              denyText.textContent = '❌ Deny';
            }
          }
        </script>
      </body>
      </html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    )
  } catch (error) {
    console.error("External approval error:", error)
    return new NextResponse(
      `<!DOCTYPE html>
      <html>
      <head><title>Error</title></head>
      <body style="font-family: system-ui; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #F5F0E8;">
        <div style="text-align: center; padding: 2rem; background: white; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); max-width: 400px;">
          <div style="font-size: 48px; margin-bottom: 1rem;">⚠️</div>
          <h1 style="color: #2D2D2D; margin-bottom: 0.5rem;">Something went wrong</h1>
          <p style="color: #6B6B6B;">Unable to load approval page.</p>
        </div>
      </body>
      </html>`,
      { status: 500, headers: { "Content-Type": "text/html" } }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const supabase = await createClient()
    const { token } = await params
    const body = await request.json()
    const { status, resolution_note } = body

    if (!["approved", "denied"].includes(status)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 })
    }

    // Get approval by external token
    const { data: approval, error: approvalError } = await supabase
      .from("approvals")
      .select("*")
      .eq("external_trigger_token", token)
      .single()

    if (approvalError || !approval) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 })
    }

    if (approval.status !== "pending") {
      return NextResponse.json({ error: "Approval already resolved" }, { status: 400 })
    }

    // Check expiry
    if (new Date(approval.expires_at) < new Date()) {
      return NextResponse.json({ error: "Approval expired" }, { status: 400 })
    }

    // Transition using state machine (no user_id for external)
    const { data: updatedApproval, error: transitionError } = await supabase
      .rpc("transition_approval", {
        p_approval_id: approval.id,
        p_new_status: status,
        p_actor_id: null, // External actor
        p_note: resolution_note,
      })

    if (transitionError) {
      return NextResponse.json({ error: transitionError.message }, { status: 400 })
    }

    return NextResponse.json({ approval: updatedApproval })
  } catch (error) {
    console.error("External approval PATCH error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}