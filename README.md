<p align="center">
  <img src="icon.png" width="140" alt="BeanyBox icon">
</p>

<h1 align="center">BeanyBox</h1>

<p align="center">
  A terminal-styled desktop email client for Gmail — dark theme, keyboard-driven, built with Electron.
</p>

---

BeanyBox talks to your real Gmail account over OAuth — Google's own sign-in
page handles your password, BeanyBox never sees it. Everything (read, send,
reply, archive, trash, label, search) runs against the live Gmail API, wrapped
in a fast, keyboard-first TUI-inspired interface instead of a browser tab.

## Features

- **Keyboard-driven** — `j`/`k` to move, `c` compose, `r` reply, `a` archive,
  `d` delete, `t` tag, `w` mark all read, `Ctrl+Space` search, `q` quit
- **Real HTML rendering** for styled email (sandboxed, no scripts, no page
  navigation — links always open in your default browser)
- **Gmail labels as tags** — apply, remove, or create labels on the fly
- **Attachments** — attach files to outgoing mail, save incoming ones via a
  native dialog
- **Search, pagination, and bulk actions** (mark all read, empty trash)
- **Restore** — undo an accidental archive or trash in one keypress
- Encrypted token storage (Windows DPAPI via Electron's `safeStorage`) — no
  plaintext credentials on disk

## Getting started

### 1. Google Cloud setup (one-time, ~5 minutes)

Google requires every app that talks to Gmail to have its own OAuth client.
You create this yourself, in your own Google account.

1. Go to [console.cloud.google.com](https://console.cloud.google.com/) and
   create a new project (any name, e.g. `beanybox-mail`).
2. **APIs & Services → Library** → search **Gmail API** → **Enable**.
3. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - App name: `BeanyBox`, plus your email as support/contact
   - Scopes → **Add or Remove Scopes** → search **Gmail API** → check the
     one described as *"Read, compose, send, and permanently delete all
     your email from Gmail"* (`https://mail.google.com/`). This is a
     restricted scope, so it must be added explicitly even in Testing mode.
   - Test users → add your own Gmail address
4. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Application type: **Desktop app**
   - Copy the **Client ID** and **Client secret**
5. In this repo, copy `oauth-config.example.json` → `oauth-config.json` and
   fill in those two values:

   ```json
   {
     "client_id": "xxxxxxxx.apps.googleusercontent.com",
     "client_secret": "xxxxxxxx"
   }
   ```

   `oauth-config.json` is gitignored — it never leaves your machine, and only
   identifies the app to Google, not you.

### 2. Install & run

```sh
npm install
npm start
```

Click **Sign in with Google** on the login screen — your default browser
opens Google's real consent page. Approve it and you're in. A refresh token
is stored encrypted in your user profile, so you won't need to sign in again.

### 3. Build a standalone Windows app (optional)

```sh
npm run dist
```

Produces a portable `.exe` and an NSIS installer in `dist/` — either runs
BeanyBox without a terminal, pinnable to your taskbar like any other app.

> **If the build fails with a symlink/`Cannot create symbolic link` error**,
> or `dist/win-unpacked` contains a generic `electron.exe` with no icon:
> Windows blocks regular accounts from creating symlinks, which the packaging
> step needs briefly. Turn on **Developer Mode** (Settings → Privacy &
> Security → For Developers) once, or run the command from an elevated
> ("Run as administrator") terminal.

## Keyboard shortcuts

| Key           | Action                          |
| ------------- | -------------------------------- |
| `j` / `k`     | Move selection down / up         |
| `c`           | Compose new message              |
| `r`           | Reply                            |
| `a`           | Archive                          |
| `d`           | Delete (move to Trash)           |
| `u`           | Restore (from Trash or Archived) |
| `t`           | Tag / apply label                |
| `w`           | Mark all as read in this folder  |
| `Ctrl`+`Space`| Search                           |
| `q`           | Quit                             |
| `Esc`         | Discard compose / close panel    |

## Notes

- **Scope**: uses the full `https://mail.google.com/` Gmail scope (read,
  send, archive, trash, permanent delete) — Gmail requires this broadest
  scope specifically for permanent delete. Access is limited to Gmail only,
  nothing else in your Google account.
- **Folders**: Inbox, your custom labels, Starred, Sent, Drafts, Trash, and
  a synthetic **Archived** view (Gmail has no real "archived" label —
  archiving just removes Inbox, so this is a saved search under the hood).
- **Trash**: the header button becomes **Empty Trash**, confirmed via an
  in-app dialog (with an optional "don't ask again"). Individual messages no
  longer have their own permanent-delete action — that's what Empty Trash
  and `u` (Restore) are for.
- **Images**: load automatically, including remote ones from
  newsletters/marketing mail. Note that's a deliberate privacy tradeoff —
  remote images are a classic way for senders to detect that you opened
  their email.
- **Sign out**: click **[sign out]** next to your email address (top bar).
  To force a fresh sign-in after a scope change, that alone isn't enough —
  delete the token file at `%APPDATA%/BeanyBox/tokens.enc` and restart.
