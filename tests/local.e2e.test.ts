import { expect, test, describe, beforeAll, afterAll } from "bun:test";
import { createServer, CreateServerOptions } from '../src/server';
import { Server } from "bun";
import adze from "adze";

describe('Mochi API', () => {
    test('make card set', async () => {

        const response = await fetch(`${BASE_URL}/mochi/add`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                cards: [
                    {
                        front: 'Hello, world!',
                        back: 'hola',
                    }, {
                        front: 'front2',
                        back: 'back2'
                    }
                ]
            }),
        });

        adze.debug('test:response', { response });
        expect(response.status).toBe(200);
        const text = await response.text();
        adze.info('test:response', { text });
        const result = JSON.parse(text);

    }, { timeout: 20_000 })
})

const xdescribe = (...[]) => (Object);
const xtest = (...[]) => (Object);

xdescribe('Translate API', () => {


    xtest('should translate text to multiple languages', async () => {
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

        adze.debug('test:response', { response });
        expect(response.status).toBe(200);
        const text = await response.text();
        adze.info('test:response', { text });
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

const testConfig: CreateServerOptions = {
    useHttps: false,
    openaiApiKey: process.env.OPENAI_KEY || 'test-key',
    notionThoughtDbKey: process.env.NOTION_THOUGHTDB || 'test-db-key',
};
const PORT = 3001;
const BASE_URL = `http://localhost:${PORT}`;

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
