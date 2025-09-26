# Project-Specific Instructions for Claude

## CLI Execution

When running the Shopify admin CLI in this project, always use:
```bash
npx tsx cli.ts [command] [options]
```

Do NOT use `npm run dev` or other npm scripts for CLI commands.

### Examples:
- `npx tsx cli.ts --help` - Show help
- `npx tsx cli.ts add -n "Store Name" -u "https://store.myshopify.com" -t "token"` - Add a store
- `npx tsx cli.ts list` - List all stores
- `npx tsx cli.ts remove -n "Store Name"` - Remove a store