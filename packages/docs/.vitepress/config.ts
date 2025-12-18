import { defineConfig } from "vitepress"

// https://vitepress.dev/reference/site-config
export default defineConfig({
	title: "tryz",
	description: `Compose programs with errors and dependencies tracked at the type level.`,
	outDir: "dist",
	cleanUrls: true,

	// https://vitepress.dev/reference/default-theme-config
	themeConfig: {
		nav: [
			{ text: "Guide", link: "/guide/getting-started" },
			{ text: "Reference", link: "/reference/program" },
		],
		sidebar: [
			{
				text: "Prologue",
				link: "/prologue",
			},
			{
				text: "Guide",
				base: "/guide",
				items: [
					{ text: "Getting Started", link: "/getting-started" },
					{ text: "Creating Programs", link: "/creating-programs" },
					{ text: "Running Programs", link: "/running-programs" },
					{ text: "Error Handling", link: "/error-handling" },
				],
			},
			{
				text: "Reference",
				base: "/reference",
				items: [
					{ text: "Shell", link: "/shell" },
					{ text: "Program", link: "/program" },
					{ text: "Errors", link: "/errors" },
					{ text: "Result", link: "/result" },
					{ text: "Tokens", link: "/token" },
					{ text: "Context", link: "/context" },
					{ text: "Provider", link: "/provider" },
					{ text: "Middleware", link: "/middleware" },
				],
			},
		],
		socialLinks: [
			{ icon: "github", link: "https://github.com/wagerfield/tryz" },
		],
	},
})
