# PNPM

This project uses [PNPM Workspaces](https://pnpm.io/workspaces) to manage packages within a monorepo.

First ensure you have `pnpm` [installed](https://pnpm.io/installation):

```bash
curl -fsSL https://get.pnpm.io/install.sh | sh -
```

## Package Management

### Managing Dependencies

```bash
# Add prod dependency to a package (-E saves exact version)
pnpm add drizzle-orm --filter @oc/database -E

# Add dev dependency to a package (-D saves to devDependencies)
pnpm add @types/node --filter @oc/database -DE

# Add workspace package as dependency
pnpm add @oc/tsconfig --filter web --workspace -D
pnpm add @oc/database --filter web --workspace

# Add dependency to all packages
pnpm add vitest --recursive -DE

# Add dependency to workspace root
pnpm add turbo --workspace-root -DE

# Remove dependency from a package
pnpm remove drizzle-orm --filter @oc/database

# Remove dependency from all packages
pnpm remove vitest --recursive
```

### Upgrading Dependencies

```bash
# Upgrade all dependencies in a package (-L updates to latest version)
pnpm update --filter @oc/database -LE

# Upgrade specific dependency in a package
pnpm update drizzle-orm --filter @oc/database -LE

# Upgrade all dependencies in all packages
pnpm update --recursive -LE

# Upgrade specific dependency in all packages
pnpm update vitest --recursive -LE

# Check for outdated packages
pnpm outdated --recursive
```

### Running Scripts

```bash
# Run script in a package
pnpm dev --filter web

# Run script in all packages
pnpm test --recursive
```
