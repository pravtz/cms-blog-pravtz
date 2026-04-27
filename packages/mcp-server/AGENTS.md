# MCP Server Context

## Scope

- `packages/mcp-server` is a standalone TypeScript package that exposes Nexus CMS capabilities through the Model Context Protocol.

## Commands

- Build: `npm run build --workspace=@nexus/mcp-server`
- Typecheck: `npm run typecheck --workspace=@nexus/mcp-server`
- Start built server: `npm run start --workspace=@nexus/mcp-server`

## Working Rules

- Keep the package ESM-compatible.
- Preserve protocol compatibility with `@modelcontextprotocol/sdk`.
- Prefer explicit `zod` schemas for tool inputs and outputs.
- Make changes conservative and backwards-compatible unless the task explicitly requires a protocol or contract change.
