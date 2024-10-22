import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { createServer, CreateServerOptions } from '../src/server';
import { Server } from "bun";
import adze from "adze";

const testConfig: CreateServerOptions = {
  useHttps: false,
  openaiApiKey: process.env.OPENAI_KEY || 'test-key',
  notionThoughtDbKey: process.env.NOTION_THOUGHTDB || 'test-db-key',
};

const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

describe('Translate API', () => {
  let server: Server;
  
  beforeAll(async () => {
    const router = createServer(testConfig);
    server = Bun.serve({
      port: PORT,
      fetch: router.fetch,
    });
  });

  afterAll(() => {
    server.stop();
  });

  test('should translate text to multiple languages', async () => {
    const response = await fetch(`${BASE_URL}/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: 'Hello, world!',
        to: ['es', 'fr', 'de'],
      }),
    });

    expect(response.status).toBe(200);
    const text = await response.text();
    adze.info('test:response', {text});
    const result = JSON.parse(text);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);

    result.forEach((translation: { text: string; to: string }) => {
      expect(translation).toHaveProperty('text');
      expect(translation).toHaveProperty('to');
      expect(typeof translation.text).toBe('string');
      expect(typeof translation.to).toBe('string');
    });
  });
});
