require('dotenv').config();

import { drizzle } from "drizzle-orm/bun-sqlite";
import { Database } from "bun:sqlite";

const sqlite = new Database("./data/sqlite.db");
const db = drizzle(sqlite);

import { sql } from "drizzle-orm";

const query = sql`select "hello world" as text`;
const result = db.get<{ text: string }>(query);
console.log(result);

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
// https://bun.sh/guides/ecosystem/drizzle
export const movies = sqliteTable("movies", {
    id: integer("id").primaryKey(),
    title: text("name"),
    releaseYear: integer("release_year"),
});


// const hostname = '0.0.0.0';
// const port = 3000;

// const notionSecret = process.env.NOTION_SECRET;
// console.log(`Server running at http://${hostname}:${port}/ and length: ${notionSecret ? notionSecret.length : 0}`);

// const server = Bun.serve({
//     port,
//     fetch(req) {

//         const url = new URL(req.url);
//         if (url.pathname === "/") return new Response("Home page!");
//         if (url.pathname === "/blog") return new Response("Blog!");
//         return new Response("404!");

//         return new Response(Bun.file("./hello.txt"));

//         return new Response(`Hello world FINAL TEST VERIFY HOT RELOAD + ${notionSecret?.length}!`);
//     },
// });

// console.log(`Listening on ${server.url}`);

import { Router } from '@stricjs/router';

import fs from 'fs';
import OpenAI from "openai";
import { Writable } from 'stream';
import { pipe } from "./pipePromise";
const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

async function translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    const prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}: ${text}`;
    const response = await openai.completions.create({
        model: 'gpt-3.5-turbo-instruct',
        prompt: prompt,
        temperature: 0.7,
        max_tokens: 1024,
    });

    console.log(response.choices?.[0]?.text.trim())
    return response.choices?.[0]?.text.trim();
}

export default new Router()
    .get('/', () => new Response('Hi'))
    .post('/', () => new Response('Hi'))
    .post('/post', async (req) => {

        const data = await req.formData();

        const file = data.get('cv') as File;
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        await fs.promises.writeFile('./data/1.wav', uint8Array);



        // const text = await openai.audio.transcriptions.create({ file: file, model: 'whisper-1' });
        const originalText = { text: `okay so this this is a voice recording of what I sound like I can say things like you know this is for Dante Court Bentley this is here this is there I'm about to create a custom voice that I'm going to send to Abhi see what he says` }


        console.log('translating')
        const text = { text: await translateText(originalText.text, 'en', 'es') }

        const speech = await openai.audio.speech.create({ input: text.text, model: 'tts-1', voice: 'alloy', response_format: 'mp3' })
        const blob = await speech.blob();


        if (speech.body === null) {
            return new Response('TTS Failed');
        }

        const targetPath = './data/2.mp3'
        const speechBuffer = await blob.arrayBuffer();
        await fs.promises.writeFile(targetPath, new Uint8Array(speechBuffer));



        return new Response(speech)
    });
