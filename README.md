# Riverton & Associates — website

git init
git add README.md
git commit -m "first commit"
git branch -M main
git remote add origin https://github.com/barringtinyoung/website.git
git push -u origin main

**This folder is the source of truth for the live site.** All future edits happen here.

    website/
      index.html     the entire site (self-contained: CSS, JS and icons are inline)
      favicon.svg    browser tab icon
      robots.txt     crawler policy
      README.md      this file (safe to upload or omit)

## Deploying

`index.html` is fully self-contained — no build step, no external CSS, JS, fonts or
images. Upload the folder contents to the web root so `index.html` sits at `/`.

**Note on the current host:** riverton-assoc.com currently runs on GoDaddy Website
Builder, which does not accept custom HTML uploads. Publishing this site requires
either GoDaddy Web Hosting (cPanel) or any static host — Netlify, Cloudflare Pages,
GitHub Pages, S3. Any of those will serve this folder as-is.

## Structure

A single page with hash-routed tabs: `#home`, `#about`, `#capabilities`, `#approach`,
`#blog`, `#platform`. Each is linkable and the browser back button works.

## Before going live

- Replace the sample Blog entries with real posts (they are labelled as placeholders).
- Confirm FSL World consents to being named publicly as the IT management partner.
- Rivet, the chat agent, returns scripted replies. That is fine; what matters is that
  free-text messages are now captured (see below).
- Decide what the "Start a conversation" button should do — it is currently a plain
  `mailto:` link.

## Turning on chat capture

Anything a visitor types freehand into Rivet is collected with a reply-to address and
POSTed as JSON `{email, message, page, _subject}`. **This is off until you set an
endpoint.** Until then it falls back to opening a pre-filled email draft, so nothing a
visitor writes is silently lost — but they have to click to send it, and most will not.

To switch it on:

1. Create a form endpoint — Formspree, Basin, Getform and Web3Forms all accept this
   JSON shape on a free tier. Or point it at your own handler.
2. In `index.html`, find `var CAPTURE_ENDPOINT` near the top of the `<script>` block
   and paste the URL in:

       var CAPTURE_ENDPOINT = 'https://formspree.io/f/xxxxxxxx';

3. Send yourself a test message through the chat and confirm it arrives.

Notes:

- Rivet asks for an email before sending, so every captured message has a reply-to.
- A hidden `_gotcha` honeypot field blocks basic spam bots.
- The footnote under the chat reads "Replies are scripted — anything you type reaches
  a person." That is only true once the endpoint is set. If you decide not to wire it
  up, change that line.
- Capturing an email address is personal data. If you expect EU or UK visitors,
  add a short privacy note.

## Related folders

- `../www/` — an offline mirror of the **previous** GoDaddy site, kept for reference.
  It is not this site and is not deployed.
