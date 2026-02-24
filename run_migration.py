"""
Standalone migration script — applies V2 hybrid embedding schema changes.
Run: .venv/bin/python3 run_migration.py
"""
import sqlalchemy as sa
import sys

DB_URL = "postgresql://zaytri_user:your_secure_password@localhost:5432/zaytri_db"

def main():
    print("Connecting to zaytri_db...")
    try:
        engine = sa.create_engine(DB_URL, connect_args={"connect_timeout": 10})
        conn = engine.connect()
    except Exception as e:
        print(f"❌ Cannot connect to DB: {e}")
        sys.exit(1)

    print("✅ Connected.\n")

    # ── Step 1: Check & fix userplan enum ──
    r = conn.execute(sa.text("SELECT typname FROM pg_type WHERE typname = 'userplan'")).fetchone()
    if r:
        print("⚠️  userplan enum already exists, dropping it first...")
        conn.execute(sa.text("DROP TYPE IF EXISTS userplan CASCADE"))
        conn.commit()
        print("   Dropped old userplan enum.")

    print("Creating userplan enum ('free', 'pro')...")
    conn.execute(sa.text("CREATE TYPE userplan AS ENUM ('free', 'pro')"))
    conn.commit()
    print("✅ userplan enum created.\n")

    # ── Step 2: Add plan column to users ──
    r = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='users' AND column_name='plan'"
    )).fetchone()
    if r:
        print("⚠️  users.plan column already exists, skipping.")
    else:
        print("Adding 'plan' column to users table...")
        conn.execute(sa.text("ALTER TABLE users ADD COLUMN plan userplan NOT NULL DEFAULT 'free'"))
        conn.commit()
        print("✅ users.plan column added (default: 'free').\n")

    # ── Step 3: Add embedding_provider to document_embeddings ──
    r = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='document_embeddings' AND column_name='embedding_provider'"
    )).fetchone()
    if r:
        print("⚠️  embedding_provider column already exists, skipping.")
    else:
        print("Adding 'embedding_provider' column to document_embeddings...")
        conn.execute(sa.text(
            "ALTER TABLE document_embeddings ADD COLUMN embedding_provider VARCHAR(50) DEFAULT 'ollama'"
        ))
        conn.commit()
        print("✅ embedding_provider column added.\n")

    # ── Step 4: Add embedding_model to document_embeddings ──
    r = conn.execute(sa.text(
        "SELECT column_name FROM information_schema.columns "
        "WHERE table_name='document_embeddings' AND column_name='embedding_model'"
    )).fetchone()
    if r:
        print("⚠️  embedding_model column already exists, skipping.")
    else:
        print("Adding 'embedding_model' column to document_embeddings...")
        conn.execute(sa.text(
            "ALTER TABLE document_embeddings ADD COLUMN embedding_model VARCHAR(100) DEFAULT 'nomic-embed-text'"
        ))
        conn.commit()
        print("✅ embedding_model column added.\n")

    # ── Step 5: Update alembic_version ──
    print("Updating alembic_version to a1b2c3d4e5f6...")
    try:
        r = conn.execute(sa.text("SELECT version_num FROM alembic_version")).fetchone()
        if r:
            conn.execute(sa.text("UPDATE alembic_version SET version_num = 'a1b2c3d4e5f6'"))
        else:
            conn.execute(sa.text("INSERT INTO alembic_version (version_num) VALUES ('a1b2c3d4e5f6')"))
    except Exception:
        # Table might not exist
        conn.rollback()
        conn.execute(sa.text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL)"))
        conn.execute(sa.text("INSERT INTO alembic_version (version_num) VALUES ('a1b2c3d4e5f6')"))
    conn.commit()
    print("✅ alembic_version stamped.\n")

    # ── Verify ──
    print("═══ Verification ═══")
    r = conn.execute(sa.text("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='users' AND column_name='plan'")).fetchone()
    print(f"  users.plan: {r}")
    r = conn.execute(sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='document_embeddings' AND column_name IN ('embedding_provider','embedding_model')")).fetchall()
    print(f"  doc embedding cols: {[x[0] for x in r]}")
    r = conn.execute(sa.text("SELECT version_num FROM alembic_version")).fetchone()
    print(f"  alembic version: {r[0] if r else 'N/A'}")

    conn.close()
    engine.dispose()
    print("\n🎉 Migration complete! Backend should start now.")

if __name__ == "__main__":
    main()
