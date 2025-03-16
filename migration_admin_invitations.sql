-- Create admin_invitations table
CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  created_by UUID NOT NULL REFERENCES public.admins(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used BOOLEAN DEFAULT false NOT NULL
);

-- Create index for email lookups
CREATE INDEX IF NOT EXISTS admin_invitations_email_idx ON public.admin_invitations(email);

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS admin_invitations_token_idx ON public.admin_invitations(token); 