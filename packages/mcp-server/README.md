# Nexus CMS — MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that allows AI agents (Claude, GPT-4, etc.) and external tools to interact with Nexus CMS programmatically.

## Overview

The MCP server exposes Nexus CMS content operations as **MCP tools** and **MCP resources**, enabling AI assistants to read, create, and manage blog content directly.

## Architecture

```
AI Agent (e.g. Claude Desktop)
        │
        │  stdio (MCP protocol)
        ▼
@nexus/mcp-server  (packages/mcp-server)
        │
        │  HTTP + Bearer API key
        ▼
Nexus CMS Admin API  (apps/admin /api/mcp)
        │
        ▼
SQLite database
```

## Setup

### 1. Generate an MCP API Key

In the Nexus CMS admin panel, go to **Settings → MCP Integration** and click **Create API Key**. Save the key — it is shown only once.

### 2. Configure the MCP Server

Set the following environment variables:

| Variable         | Description                            | Example                        |
|------------------|----------------------------------------|--------------------------------|
| `NEXUS_URL`      | Base URL of the admin app              | `http://localhost:3001`        |
| `NEXUS_MCP_KEY`  | MCP API key from the admin panel       | `mcp_abc123...`                |

### 3. Add to your MCP Client

#### Claude Desktop (`claude_desktop_config.json`)

```json
{
  "mcpServers": {
    "nexus-cms": {
      "command": "node",
      "args": ["/path/to/nexus-cms/packages/mcp-server/dist/index.js"],
      "env": {
        "NEXUS_URL": "http://localhost:3001",
        "NEXUS_MCP_KEY": "mcp_your_key_here"
      }
    }
  }
}
```

#### Using npx (after publishing)

```json
{
  "mcpServers": {
    "nexus-cms": {
      "command": "npx",
      "args": ["@nexus/mcp-server"],
      "env": {
        "NEXUS_URL": "http://localhost:3001",
        "NEXUS_MCP_KEY": "mcp_your_key_here"
      }
    }
  }
}
```

### 4. Build

```bash
cd packages/mcp-server
npm install
npm run build
```

## Supported Tools

### `list_posts`
List posts in the CMS with optional filters.

**Parameters:**
- `page` (number, optional) — Page number (default: 1)
- `limit` (number, optional) — Results per page, max 50 (default: 20)
- `status` (string, optional) — `published` | `draft` | `scheduled` | `all` (default: `published`)
- `category` (string, optional) — Filter by category slug
- `tag` (string, optional) — Filter by tag slug
- `language` (string, optional) — Filter by language code (e.g. `pt-BR`, `en`)

**Returns:** `{ posts: Post[], total: number, page: number, limit: number }`

---

### `get_post`
Get the full content and metadata of a post by slug.

**Parameters:**
- `slug` (string, **required**) — Post slug

**Returns:** Full post object including `content`, `tags`, `author_name`, `category_slug`

---

### `create_post`
Create a new draft post.

**Parameters:**
- `title` (string, **required**) — Post title
- `content` (string, optional) — MDX content body
- `excerpt` (string, optional) — Short summary
- `language` (string, optional) — Language code (default: `pt-BR`)
- `visibility` (string, optional) — `public` | `allPrivate` | `iPrivate` (default: `public`)

**Returns:** `{ id, slug, status: 'draft', message }`

---

### `update_post`
Update fields of an existing post.

**Parameters:**
- `slug` (string, **required**) — Post slug to update
- `title`, `content`, `excerpt`, `language`, `visibility` (all optional)

**Returns:** `{ id, slug, message }`

---

### `publish_post`
Publish a draft or scheduled post immediately.

**Parameters:**
- `slug` (string, **required**) — Post slug

**Returns:** `{ id, slug, status: 'published', message }`

---

### `list_categories`
List all content categories with post counts.

**Parameters:** None

**Returns:** `{ categories: Category[] }`

---

### `list_tags`
List all tags sorted by post count.

**Parameters:** None

**Returns:** `{ tags: Tag[] }`

---

### `search_posts`
Search posts by keyword (searches title, excerpt, and body content).

**Parameters:**
- `query` (string, **required**) — Search keyword or phrase

**Returns:** `{ posts: Post[], query: string }`

---

## Supported Resources

Resources are read-only data endpoints accessible via `READ_RESOURCE`:

| URI                  | Description                              |
|----------------------|------------------------------------------|
| `nexus://posts`      | Index of all published posts             |
| `nexus://categories` | All categories with post counts          |
| `nexus://tags`       | All tags sorted by post count            |

## HTTP API Endpoint

The MCP server communicates with the admin app via the `/api/mcp` endpoint. You can also call this endpoint directly:

```bash
# List published posts
curl -X POST http://localhost:3001/api/mcp \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer mcp_your_key" \
  -d '{"tool": "list_posts", "params": {"status": "published"}}'

# Get a post by slug
curl -X POST http://localhost:3001/api/mcp \
  -H "Authorization: Bearer mcp_your_key" \
  -H "Content-Type: application/json" \
  -d '{"tool": "get_post", "params": {"slug": "my-post-slug"}}'

# Discover available tools
curl http://localhost:3001/api/mcp \
  -H "Authorization: Bearer mcp_your_key"
```

## Security

- API keys are stored as SHA-256 hashes in the database — the raw key is never stored
- Keys are shown only once at creation time
- Keys can be revoked at any time from the admin panel
- The MCP endpoint only accepts requests from callers with a valid, non-revoked key
- Write operations (`create_post`, `update_post`, `publish_post`) require a valid MCP key

## Development

```bash
# Build the MCP server
cd packages/mcp-server
npm install
npm run build

# Run in dev mode (rebuilds on change)
npm run dev

# Type-check
npm run typecheck
```
