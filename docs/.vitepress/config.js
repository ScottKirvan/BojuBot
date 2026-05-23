export default {
  base: '/BojuBot/',
  title: 'BojuBot',
  description: 'A Claude Code agent inside your Obsidian vault',

  head: [
    ['link', { rel: 'icon', href: '/BojuBot/favicon.ico' }],
  ],

  themeConfig: {
    logo: '/logo.png',
    siteTitle: 'BojuBot',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Reference', link: '/guide/commands' },
      {
        text: 'Community',
        items: [
          { text: 'GitHub', link: 'https://github.com/ScottKirvan/BojuBot' },
          { text: 'Discord', link: 'https://discord.gg/TN6XJSNK5Y' },
          { text: 'Releases', link: 'https://github.com/ScottKirvan/BojuBot/releases' },
        ]
      }
    ],

    sidebar: [
      {
        text: 'Getting Started',
        items: [
          { text: 'Requirements & Installation', link: '/guide/getting-started' },
          { text: 'First Launch', link: '/guide/first-launch' },
        ]
      },
      {
        text: 'Using BojuBot',
        items: [
          { text: 'Chat Panel', link: '/guide/chat-panel' },
          { text: 'Slash Commands', link: '/guide/slash-commands' },
          { text: 'Skills', link: '/guide/skills' },
          { text: 'Session Manager', link: '/guide/sessions' },
          { text: 'Context System', link: '/guide/context-system' },
        ]
      },
      {
        text: 'Reference',
        items: [
          { text: 'Commands', link: '/guide/commands' },
          { text: 'Settings', link: '/guide/settings' },
          { text: 'Permissions', link: '/guide/permissions' },
        ]
      },
      {
        text: 'Support',
        items: [
          { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          { text: 'Known Limitations', link: '/guide/troubleshooting#known-limitations' },
        ]
      }
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/ScottKirvan/BojuBot' },
      { icon: 'discord', link: 'https://discord.gg/TN6XJSNK5Y' },
    ],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © Scott Kirvan'
    },

    editLink: {
      pattern: 'https://github.com/ScottKirvan/BojuBot/edit/main/docs/:path',
      text: 'Edit this page on GitHub'
    },

    search: {
      provider: 'local'
    }
  }
}
