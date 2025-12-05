/*
  # Create Initial Tables for Snapify

  1. New Tables
    - `UserProfile`
      - `id` (text, primary key) - matches Supabase Auth user ID
      - `name` (text, nullable)
      - `email` (text, nullable, unique)
      - `avatarUrl` (text, nullable)
      - `stripeCustomerId` (text, nullable)
      - `stripeSubscriptionId` (text, nullable)
      - `stripeSubscriptionStatus` (enum, nullable)
      - `createdAt` (timestamp with time zone)
      - `updatedAt` (timestamp with time zone)
    
    - `Video`
      - `id` (text, primary key)
      - `createdAt` (timestamp with time zone)
      - `updatedAt` (timestamp with time zone)
      - `title` (text)
      - `userId` (text, foreign key to UserProfile)
      - `sharing` (boolean, default false)
      - `delete_after_link_expires` (boolean, default false)
      - `shareLinkExpiresAt` (timestamp with time zone, nullable)
      - `linkShareSeo` (boolean, default false)
    
    - `StripeEvent`
      - `id` (text, primary key)
      - `api_version` (text, nullable)
      - `data` (jsonb)
      - `request` (jsonb, nullable)
      - `type` (text)
      - `object` (text)
      - `account` (text, nullable)
      - `created` (timestamp with time zone)
      - `livemode` (boolean)
      - `pending_webhooks` (integer)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
    - Add policies for public video sharing
*/

-- Create enum for Stripe subscription status
DO $$ BEGIN
  CREATE TYPE "StripeSubscriptionStatus" AS ENUM (
    'incomplete',
    'incomplete_expired',
    'trialing',
    'active',
    'past_due',
    'canceled',
    'unpaid',
    'paused'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create UserProfile table
CREATE TABLE IF NOT EXISTS "UserProfile" (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE,
  "avatarUrl" TEXT,
  "stripeCustomerId" TEXT,
  "stripeSubscriptionId" TEXT,
  "stripeSubscriptionStatus" "StripeSubscriptionStatus",
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create Video table
CREATE TABLE IF NOT EXISTS "Video" (
  id TEXT PRIMARY KEY,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  title TEXT NOT NULL,
  "userId" TEXT NOT NULL REFERENCES "UserProfile"(id) ON DELETE CASCADE,
  sharing BOOLEAN DEFAULT FALSE,
  delete_after_link_expires BOOLEAN DEFAULT FALSE,
  "shareLinkExpiresAt" TIMESTAMP WITH TIME ZONE,
  "linkShareSeo" BOOLEAN DEFAULT FALSE
);

-- Create index on userId for Video table
CREATE INDEX IF NOT EXISTS "Video_userId_idx" ON "Video"("userId");

-- Create StripeEvent table
CREATE TABLE IF NOT EXISTS "StripeEvent" (
  id TEXT PRIMARY KEY UNIQUE,
  api_version TEXT,
  data JSONB NOT NULL,
  request JSONB,
  type TEXT NOT NULL,
  object TEXT NOT NULL,
  account TEXT,
  created TIMESTAMP WITH TIME ZONE NOT NULL,
  livemode BOOLEAN NOT NULL,
  pending_webhooks INTEGER NOT NULL
);

-- Enable RLS
ALTER TABLE "UserProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Video" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StripeEvent" ENABLE ROW LEVEL SECURITY;

-- UserProfile policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'UserProfile' AND policyname = 'Users can view own profile'
  ) THEN
    CREATE POLICY "Users can view own profile"
      ON "UserProfile" FOR SELECT
      TO authenticated
      USING (auth.uid()::text = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'UserProfile' AND policyname = 'Users can insert own profile'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON "UserProfile" FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid()::text = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'UserProfile' AND policyname = 'Users can update own profile'
  ) THEN
    CREATE POLICY "Users can update own profile"
      ON "UserProfile" FOR UPDATE
      TO authenticated
      USING (auth.uid()::text = id)
      WITH CHECK (auth.uid()::text = id);
  END IF;
END $$;

-- Video policies
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'Video' AND policyname = 'Users can view own videos'
  ) THEN
    CREATE POLICY "Users can view own videos"
      ON "Video" FOR SELECT
      TO authenticated
      USING (auth.uid()::text = "userId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'Video' AND policyname = 'Anyone can view shared videos'
  ) THEN
    CREATE POLICY "Anyone can view shared videos"
      ON "Video" FOR SELECT
      TO anon, authenticated
      USING (sharing = true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'Video' AND policyname = 'Users can insert own videos'
  ) THEN
    CREATE POLICY "Users can insert own videos"
      ON "Video" FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid()::text = "userId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'Video' AND policyname = 'Users can update own videos'
  ) THEN
    CREATE POLICY "Users can update own videos"
      ON "Video" FOR UPDATE
      TO authenticated
      USING (auth.uid()::text = "userId")
      WITH CHECK (auth.uid()::text = "userId");
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'Video' AND policyname = 'Users can delete own videos'
  ) THEN
    CREATE POLICY "Users can delete own videos"
      ON "Video" FOR DELETE
      TO authenticated
      USING (auth.uid()::text = "userId");
  END IF;
END $$;

-- StripeEvent policies (service role only)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'StripeEvent' AND policyname = 'Only service role can access StripeEvent'
  ) THEN
    CREATE POLICY "Only service role can access StripeEvent"
      ON "StripeEvent" FOR ALL
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
