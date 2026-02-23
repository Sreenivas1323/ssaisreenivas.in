# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Personal website built with Next.js 16 (App Router), TypeScript, and Tailwind CSS v4. Uses Bun as the package manager.

## Commands

- `bun dev` — Start dev server
- `bun run build` — Production build
- `bun run start` — Start production server
- `bun run lint` — Run ESLint (flat config, v9)

## Architecture

- **App Router** — All routes live under `src/app/` using Next.js file-based routing conventions
- **Server Components** by default; add `'use client'` only when needed
- **Path alias** — `@/*` maps to `./src/*`
- **React Compiler** enabled in `next.config.ts` for automatic optimizations
- **Tailwind CSS v4** — Imported via `@import "tailwindcss"` in `globals.css`; theming uses CSS custom properties and `@theme inline`
- **Dark mode** — Supported via `prefers-color-scheme` media query and Tailwind `dark:` utilities
- **Fonts** — Geist Sans and Geist Mono loaded via `next/font/google` with CSS variable strategy
