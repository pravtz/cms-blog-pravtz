#!/usr/bin/env node
/**
 * Nexus CMS — MCP Server
 *
 * A Model Context Protocol server that lets AI agents and external tools
 * interact with Nexus CMS programmatically via stdio transport.
 *
 * Usage:
 *   NEXUS_URL=http://localhost:3001 NEXUS_MCP_KEY=mcp_... npx @nexus/mcp-server
 *
 * Or add to your MCP client config:
 *   {
 *     "mcpServers": {
 *       "nexus-cms": {
 *         "command": "node",
 *         "args": ["/path/to/packages/mcp-server/dist/index.js"],
 *         "env": {
 *           "NEXUS_URL": "http://localhost:3001",
 *           "NEXUS_MCP_KEY": "mcp_<your-api-key>"
 *         }
 *       }
 *     }
 *   }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

// ── Configuration ─────────────────────────────────────────────────────────────

const NEXUS_URL = (process.env.NEXUS_URL ?? 'http://localhost:3001').replace(/\/$/, '')
const NEXUS_MCP_KEY = process.env.NEXUS_MCP_KEY ?? ''

if (!NEXUS_MCP_KEY) {
  process.stderr.write(
    '[nexus-mcp] WARNING: NEXUS_MCP_KEY is not set. All tool calls will fail with 401.\n'
  )
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function callTool(tool: string, params: Record<string, unknown>): Promise<unknown> {
  const res = await fetch(`${NEXUS_URL}/api/mcp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${NEXUS_MCP_KEY}`,
    },
    body: JSON.stringify({ tool, params }),
  })

  const data = (await res.json()) as { result?: unknown; error?: string }
  if (!res.ok) {
    throw new Error(data.error ?? `HTTP ${res.status}`)
  }
  return data.result
}

async function fetchResource(path: string): Promise<unknown> {
  const res = await fetch(`${NEXUS_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${NEXUS_MCP_KEY}`,
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${path}`)
  return res.json()
}

// ── Tool schemas ──────────────────────────────────────────────────────────────

const tools = [
  {
    name: 'list_posts',
    description:
      'List posts in the CMS. Supports filtering by status, category, tag, and language.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        page: { type: 'number', description: 'Page number (default: 1)' },
        limit: { type: 'number', description: 'Results per page, max 50 (default: 20)' },
        status: {
          type: 'string',
          enum: ['published', 'draft', 'scheduled', 'all'],
          description: 'Filter by status (default: published)',
        },
        category: { type: 'string', description: 'Filter by category slug' },
        tag: { type: 'string', description: 'Filter by tag slug' },
        language: { type: 'string', description: 'Filter by language code (e.g. pt-BR, en)' },
      },
    },
  },
  {
    name: 'get_post',
    description: 'Get the full content and metadata of a post by its slug.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', description: 'The post slug (URL-friendly identifier)' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'create_post',
    description: 'Create a new draft post in the CMS.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        title: { type: 'string', description: 'Post title (required)' },
        content: { type: 'string', description: 'MDX content body' },
        excerpt: { type: 'string', description: 'Short summary/excerpt' },
        language: {
          type: 'string',
          description: 'Language code (default: pt-BR)',
        },
        visibility: {
          type: 'string',
          enum: ['public', 'allPrivate', 'iPrivate'],
          description: 'Post visibility (default: public)',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'update_post',
    description: 'Update fields of an existing post identified by slug.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', description: 'Post slug to update (required)' },
        title: { type: 'string', description: 'New title' },
        content: { type: 'string', description: 'New MDX content' },
        excerpt: { type: 'string', description: 'New excerpt' },
        language: { type: 'string', description: 'New language code' },
        visibility: { type: 'string', description: 'New visibility level' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'publish_post',
    description: 'Publish a draft or scheduled post immediately.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        slug: { type: 'string', description: 'Post slug to publish (required)' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'list_categories',
    description: 'List all content categories with post counts.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'list_tags',
    description: 'List all tags sorted by post count.',
    inputSchema: { type: 'object' as const, properties: {} },
  },
  {
    name: 'search_posts',
    description: 'Search posts by keyword (searches title, excerpt, and content).',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Search keyword or phrase (required)' },
      },
      required: ['query'],
    },
  },
]

// ── Resources ─────────────────────────────────────────────────────────────────

const resources = [
  {
    uri: 'nexus://posts',
    name: 'All published posts',
    description: 'Index of all published posts in the CMS.',
    mimeType: 'application/json',
  },
  {
    uri: 'nexus://categories',
    name: 'Content categories',
    description: 'All content categories with post counts.',
    mimeType: 'application/json',
  },
  {
    uri: 'nexus://tags',
    name: 'Content tags',
    description: 'All content tags sorted by post count.',
    mimeType: 'application/json',
  },
]

// ── Server ────────────────────────────────────────────────────────────────────

const server = new Server(
  {
    name: 'nexus-cms',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
  }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }))

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources }))

server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
  const uri = req.params.uri

  let data: unknown
  if (uri === 'nexus://posts') {
    data = await callTool('list_posts', { status: 'published', limit: 50 })
  } else if (uri === 'nexus://categories') {
    data = await callTool('list_categories', {})
  } else if (uri === 'nexus://tags') {
    data = await callTool('list_tags', {})
  } else {
    throw new Error(`Unknown resource: ${uri}`)
  }

  return {
    contents: [
      {
        uri,
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2),
      },
    ],
  }
})

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params
  const params = (args ?? {}) as Record<string, unknown>

  try {
    const result = await callTool(name, params)
    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify(result, null, 2),
        },
      ],
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return {
      content: [{ type: 'text' as const, text: `Error: ${message}` }],
      isError: true,
    }
  }
})

// ── Start ─────────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  process.stderr.write('[nexus-mcp] MCP server started (stdio transport)\n')
}

main().catch((err) => {
  process.stderr.write(`[nexus-mcp] Fatal error: ${err}\n`)
  process.exit(1)
})

// Export for type-safe usage
export { tools, resources }
