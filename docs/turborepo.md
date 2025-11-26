# Turborepo

This project uses [Turborepo](https://turborepo.com) to build and cache generated artifacts.

Install Turborepo and Vercel CLIs globally with `pnpm`

```bash
pnpm add turbo vercel --global
```

## Development

Develop all apps and packages:

```bash
turbo dev
```

Develop a specific package by using a [filter](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters):

```bash
turbo dev --filter=web
```

## Production

Build all apps and packages:

```bash
turbo build
```

Build a specific package by using a [filter](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters):

```bash
turbo build --filter=web
```

## Remote Caching

Turborepo uses [Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching) to share cache artifacts across machines, enabling you to share build caches with your team and CI/CD pipelines.

By default, Turborepo will cache locally. To enable Remote Caching you will need an account with Vercel. If you don't have an account you can [create one](https://vercel.com/signup?utm_source=turborepo-examples), then enter the following commands:

```bash
turbo login
```

This will authenticate the Turborepo CLI with your [Vercel account](https://vercel.com/docs/concepts/personal-accounts/overview).

Next, link this Turborepo to your Remote Cache by running the following command from the root of your Turborepo:

```bash
turbo link
```

## Resources

- [Turborepo Docs](https://turborepo.com/docs/)
- [Turborepo Tasks](https://turborepo.com/docs/crafting-your-repository/running-tasks)
- [Turborepo Caching](https://turborepo.com/docs/crafting-your-repository/caching)
- [Turborepo Remote Caching](https://turborepo.com/docs/core-concepts/remote-caching)
- [Turborepo Filtering](https://turborepo.com/docs/crafting-your-repository/running-tasks#using-filters)
- [Turborepo Configuration Options](https://turborepo.com/docs/reference/configuration)
- [Turborepo CLI Usage](https://turborepo.com/docs/reference/command-line-reference)
