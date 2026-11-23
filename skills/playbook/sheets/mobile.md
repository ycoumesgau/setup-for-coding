---
title: Mobile
group: surfaces
reviewed: 2026-11-23
---

# Mobile

A store app is a second product to operate: developer accounts, signing profiles, push
certificates, review, a native build machine. Built before a measured need, it absorbs the
time of a small team. Built late on a web app that never ran at phone width, it exposes every
layout that assumed a desk.

## When it matters

- At kickoff: decide whether the web app must work at 390 px (it must) and whether a store app
  is in scope at all.
- When a user act must happen away from a desk in under a minute, or must work without network.
- When a payment or subscription screen is about to be shown inside a store app.

## Decide

1. **Is a store app needed?** Yes when the browser cannot do the job: a reserved act done
   from a notification in under a minute (push, then biometric unlock, then sign), photo
   capture in the field that must survive a dead network, or files carried offline. Web push
   on iOS works only for a site added to the home screen, which is a ritual most users skip.
   Otherwise a responsive web app is enough.
2. **Which form?** A native shell that loads the live web app, a static export bundled in a
   shell, or a fully native app (see Options).
3. **What goes native?** Only the edges the browser lacks: capture, an offline send queue,
   push registration, biometric lock, protected local files. Screens, rules and text stay web.
4. **Where does the shell live?** Outside the main workspace, with its own package manager
   and exact versions.
5. **What the store forces on money.** Decide before the first review whether paying happens
   in the app at all.

## Options

| Option | Gives | Costs | Choose it when |
| --- | --- | --- | --- |
| Native shell (Expo) loading the live web host | One set of screens; server components, cookies and subdomain tenancy keep working; native modules at the edges | A bridge to design; native traps; review risk on a thin web view | The default when a store app is needed |
| Static export in Capacitor | Same React code, offline by default | No server components, server actions, middleware or API routes; auth moves to the client; Capacitor documents loading a remote site as not intended for production | The web app is already client-side and static |
| Fully native (Swift and Kotlin) | Best device integration | Two more codebases for a small team | The core of the product is on the device |
| No store app, responsive web only | Nothing to operate | No reliable push on iOS, no offline capture | Until a need above is measured |

## Default

Responsive web first, tested at 390 px from the first screen. When a need is measured, a
native shell around the live web app, with native code only at the edges and each edge moved
to native one brick at a time, a local module first and a native counter-test after. The
reason is reach: on one production project the web app used server components and host-only
cookies per customer subdomain, so a static export would have meant a rewrite. The default
stops fitting when most of the work happens offline on the device: then the screens
themselves go native.

## Traps

- **The shell drags the monorepo.** The native toolchain pins its own React; an install run
  while the shell sat in the workspace rewrote the root lockfile. Two cloud builds uploaded the
  whole repository, 144 MB, to the build service: keep an ignore file for the build and a test
  that checks the uploaded archive.
- **Payments inside the app.** One product first cited the wrong Apple clause (one that
  covers only VoIP, storage, e-mail and hosting), then settled on hiding every paying action
  in the store app while keeping read-only statements and paid invoices, with a sentence and
  no link. Its grounds: Apple's exception for services sold directly to organisations for
  their employees, and Google Play's "consumption-only" apps. That reading is the project's
  own and was still waiting for the first Apple and Google review. Settle it before
  submitting, and treat the first review as the test.
- **The web view is not a browser.** iOS destroys a WKWebView hidden with `display: none` and
  reloads it from its launch URL; lay native screens over it instead. Android reports
  "disconnected" on wake: drive the offline banner from a state computed from reachability,
  not from the raw `isConnected` flag.
- **The offline queue is a security boundary.** An entry belongs to one account and one
  person and never leaves under another session; no signed URL or token is persisted; a
  create that got no answer is retried under the same idempotency key.
- **The operating cost is real.** Five step-by-step guides (83 KB) for store accounts, signing
  keys, per-capability profiles, push certificates; about twenty native traps in the shell's
  area rules; a native compile job capped at USD 10 a month on a Mac runner; a 531 KB plan.
  None of it is justified without a measured need.
- **390 px found late is a rewrite.** A capture check that fails on horizontal overflow at
  390 px, a 44 px touch target, and two decided breakpoints (layout and data) kept the web
  screens usable in the shell from day one.

## Hold it with a check

- The capture run fails on horizontal overflow at 390 px; a kit test enforces 44 px targets.
- A test that lists the files the native build uploads and fails on anything outside the
  shell.
- The shell's own CI job: type check and tests, plus a native compile check on a schedule.
- The bridge between page and shell accepts a closed set of messages, each with its test.
- No check holds "payments hidden in the store app": the screen specification says it, and
  review reads it.

## Sources

- Experience: one multi-tenant SaaS in production with an Expo shell around its web app, and
  an older consumer monorepo with a static export in Capacitor (2026).
- Capacitor documentation, configuration (`server.url`): "not intended for use in production".
- WebKit blog, "Web Push for Web Apps on iOS and iPadOS".
- Apple App Review Guidelines, section 3.1.3; Google Play Payments policy and its FAQ on
  consumption-only apps.
