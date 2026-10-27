# First Launch

After enabling the plugin:

- A **brain-circuit icon** appears in the left ribbon — click it to open the BojuBot chat panel
- Or use the Command Palette (`Ctrl+P` / `Cmd+P`): **BojuBot: Open agent panel**

BojuBot uses the agent you installed. If you installed both Claude Code and the Antigravity CLI, switch between Claude and Gemini by clicking the model name below the message box and picking a model under the agent you want (see [Choosing an Agent](./agents)). The welcome screen shows which agent and model a session uses.

::: tip Agent not found?
If BojuBot finds no agent, a setup panel appears instead of the chat, with the steps to install Claude Code or the Antigravity CLI. Install either one and sign in, then click **Check again**. If it's installed but BojuBot still doesn't find it, enter its full path in **Settings → BojuBot** (**Claude Code binary path** or **Antigravity CLI binary path**).

If the agent you picked for new sessions goes missing later, the setup panel names it. When the other agent is installed, the panel offers **Use … instead**.
:::

The first time BojuBot doesn't find a context file, a setup dialog offers to have your agent generate one, start from a blank template, or skip — see [Context File](./context-system#3-context-file-persistent-memory) for details.

![Context file setup modal](./images/context_file_setup.png)

Every new session also shows a brief welcome screen (mascot, greeting, tip of the day, recent sessions) — see [Welcome Screen](./chat-panel#welcome-screen).

![](images/new_session_window.png)

Once the panel opens, type a message and press **Enter**. Your context file (if you have one) is injected at the start of each session so the agent isn't starting blind.

**Try these to get a feel for it:**

- *"Tell me about yourself"*
- *"Summarize the note [[Home]]"*
- *"What notes do I have tagged #meeting from last month?"*
- *"Create a new note in 'Planning' called 'Q2 Goals' with a bullet outline"*

---

Next: [Using the Chat Panel →](./chat-panel)
