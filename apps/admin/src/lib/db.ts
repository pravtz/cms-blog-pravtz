import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

const DATA_DIR = process.env.DATA_DIR ?? path.join(process.cwd(), 'data')
const DB_PATH = path.join(DATA_DIR, 'nexus.db')

let db: Database.Database | null = null

export function getDb(): Database.Database {
  if (db) return db

  fs.mkdirSync(DATA_DIR, { recursive: true })
  db = new Database(DB_PATH)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  runMigrations(db)
  return db
}

function runMigrations(database: Database.Database): void {
  database.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `)

  const migrations: Record<string, string> = {
    '001_initial': `
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'default',
        status TEXT NOT NULL DEFAULT 'pending_email',
        email_token TEXT,
        email_token_expires TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS login_attempts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ip_address TEXT NOT NULL,
        email TEXT,
        success INTEGER NOT NULL DEFAULT 0,
        attempted_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_login_attempts_ip ON login_attempts(ip_address, attempted_at);
    `,
    '002_posts': `
      CREATE TABLE IF NOT EXISTS categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tags (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT '',
        subtitle TEXT,
        slug TEXT UNIQUE,
        excerpt TEXT,
        content TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'draft',
        visibility TEXT NOT NULL DEFAULT 'public',
        language TEXT NOT NULL DEFAULT 'pt-BR',
        author_id TEXT NOT NULL,
        category_id TEXT,
        cover_image TEXT,
        reading_time INTEGER,
        seo_title TEXT,
        seo_description TEXT,
        publish_date TEXT,
        translation_link TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (author_id) REFERENCES users(id),
        FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      CREATE TABLE IF NOT EXISTS post_tags (
        post_id TEXT NOT NULL,
        tag_id TEXT NOT NULL,
        PRIMARY KEY (post_id, tag_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
      CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
      CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
    `,
    '003_blog_metrics': `
      ALTER TABLE posts ADD COLUMN views INTEGER NOT NULL DEFAULT 0;
      CREATE INDEX IF NOT EXISTS idx_posts_views ON posts(views);
    `,
    '004_newsletter': `
      CREATE TABLE IF NOT EXISTS newsletter_subscribers (
        id TEXT PRIMARY KEY,
        email TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'pending',
        token TEXT UNIQUE,
        token_expires TEXT,
        unsubscribe_token TEXT NOT NULL UNIQUE,
        confirmed_at TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_subscribers(email);
      CREATE INDEX IF NOT EXISTS idx_newsletter_token ON newsletter_subscribers(token);
      CREATE INDEX IF NOT EXISTS idx_newsletter_unsubscribe ON newsletter_subscribers(unsubscribe_token);
    `,
    '005_user_profile': `
      ALTER TABLE users ADD COLUMN nickname TEXT;
      ALTER TABLE users ADD COLUMN phone TEXT;
      ALTER TABLE users ADD COLUMN first_login_done INTEGER NOT NULL DEFAULT 0;

      CREATE TABLE IF NOT EXISTS user_interests (
        user_id TEXT NOT NULL,
        category_id TEXT NOT NULL,
        PRIMARY KEY (user_id, category_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
      );
    `,
    '006_rbac': `
      CREATE TABLE IF NOT EXISTS groups (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        is_system INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS group_members (
        group_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        PRIMARY KEY (group_id, user_id),
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS group_permissions (
        group_id TEXT NOT NULL,
        resource TEXT NOT NULL,
        operation TEXT NOT NULL,
        allowed INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (group_id, resource, operation),
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS user_permissions (
        user_id TEXT NOT NULL,
        resource TEXT NOT NULL,
        operation TEXT NOT NULL,
        allowed INTEGER NOT NULL DEFAULT 1,
        PRIMARY KEY (user_id, resource, operation),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);

      -- Seed system groups
      INSERT OR IGNORE INTO groups (id, name, description, is_system) VALUES
        ('group-owner', 'owner', 'System owner group — immutable', 1),
        ('group-default', 'default', 'Default group for all users — immutable', 1);
    `,
    '007_audit_log': `
      CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        actor_id TEXT,
        actor_email TEXT,
        action TEXT NOT NULL,
        target_id TEXT,
        target_type TEXT,
        metadata TEXT,
        ip_address TEXT,
        user_agent TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON audit_logs(actor_id);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at);
    `,
    '009_comments': `
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        parent_id TEXT,
        author_id TEXT NOT NULL,
        content TEXT NOT NULL CHECK(length(content) <= 2000),
        status TEXT NOT NULL DEFAULT 'visible',
        upvotes INTEGER NOT NULL DEFAULT 0,
        downvotes INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE,
        FOREIGN KEY (author_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS comment_votes (
        comment_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        vote INTEGER NOT NULL,
        PRIMARY KEY (comment_id, user_id),
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        link TEXT,
        read INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
      CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
      CREATE INDEX IF NOT EXISTS idx_comments_author ON comments(author_id);
      CREATE INDEX IF NOT EXISTS idx_comments_status ON comments(status);
      CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
    `,
    '010_post_likes': `
      CREATE TABLE IF NOT EXISTS post_likes (
        post_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        PRIMARY KEY (post_id, user_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_post_likes_post ON post_likes(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_likes_user ON post_likes(user_id);
    `,
    '011_post_shares': `
      CREATE TABLE IF NOT EXISTS post_shares (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        post_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        channel TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_post_shares_post ON post_shares(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_shares_user ON post_shares(user_id);
    `,
    '008_visibility_access': `
      CREATE TABLE IF NOT EXISTS access_lists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_by TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS access_list_members (
        list_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        PRIMARY KEY (list_id, user_id),
        FOREIGN KEY (list_id) REFERENCES access_lists(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS post_group_access (
        post_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        PRIMARY KEY (post_id, group_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS post_list_access (
        post_id TEXT NOT NULL,
        list_id TEXT NOT NULL,
        PRIMARY KEY (post_id, list_id),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (list_id) REFERENCES access_lists(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_access_list_members_user ON access_list_members(user_id);
      CREATE INDEX IF NOT EXISTS idx_post_group_access_post ON post_group_access(post_id);
      CREATE INDEX IF NOT EXISTS idx_post_list_access_post ON post_list_access(post_id);
    `,
    '012_translations': `
      ALTER TABLE posts ADD COLUMN translation_group_id TEXT;
      CREATE INDEX IF NOT EXISTS idx_posts_translation_group ON posts(translation_group_id);
    `,
    '013_post_versions': `
      CREATE TABLE IF NOT EXISTS post_versions (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        title TEXT,
        subtitle TEXT,
        excerpt TEXT,
        content TEXT,
        status TEXT,
        visibility TEXT,
        language TEXT,
        category_id TEXT,
        cover_image TEXT,
        seo_title TEXT,
        seo_description TEXT,
        publish_date TEXT,
        change_summary TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_post_versions_post ON post_versions(post_id);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_post_versions_post_ver ON post_versions(post_id, version_number);
    `,
    '014_email_campaigns': `
      CREATE TABLE IF NOT EXISTS email_campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        scheduled_at TEXT,
        sent_at TEXT,
        recipient_count INTEGER NOT NULL DEFAULT 0,
        sent_count INTEGER NOT NULL DEFAULT 0,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_email_campaigns_status ON email_campaigns(status);
    `,
    '015_ai_system': `
      CREATE TABLE IF NOT EXISTS ai_providers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        api_key_encrypted TEXT NOT NULL,
        model TEXT NOT NULL DEFAULT 'gpt-4o',
        base_url TEXT,
        enabled INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS ai_user_quotas (
        user_id TEXT PRIMARY KEY,
        ai_enabled INTEGER NOT NULL DEFAULT 0,
        monthly_tokens INTEGER NOT NULL DEFAULT 50000,
        reset_monthly INTEGER NOT NULL DEFAULT 1,
        accumulating INTEGER NOT NULL DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS ai_usage (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        tokens_used INTEGER NOT NULL DEFAULT 0,
        month TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_usage_user_month ON ai_usage(user_id, month);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_month ON ai_usage(month);
    `,
    '016_images': `
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        url TEXT NOT NULL,
        alt_text TEXT NOT NULL DEFAULT '',
        ai_generated INTEGER NOT NULL DEFAULT 0,
        prompt TEXT,
        style TEXT,
        aspect_ratio TEXT,
        created_by TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (created_by) REFERENCES users(id)
      );
      CREATE INDEX IF NOT EXISTS idx_images_created_by ON images(created_by);
      CREATE INDEX IF NOT EXISTS idx_images_ai_generated ON images(ai_generated);
    `,
  }

  const applied = database
    .prepare('SELECT name FROM migrations')
    .all() as { name: string }[]
  const appliedNames = new Set(applied.map((r) => r.name))

  for (const [name, sql] of Object.entries(migrations)) {
    if (!appliedNames.has(name)) {
      database.exec(sql)
      database.prepare('INSERT INTO migrations (name) VALUES (?)').run(name)
    }
  }
}

export function getSetting(key: string): string | null {
  const db = getDb()
  const row = db
    .prepare('SELECT value FROM settings WHERE key = ?')
    .get(key) as { value: string } | undefined
  return row?.value ?? null
}

export function setSetting(key: string, value: string): void {
  const db = getDb()
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`
  ).run(key, value)
}

export function createVersionSnapshot(
  postId: string,
  createdBy: string,
  changeSummary: string
): void {
  const database = getDb()
  const post = database
    .prepare('SELECT * FROM posts WHERE id = ?')
    .get(postId) as Record<string, unknown> | undefined
  if (!post) return

  const lastVersion = database
    .prepare('SELECT MAX(version_number) as n FROM post_versions WHERE post_id = ?')
    .get(postId) as { n: number | null }
  const versionNumber = (lastVersion.n ?? 0) + 1

  const id = require('crypto').randomUUID()
  database
    .prepare(`
      INSERT INTO post_versions (
        id, post_id, version_number, title, subtitle, excerpt, content,
        status, visibility, language, category_id, cover_image,
        seo_title, seo_description, publish_date, change_summary, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      id,
      postId,
      versionNumber,
      post.title,
      post.subtitle,
      post.excerpt,
      post.content,
      post.status,
      post.visibility,
      post.language,
      post.category_id,
      post.cover_image,
      post.seo_title,
      post.seo_description,
      post.publish_date,
      changeSummary,
      createdBy
    )

  // Purge oldest versions beyond cap of 50
  const versions = database
    .prepare('SELECT id FROM post_versions WHERE post_id = ? ORDER BY version_number ASC')
    .all(postId) as { id: string }[]
  if (versions.length > 50) {
    const toDelete = versions.slice(0, versions.length - 50)
    const del = database.prepare('DELETE FROM post_versions WHERE id = ?')
    for (const v of toDelete) del.run(v.id)
  }
}

export function ownerExists(): boolean {
  const db = getDb()
  const row = db
    .prepare("SELECT id FROM users WHERE role = 'owner' LIMIT 1")
    .get()
  return !!row
}
