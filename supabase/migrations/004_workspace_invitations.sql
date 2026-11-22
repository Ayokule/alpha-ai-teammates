-- Workspace Invitations Migration
-- Migration: 2026-11-22

CREATE TABLE workspace_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    role workspace_role NOT NULL DEFAULT 'member',
    token UUID NOT NULL DEFAULT gen_random_uuid(),
    invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    accepted_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, email)
);

CREATE INDEX idx_workspace_invitations_workspace_id ON workspace_invitations(workspace_id);
CREATE INDEX idx_workspace_invitations_token ON workspace_invitations(token);
CREATE INDEX idx_workspace_invitations_email ON workspace_invitations(email);

-- RLS Policies
ALTER TABLE workspace_invitations ENABLE ROW LEVEL SECURITY;

-- Members can view invitations for their workspace
CREATE POLICY "workspace_invitations_select" ON workspace_invitations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = workspace_invitations.workspace_id
        AND user_id = auth.uid()
    )
);

-- Owner/Admin can create invitations
CREATE POLICY "workspace_invitations_insert" ON workspace_invitations FOR INSERT
WITH CHECK (
    EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = workspace_invitations.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- Owner/Admin can update (revoke) invitations
CREATE POLICY "workspace_invitations_update" ON workspace_invitations FOR UPDATE
USING (
    EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = workspace_invitations.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- Owner/Admin can delete invitations
CREATE POLICY "workspace_invitations_delete" ON workspace_invitations FOR DELETE
USING (
    EXISTS (
        SELECT 1 FROM workspace_members
        WHERE workspace_id = workspace_invitations.workspace_id
        AND user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
);

-- Function to accept invitation
CREATE OR REPLACE FUNCTION accept_invitation(p_token UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_invitation RECORD;
    v_user_id UUID;
BEGIN
    -- Get invitation
    SELECT * INTO v_invitation
    FROM workspace_invitations
    WHERE token = p_token
    AND expires_at > NOW()
    AND accepted_at IS NULL;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invitation';
    END IF;

    -- Check if user exists
    SELECT id INTO v_user_id FROM auth.users WHERE email = v_invitation.email;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found. Please sign up first.';
    END IF;

    -- Add user to workspace
    INSERT INTO workspace_members (workspace_id, user_id, role)
    VALUES (v_invitation.workspace_id, v_user_id, v_invitation.role)
    ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = v_invitation.role;

    -- Mark invitation as accepted
    UPDATE workspace_invitations
    SET accepted_at = NOW()
    WHERE token = p_token;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION accept_invitation TO authenticated;