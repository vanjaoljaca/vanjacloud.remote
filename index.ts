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

import { Router } from '@stricjs/router';

import fs from 'fs';
import OpenAI from "openai";
import moment from "moment";
import Path from 'path'



enum Folders {
    input,
    translation,
    translated
}

const dataFolder = './data';

const openai = new OpenAI({ apiKey: process.env.OPENAI_KEY });

async function translateText(text: string, sourceLanguage: string, targetLanguage: string): Promise<string> {
    const prompt = `Translate the following text from ${sourceLanguage} to ${targetLanguage}: ${text}
    Make sure to convert all units and measurements to the target language, even if it is a number/digit write it out voice like ie. '1' becomes 'one' or whatever in target language.`;
    const response = await openai.completions.create({
        model: 'gpt-3.5-turbo-instruct',
        prompt: prompt,
        temperature: 0.7,
        max_tokens: 1024,
    });

    console.log(response.choices?.[0]?.text.trim())
    return response.choices?.[0]?.text.trim();
}


async function writeFile(targetPath: fs.PathLike | fs.promises.FileHandle, data: Blob | File) {
    const speechBuffer = await data.arrayBuffer();
    return await fs.promises.writeFile(targetPath, new Uint8Array(speechBuffer));
}

export default new Router({
    hostname: '0.0.0.0' // no idea why this is needed remotely to not use 127
})
    .get('/', () => new Response('Hi'))
    .post('/', () => new Response('Hi'))
    .post('/post', async (req) => {

        const language = 'bosnian';

        const fileName = `${moment()}`;
        const ext = '.m4a' // must be m4a for transcription

        const targetPath = Path.join(dataFolder, Folders[Folders.input], fileName + ext);

        const data = await req.formData();
        const f = data.get('cv') as File;

        await writeFile(targetPath, f)

        const transcriptionResponse = await openai.audio.transcriptions.create({
            file: fs.createReadStream(targetPath),
            model: 'whisper-1',
        });

        // const text = await translateText(transcriptionResponse.text, 'en', language)

        // await writeFile(Path.join(dataFolder, Folders[Folders.translation], fileName + '.txt'), new Blob([text]))

        // const responseFormat = 'mp3'
        // const speechResponse = await openai.audio.speech.create({ input: text, model: 'tts-1', voice: 'alloy', response_format: responseFormat })

        // const translatedPath = Path.join(dataFolder, Folders[Folders.translated], fileName + '.' + responseFormat);
        // await writeFile(translatedPath, await speechResponse.blob())

        // return speechResponse;

        // todo: save to notion
    });



async function test() {
    const targetFile = './data/test.mp3';

    if (fs.existsSync(targetFile)) {
        return;
    }

    const str = `We found allergic people had this memory B cell against their allergen, but non-allergic people had very few, if any." 

MBC2 (memory B cell type 2) holds memory for allergic conditions. This could act as a new target for allergy medication.  DOI: 10.1126/scitranslmed.adi0944`

    const text = { text: await translateText(str, 'en', 'bosnian') }

    const speech = await openai.audio.speech.create({ input: text.text, model: 'tts-1', voice: 'alloy', response_format: 'mp3' })
    const blob = await speech.blob();
    await writeFile(targetFile, blob)

}

// test();

async function init() {
    await fs.promises.mkdir(Path.join(dataFolder, Folders[Folders.input]), { recursive: true });
    await fs.promises.mkdir(Path.join(dataFolder, Folders[Folders.translated]), { recursive: true });
    await fs.promises.mkdir(Path.join(dataFolder, Folders[Folders.translation]), { recursive: true });
}

init(); // sigh