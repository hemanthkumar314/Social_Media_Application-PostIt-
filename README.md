# PostIt (Social Media Application)

[Live application](https://postit-hemanth1704.vercel.app) · [Source repository](https://github.com/hemanthkumar314/Connect2People)

## Overview
PostIt is a React + TypeScript social application built with Vite, Tailwind CSS, shadcn/Radix components, React Query, React Hook Form, and Zod. The browser calls Appwrite for authentication, database records, and file storage. A small Appwrite Function privately resolves usernames during login.

The approved authentication artwork is `public/assets/images/postit-auth-collage.png` (option 1, generated using the built-in image generator). It appears on the right at the existing desktop breakpoint; smaller screens keep the form visible without the image. Generation details are recorded in `design/auth-image.json`.

## Current backend status

The original inactive project was deleted. A fresh **Social_media** project is now configured in Singapore on the Free organization:

- Project: `6b0309630017c47fc29c`
- Endpoint: `https://sgp.cloud.appwrite.io/v1`
- Database: `6b0309f70018f20a65ff`
- Tables: `users`, `posts`, `likes`, `saves`
- Image bucket: `images`
- Username authentication function: `postit-auth` (Node.js 22)
- Registered web platforms: `localhost` and `postit-hemanth1704.vercel.app`

The ignored `.env.local` points at these resources, including the deployed username authentication function. No persistent admin API key is stored in the repository. Real-email signup, username login, recovery request acceptance, invalid recovery-token rejection, uploading, feed/search, post/profile editing, likes, saves, and cross-account permissions passed 12 live checks. Test content was removed and the two synthetic Auth accounts were blocked afterward. Recovery inbox delivery has not been tested with a real mailbox.

Appwrite's [inactivity policy](https://appwrite.io/changelog/entry/2026-06-29) deletes Free projects after 90 days paused. [Project deletion is irreversible](https://appwrite.io/docs/partners/project#delete-a-project). The schema and access rules are now tracked in `appwrite/schema.json`, with repeatable creation commands from `node scripts/appwrite-commands.mjs`. These commands target the configured database; review IDs before reusing them. Schema files do not back up user data. The Free database has no automatic backup policy configured.

The existing Appwrite 15 SDK uses the backwards-compatible Databases API against the new TablesDB database. Records use string references, and the app loads creator/like/profile information explicitly. Likes have a separate table so members do not need update access to someone else's post. Switching backends is not required.

## Access rules

- Signed-in members can read profiles, posts, and likes. Only each row's owner receives edit/delete access; there is no table-wide update/delete grant.
- Bookmarks have no table-wide read grant. Each bookmark is readable/deletable only by its creator.
- Password credentials stay in Appwrite Auth. Signup collects username, email, password, and matching confirm password; login retains username/password. Shared profile rows do not contain email addresses.
- Images are public to anyone with their URL, as approved during setup. Only the uploader can edit/delete an image. The bucket accepts PNG/JPEG/WebP up to 10 MiB, with file security, encryption, and antivirus enabled.
- The app uses direct file-view URLs. Paid image transformations are disabled.
- These rules are configured by the backend and checked using two independent test accounts. The client still creates its own rows; stronger server-side validation and abuse controls remain future hardening work.

## Local checks

```bash
npm ci
npm run dev
npm run lint
npm run typecheck
npm test
npm run build
```

The production build includes TypeScript checking. Unit/regression tests mock backend operations and block network requests. They cover client behavior and API integration logic. For an explicitly authorized live check, run `node scripts/appwrite-smoke.mjs --run`: it creates two synthetic test accounts/content, checks the deployed permissions and flows, removes its own test rows/files, and blocks the test Auth accounts. The sanitized result is saved to ignored `artifacts/appwrite-smoke.json`. Test Auth accounts remain in the console with blocked status; no admin key or permanent account deletion is used.

The toolchain currently targets Vite 5; dependency and toolchain upgrades remain maintenance work. The local app is served at `http://localhost:5173`; use localhost to match the registered web platform.

## Key Features

- **Responsive interface**: Compact signup, full authentication artwork, local Inter typography, consistent sidebar navigation, and a profile shortcut in the top-right header.
- **User Registration and Authentication**: Username, email, password, and confirm-password signup through Appwrite Auth; username/password login, password visibility controls, and email-based recovery.
- **Home Feed Page**: Shows the 20 most recently created posts, with likes and bookmarks.
- **Exploring Posts Page**: Browse recently updated posts with infinite scrolling and search post captions.
- **Saved Posts Page**: The Saved Posts page contains all the posts you've bookmarked. You can easily access your favorite posts here at any time.
- **Creating Post**: Upload one image with a caption, location, and tags; edit existing posts and update profile details.
- **Deferred Features**: Following, people discovery, comments, messaging, sharing, Google login, and post deletion are not implemented.

## Technologies Used

### Front End
- **Vite + ReactJS**
- **Tailwind CSS**
- **Shadcn UI**

### Back End
- **Appwrite Auth**: Manages password accounts and sessions. Passwords and confirm password are not stored in the application's Users table.
- **Appwrite Databases and Storage**: Users, Posts, Likes, and Saves tables plus an image bucket.


## Getting Started

### Prerequisites
- **Node.js and npm** for the frontend build. The Appwrite function separately uses the Node.js 22 runtime.
- **Appwrite account** for backend provisioning and administration.

### Installation

1. Clone the Repository:
   ```bash
   git clone https://github.com/hemanthkumar314/Connect2People.git PostIt
   cd PostIt
   ```
2. Install the locked dependencies with `npm ci`. Dependency folders are ignored by Git; use `package-lock.json` to reproduce the install.
3. Copy `.env.example` to `.env.local`. The template contains placeholders, not usable credentials. The `VITE_*` variables are public browser configuration; never put server API keys in them.
4. For another environment, create an Appwrite project and a TablesDB database, then adapt `appwrite/schema.json` and the printed provisioning commands. Configure the Users, Posts, Likes, and Saves tables and the image bucket using the tracked columns, indexes, and access rules. The current project is already provisioned.
5. Enter the new endpoint and resource IDs in `.env.local`, then restart Vite. Local tests do not need a live project.

### Usage

1. Run the frontend and open `http://localhost:5173` in your browser:
   
   ```bash
   npm run dev
   ```

2. Sign up with a username, email, password, and matching confirm password. Usernames are case-insensitive and contain 2–32 letters, numbers, or underscores. The deleted project's accounts were not recovered; returning users need new accounts.
3. Browse the shared Home Feed or Explore, create a photo post, like and save posts, and open your profile from the top-right header. Other members' posts appear in the shared feed and remain separate from your own profile posts.

### Repository layout

| Path | Purpose |
| --- | --- |
| `src/_auth` | Signup, login, recovery, and authentication layout |
| `src/_root` | Feed, Explore, Saved, profile, and post pages |
| `src/lib/appwrite` | Browser API, username identity, session handling, and backend models |
| `appwrite` | Database/storage schema and username-function source/configuration |
| `tests` | Automated frontend, API, session, and function regressions |
| `scripts` | Provisioning commands and opt-in live/demo checks |
| `public/assets` | Application artwork, icons, and locally bundled font/license |
| `design` | Generated artwork provenance and demo-content assets |
| `vercel.json` | Production build, SPA routes, and response headers |

Keep local environment files, installed dependencies, build output, and generated test/deployment reports out of commits. `.env.example` contains only public configuration placeholders.

## Username authentication

**Deployment status:** `postit-auth` is deployed and active in Social_media. Active deployment: `6b031df654eaf64bcdc2`. `VITE_APPWRITE_AUTH_FUNCTION_ID=postit-auth` enables email signup and the login page's recovery link. The function uses the Free project's supported build size (2 CPU / 2 GB) and runtime size (0.5 CPU / 512 MB), as recorded in `appwrite/username-auth.json`. The website is deployed at https://postit-hemanth1704.vercel.app.

New accounts use the real recovery email in Appwrite Auth and `u_<canonical username>` as their unique Auth account ID. Emails are never written to the members-readable Users table. Login retains its Username and Password inputs. `appwrite/functions/username-auth` resolves usernames on the server, then sends the supplied password to Appwrite's normal email/password endpoint without an API key. It returns only a temporary authenticated session and never returns private emails or logs credentials. Appwrite's native password rate limits remain active.

`src/lib/appwrite/session.ts` uses that temporary session to read only the authenticated member's own Auth email, with browser cookies omitted. It closes the temporary session, then establishes the normal browser SDK email/password session. This replaces expired HttpOnly cookies instead of allowing them to override a freshly stored fallback token. The browser SDK manages the final cookie or localStorage fallback. Malformed fallback storage is normalized, and clearing an expired session preserves other Appwrite projects' fallback entries.

The opt-in `node scripts/check-appwrite-session.mjs --run` reproduces an invalidated native cookie, verifies that login replaces it, checks fresh-client persistence and blocked third-party cookies, and confirms that no temporary handoff session remains. It creates one synthetic account, removes its test profile, and blocks that account; real member accounts are untouched. Logged-out `GET /account` requests may return 401 during session checking and are treated as an anonymous user. Login errors distinguish invalid credentials, throttling, service failures, and a profile-load failure after authentication.

For another environment, deploy the dependency-free Node.js 22 function with entrypoint `src/main.js` using the settings in `appwrite/username-auth.json`: public execute access for login/signup, only `users.read` on its per-execution ephemeral key, no events/schedule, no credential logging. No persistent admin key belongs in browser configuration. Set `VITE_APPWRITE_AUTH_FUNCTION_ID=postit-auth` after deployment. Without this setting, the app retains legacy username login and disables new email signup until the function is available.

The function also supports the earlier username-only accounts by their Auth name and stored username preference. Their `@users.postit.invalid` addresses cannot receive recovery mail; they need a real email added through Appwrite Auth with explicit account-owner authorization. Existing accounts are not modified automatically.

## Password recovery

The login link opens `/forgot-password`. Appwrite sends a reset link to the signup email, using the current website origin plus `/reset-password`. The reset page validates matching new passwords and calls Appwrite's recovery endpoint with the emailed `userId` and `secret`. It removes those credentials from the address bar on arrival. Unknown-email responses are neutral; expired or incomplete links offer a fresh request.

Keep every deployed website hostname registered as an Appwrite web platform so reset URLs are allowed. The site host must serve `index.html` for direct `/reset-password` links. Appwrite's recovery mail is used; custom SMTP and email verification are not configured here. Inbox delivery still needs a check with an email address you control.

## Navigation and demo feed

The desktop sidebar uses consistent 48-pixel rows and keeps Logout in a separate footer. The profile link is in the top-right header on desktop and mobile. Content scrolls below that header. Inter is bundled locally in `public/assets/fonts` with its original SIL Open Font License, from the [official Inter repository](https://github.com/rsms/inter), so typography does not depend on Google Fonts loading.

The requested demo content consists of 12 posts: six Avengers/Doomsday discussion posts from Reel Club (Demo) and six automotive posts from Garage Club (Demo). These are examples, not official film announcements. Generated assets and final prompts are in `design/demo-posts`; `posts.json` holds the captions. Each asset is reused for three discussion posts.

Run `node scripts/seed-demo-posts.mjs --run` only when this demo batch is absent. It checks the configured project, creates two dedicated example accounts, and writes only their own profiles, images, and posts through the normal app API. The ignored `artifacts/demo-posts.json` records created IDs and verifies the shared feed, each demo owner's six posts, and that `hemanth1704` has zero demo posts on their own profile. A completed manifest prevents duplicate runs. Demo Auth accounts are blocked after creation while their profiles/posts remain; no passwords are retained. `--preview` pauses before blocking for an interactive UI check, then accepts `done` on stdin. Existing member accounts and posts are never edited.

## Production hosting

PostIt is live at **https://postit-hemanth1704.vercel.app** on the existing `mtr` Vercel workspace's free Hobby plan. Manage it at https://vercel.com/mtr-6364/postit-hemanth1704. The database, image storage, Auth, and username function remain in the Social_media Appwrite Cloud project. No paid plan or custom domain was purchased.

The first release was uploaded as a prebuilt static archive through Vercel. Its release ID is `3e71ea5566f1`, derived from the production JavaScript SHA-256. The ignored archive is `artifacts/postit-release-3e71ea5566f1.zip`; it contains only built public assets and a static Vercel routing/header configuration. Source code, local environment files, tests, and admin credentials were not uploaded. Git-based automatic deployment is not connected.

Appwrite now has the exact web hostname `postit-hemanth1704.vercel.app` registered as **PostIt Production** (platform ID `6b0331a700338bed8dd6`), alongside the existing localhost app. No wildcard hosting domain was added. Recovery links use the website origin and `/reset-password`.

For a future source build, set the nine public `VITE_APPWRITE_*` values from `.env.example`, run `npm run build`, and serve `dist`. The tracked `vercel.json` supplies the Vite build, SPA fallback, and response headers; `.vercelignore` excludes local and server-only material. For a prebuilt upload, include only the routing and header settings from `vercel.json`, without source-build options. Browser configuration is public; server API keys must never be placed in `VITE_*` variables.

Release verification passed 72 automated tests, lint, TypeScript/build checks, 12 public deployment checks, 12 live application checks, and six session edge checks. The deployed JavaScript matches the tested local build. Anonymous browser CORS headers allow the exact production origin with credentials. Direct signup, login, profile, post, and recovery URLs serve the SPA; an incomplete reset link displays a recovery prompt. The live tests removed only their own test rows/files and blocked their synthetic Auth accounts.

To repeat the explicitly authorized live tests from the production origin in PowerShell:

```powershell
$env:POSTIT_TEST_ORIGIN='https://postit-hemanth1704.vercel.app'
node scripts/appwrite-smoke.mjs --run
node scripts/check-appwrite-session.mjs --run
```

Sanitized reports are in ignored `artifacts/vercel-public-checks.json`, `artifacts/appwrite-smoke.json`, and `artifacts/appwrite-session-check.json`. A reset request and invalid-token rejection passed; delivery to a real inbox and a complete emailed reset still need an account-owner check.
