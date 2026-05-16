#!/usr/bin/env node

// ============================================================================
// Follow Builders — Generate Digest via Claude API
// ============================================================================
// Reads local feed JSON + local prompts, calls Claude API, and outputs the
// bilingual digest to stdout.
//
// Designed to run AFTER generate-feed.js so feeds are already on disk.
//
// Usage: node generate-digest.js > digest.txt
// Env:   ANTHROPIC_API_KEY (required)
// ============================================================================

import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PROMPTS_DIR = join(ROOT, 'prompts');

async function readJSON(path) {
  if (!existsSync(path)) return null;
  return JSON.parse(await readFile(path, 'utf-8'));
}

async function readPrompt(name) {
  const path = join(PROMPTS_DIR, name);
  if (!existsSync(path)) return '';
  return readFile(path, 'utf-8');
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY env var is required');
    process.exit(1);
  }

  // Read local feed files written by generate-feed.js
  const [feedX, feedBlogs, feedPodcasts] = await Promise.all([
    readJSON(join(ROOT, 'feed-x.json')),
    readJSON(join(ROOT, 'feed-blogs.json')),
    readJSON(join(ROOT, 'feed-podcasts.json')),
  ]);

  const xBuilders   = feedX?.x         || [];
  const blogs       = feedBlogs?.blogs  || [];
  const podcasts    = feedPodcasts?.podcasts || [];

  const totalItems = xBuilders.length + blogs.length + podcasts.length;
  if (totalItems === 0) {
    process.stderr.write('No feed content found — skipping digest generation\n');
    process.exit(0);
  }

  // Read prompt files
  const [digestIntro, summarizeTweets, summarizeBlogs, summarizePodcast, translate] =
    await Promise.all([
      readPrompt('digest-intro.md'),
      readPrompt('summarize-tweets.md'),
      readPrompt('summarize-blogs.md'),
      readPrompt('summarize-podcast.md'),
      readPrompt('translate.md'),
    ]);

  const system = [digestIntro, summarizeTweets, summarizeBlogs, summarizePodcast, translate]
    .filter(Boolean)
    .join('\n\n---\n\n');

  const today = new Date().toISOString().split('T')[0];
  const userMessage = `Today's date: ${today}

Please generate today's AI Builders Digest using the content below.
Output must be bilingual (English + Chinese) per the instructions in your system prompt.

## X / Twitter Feed (${xBuilders.length} builders)
${JSON.stringify(xBuilders, null, 2)}

## Blog Posts (${blogs.length} sources)
${JSON.stringify(blogs, null, 2)}

## Podcasts (${podcasts.length} episodes)
${JSON.stringify(podcasts, null, 2)}

Generate the complete bilingual digest now. Follow all rules in your system prompt exactly.`;

  const client = new Anthropic({ apiKey });

  process.stderr.write(`Calling Claude API (model: claude-sonnet-4-6)...\n`);

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system,
    messages: [{ role: 'user', content: userMessage }],
  });

  const digest = response.content[0].text;
  process.stdout.write(digest + '\n');

  process.stderr.write(
    `Done. Input tokens: ${response.usage.input_tokens}, Output tokens: ${response.usage.output_tokens}\n`
  );
}

main().catch(err => {
  process.stderr.write(`Fatal: ${err.message}\n`);
  process.exit(1);
});
