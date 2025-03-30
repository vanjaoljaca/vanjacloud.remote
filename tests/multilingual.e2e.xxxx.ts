import { test, expect } from "bun:test";

const baseUrl = 'https://remote.vanja.oljaca.me:3000';

test('translates text from English to Spanish', async () => {
  const response = await fetch(`${baseUrl}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Hello, world!',
      to: ['es'],
    }),
  });

  expect(response.ok).toBe(true);
  const result = await response.json();
  expect(result).toEqual([
    {
      text: expect.stringContaining('Hola'),
      to: 'es'
    }
  ]);
});

test('translates text from Spanish to English', async () => {
  const response = await fetch(`${baseUrl}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Buenas noches',
      to: ['en'],
    }),
  });

  expect(response.ok).toBe(true);
  const result = await response.json();
  expect(result).toEqual([
    {
      text: expect.stringContaining('Good night'),
      to: 'en'
    }
  ]);
});

test('handles empty text input', async () => {
  const response = await fetch(`${baseUrl}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: '',
      to: ['fr'],
    }),
  });

  expect(response.ok).toBe(true);
  const result = await response.json();
  expect(result).toEqual([
    {
      text: '',
      to: 'fr'
    }
  ]);
});

test('handles unsupported language', async () => {
  const response = await fetch(`${baseUrl}/translate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: 'Hello',
      to: ['xx'], // Unsupported language code
    }),
  });

  expect(response.ok).toBe(true);
  const result = await response.json();
  expect(result).toEqual([
    {
      text: expect.any(String),
      to: 'xx'
    }
  ]);
});
