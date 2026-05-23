-- ============================================================
-- AI-Native Chat System - PostgreSQL + pgvector Init Script
-- ============================================================
-- This script runs automatically when the postgres container first starts.
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "vector";

-- Grant permissions to the minichat user
GRANT ALL PRIVILEGES ON DATABASE minichat TO minichat;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO minichat;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO minichat;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO minichat;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO minichat;
GRANT EXECUTE ON ALL PROCEDURES IN SCHEMA public TO minichat;

-- Create vector search index (optional optimization, applied after Prisma migrations)
-- Note: Vector indexes should be created after tables exist.
-- Prisma will handle table creation via migrations.
-- This script only handles extension and permission setup.
