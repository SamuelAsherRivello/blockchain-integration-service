# Windows Sandbox Setup for Codex

## Overview

[Watch the Docker Sandboxes overview](https://www.youtube.com/watch?v=erQnRkMrpls).

See the [official Docker Sandboxes installation guide](https://docs.docker.com/ai/sandboxes/install/) and [OpenAI Codex](https://openai.com/codex/).

## Solution

Docker Sandboxes runs Codex inside an isolated microVM with its own filesystem, Docker daemon, and network. Only the workspace you explicitly share is visible to Codex.

## Steps — Setup

1. **WSL in PowerShell:**

   ```powershell
   wsl --install
   ```

2. **Windows:** Reboot the system when prompted.
3. **Microsoft Store:** Download and run [Docker Desktop](https://apps.microsoft.com/detail/xp8cb7f8ddkntb).
4. **Browser:** Follow the [Docker Sandboxes installation guide](https://docs.docker.com/ai/sandboxes/install/).
5. **Docker account:** If Docker Desktop prompts for credentials, sign in or create a Docker account.

## Steps — Usage

Open a new PowerShell window and run:

```powershell
cd d:/some/working/directory
sbx policy         # Set the permissions policy as you like
sbx login
sbx                 # Opens the TUI
```

Exit the TUI, then run:

```powershell
sbx run codex
```

In Codex, authenticate when prompted. You are now in a sandboxed Codex session.

From the Codex prompt, use:

```text
/permissions
```

Set the permissions policy as you like, then test the boundaries:

- Ask Codex to create a new text file in the shared folder. This will work.
- Ask Codex to create a new text file outside the shared folder. This will not work.
- Ask Codex to check Google for the latest news. The result depends on the permissions you set.

