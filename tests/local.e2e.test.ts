import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { server } from '../src/main';

const testConfig = {
  ...defaultConfig,
  isDev: true,
  port: 3001, // Use a different port for testing
};

const BASE_URL = `http://localhost:${testConfig.port}`;

describe('Translate API', () => {
  const server = createServer(testConfig);
  
  beforeAll(() => {
    // Start the server before running tests
    return server.listen(testConfig.port);
  });

  afterAll(() => {
    // Close the server after all tests are done
    return new Promise<void>((resolve) => {
      server.server?.close(() => resolve());
    });
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
    
    const result = await response.json();
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBe(3);

    result.forEach((translation: { text: string; to: string }) => {
      expect(translation).toHaveProperty('text');
      expect(translation).toHaveProperty('to');
      expect(typeof translation.text).toBe('string');
      expect(typeof translation.to).toBe('string');
    });

    // Optional: Check for specific translations
    const spanishTranslation = result.find((t: { to: string }) => t.to === 'es');
    expect(spanishTranslation?.text).toBe('Hola, mundo!');
  });
});
