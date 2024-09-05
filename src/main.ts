require('dotenv').config();


const thoughtDb = new Thought.ThoughtDB(vanjacloud.Keys.notion, process.env.NOTION_THOUGHTDB!);

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

async function bulkTranslateText(text: string, targetLanguages: string[]): Promise<string> {

    const prompt = `Translate the following text into only these languages: [ ${targetLanguages} ]
    Make sure to convert all units and measurements to the target language, even if it is a number/digit write it out voice like ie. '1' becomes 'one' or whatever in target language.
    Return in JSON format: [{ text: string, to: string }]
    NOTHING EXCEPT THE JSON OBJECT SHOULD BE RETURNED
    --- Text:
    ${text}
    

    Sure, here is the output in JSON:\n\n`;

    console.log({ text, targetLanguages, prompt })

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

import { readFileSync } from "fs";
const options = {
    key: readFileSync("/etc/letsencrypt/live/remote.vanja.oljaca.me/privkey.pem"),
    cert: readFileSync("/etc/letsencrypt/live/remote.vanja.oljaca.me/fullchain.pem"),
};


const corsOptions = {
    origin: '*', // or ['https://www.google.com'] for more restrictive setup
    methods: ['GET', 'POST', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
  };
  
  new CORS(corsOptions)

export default new Router({
    hostname: '0.0.0.0', // no idea why this is needed remotely to not use 127
    ...options,
})
    // .use()
    .get('/', () => new Response('Hi'))
    .get('/version', () => {
        const version = execSync('git rev-parse HEAD').toString().trim();
        return new Response(version);
    })
    .post('/', () => new Response('Hi'))
    .post('/myspace', async (req) => {
        const data = await req.json()
        return new Response(JSON.stringify(data))
    })
    .post('/retrospective', async (req) => {
        const data = await req.json()

        const t = thoughtDb.getLatest(moment.duration(1, 'week'))

        let thoughts = []
        for await (const thought of t) {
            thoughts.push(thought)
        }

        console.log({ data, thoughts })

        const r = openai.completions.create({
            model: 'gpt-3.5-turbo-instruct',
            prompt: data.prompt + '\n\n References: \n' + thoughts.join('\n') + '\n\nSure, here is your response:\n',
            temperature: 0.7,
            max_tokens: 1024,
        });

        const response = {
            text: (await r).choices[0].text
        }

        console.log({ response })

        return new Response(JSON.stringify(response));
    })
    .post('/translate', async (req) => {
        const data = await req.json()
        // text: text,
        //     to: opts?.to || defaultTo,
        //         from: opts?.from,
        //             traceId: opts?.traceId

        const response = await bulkTranslateText(data.text, data.to)

        return new Response(response);
    })
    .post('/explain', async (req) => {
        // {
        //     request: 'explain',
        //         target: language,
        //             text: text
        // });

        const data = await req.json();

        const r = openai.completions.create({
            model: 'gpt-3.5-turbo-instruct',
            prompt: `Explain the following phrase in language=${data.target} in the target language ONLY

            Phrase: ${data.text}
            \n\nSure, here is your explanation:\n`,
            temperature: 0.7,
            max_tokens: 1024,
        });

        const response = {
            response: (await r).choices[0].text
        };


        console.log({ data, response })

        return new Response(JSON.stringify(response));
    })
    .post('/audio', async (req) => {

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
        const r = await thoughtDb.saveIt2(transcriptionResponse.text, Thought.ThoughtType.note, ['#audio'])

        return new Response()
    });
/*
languageretrospective
explain
api */


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

import { Router } from '@stricjs/router';
import { CORS } from '@stricjs/utils';


import fs from 'fs';
import OpenAI from "openai";
import moment from "moment";
import Path from 'path'
import vanjacloud, { Thought } from 'vanjacloud.shared.js';
import { execSync } from 'child_process';