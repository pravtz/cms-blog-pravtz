export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'

function buildSpec() {
  return {
    openapi: '3.0.3',
    info: {
      title: 'Nexus CMS Public API',
      version: '1.0.0',
      description:
        'Public read-only REST API for Nexus CMS. All endpoints are rate-limited to 60 requests/minute per IP.',
      license: { name: 'MIT' },
    },
    servers: [{ url: `${BASE_URL}/api/v1`, description: 'Production' }],
    paths: {
      '/posts': {
        get: {
          summary: 'List published posts',
          operationId: 'listPosts',
          tags: ['Posts'],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 }, description: 'Page number' },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 20, maximum: 50 }, description: 'Items per page' },
            { name: 'category', in: 'query', schema: { type: 'string' }, description: 'Filter by category slug' },
            { name: 'tag', in: 'query', schema: { type: 'string' }, description: 'Filter by tag slug' },
            { name: 'lang', in: 'query', schema: { type: 'string', enum: ['pt-BR', 'en'] }, description: 'Filter by language' },
            { name: 'sort', in: 'query', schema: { type: 'string', enum: ['date', 'views', 'title'], default: 'date' }, description: 'Sort order' },
          ],
          responses: {
            200: {
              description: 'List of posts',
              headers: {
                'X-RateLimit-Limit': { schema: { type: 'integer' } },
                'X-RateLimit-Remaining': { schema: { type: 'integer' } },
                'X-RateLimit-Reset': { schema: { type: 'integer' } },
              },
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/PostSummary' } },
                      meta: { $ref: '#/components/schemas/PaginationMeta' },
                    },
                  },
                },
              },
            },
            429: { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
      '/posts/{slug}': {
        get: {
          summary: 'Get post by slug',
          operationId: 'getPost',
          tags: ['Posts'],
          parameters: [
            { name: 'slug', in: 'path', required: true, schema: { type: 'string' }, description: 'Post slug' },
          ],
          responses: {
            200: {
              description: 'Post detail with HTML content',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { data: { $ref: '#/components/schemas/PostDetail' } },
                  },
                },
              },
            },
            404: { $ref: '#/components/responses/NotFound' },
            429: { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
      '/categories': {
        get: {
          summary: 'List categories',
          operationId: 'listCategories',
          tags: ['Categories'],
          responses: {
            200: {
              description: 'List of categories',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/Category' } },
                    },
                  },
                },
              },
            },
            429: { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
      '/tags': {
        get: {
          summary: 'List tags',
          operationId: 'listTags',
          tags: ['Tags'],
          responses: {
            200: {
              description: 'List of tags',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      data: { type: 'array', items: { $ref: '#/components/schemas/Tag' } },
                    },
                  },
                },
              },
            },
            429: { $ref: '#/components/responses/TooManyRequests' },
          },
        },
      },
    },
    components: {
      schemas: {
        PostSummary: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            subtitle: { type: 'string', nullable: true },
            slug: { type: 'string' },
            excerpt: { type: 'string', nullable: true },
            language: { type: 'string', example: 'pt-BR' },
            cover_image: { type: 'string', nullable: true },
            reading_time: { type: 'integer', nullable: true },
            views: { type: 'integer' },
            publish_date: { type: 'string', format: 'date-time', nullable: true },
            created_at: { type: 'string', format: 'date-time' },
            updated_at: { type: 'string', format: 'date-time' },
            author_name: { type: 'string' },
            category_name: { type: 'string', nullable: true },
            category_slug: { type: 'string', nullable: true },
            tags: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  slug: { type: 'string' },
                },
              },
            },
          },
        },
        PostDetail: {
          allOf: [
            { $ref: '#/components/schemas/PostSummary' },
            {
              type: 'object',
              properties: {
                seo_title: { type: 'string', nullable: true },
                seo_description: { type: 'string', nullable: true },
                content_html: { type: 'string', description: 'Sanitized HTML rendered from MDX' },
                translations: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      slug: { type: 'string' },
                      language: { type: 'string' },
                    },
                  },
                },
              },
            },
          ],
        },
        Category: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            post_count: { type: 'integer' },
          },
        },
        Tag: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            slug: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
            post_count: { type: 'integer' },
          },
        },
        PaginationMeta: {
          type: 'object',
          properties: {
            page: { type: 'integer' },
            limit: { type: 'integer' },
            total: { type: 'integer' },
            total_pages: { type: 'integer' },
            has_next: { type: 'boolean' },
            has_prev: { type: 'boolean' },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' },
          },
        },
      },
      responses: {
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
          },
        },
        TooManyRequests: {
          description: 'Rate limit exceeded',
          headers: {
            'X-RateLimit-Limit': { schema: { type: 'integer' } },
            'X-RateLimit-Remaining': { schema: { type: 'integer' } },
            'X-RateLimit-Reset': { schema: { type: 'integer' } },
          },
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/Error' } },
          },
        },
      },
    },
    tags: [
      { name: 'Posts', description: 'Blog posts' },
      { name: 'Categories', description: 'Post categories' },
      { name: 'Tags', description: 'Post tags' },
    ],
  }
}

const SWAGGER_HTML = (specUrl: string) => `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Nexus CMS API v1 — Docs</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css" />
  <style>
    body { margin: 0; background: #fafafa; }
    .topbar { display: none !important; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: "${specUrl}",
      dom_id: '#swagger-ui',
      presets: [SwaggerUIBundle.presets.apis, SwaggerUIBundle.SwaggerUIStandalonePreset],
      layout: 'BaseLayout',
      deepLinking: true,
    })
  </script>
</body>
</html>`

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  // Return JSON spec when ?format=json
  if (searchParams.get('format') === 'json') {
    return NextResponse.json(buildSpec(), {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=3600',
      },
    })
  }

  // Otherwise return Swagger UI HTML
  const specUrl = `${BASE_URL}/api/v1/docs?format=json`
  const html = SWAGGER_HTML(specUrl)

  return new NextResponse(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600',
    },
  })
}
