import { Router } from '@stricjs/router';
import { CORS } from '@stricjs/utils';
import { ServerOptions } from 'https';
import { execSync } from 'child_process';
import fs from 'fs';
import OpenAI from "openai";
import moment from "moment";
import Path from 'path';
import vanjacloud, { AzureTranslate, Thought } from 'vanjacloud.shared.js';

import adze, { setup } from 'adze';


setup({
    activeLevel: 'debug',
});

export interface CreateServerOptions {
    useHttps?: boolean;
    httpsOptions?: {
        key: string;
        cert: string;
    };
    corsOptions?: {
        origin: string | string[];
        methods: string[];
        headers: string[];
        maxAge: number;
    };
    openaiApiKey: string;
    notionThoughtDbKey: string;
}

export function createServer(options: CreateServerOptions) {
    const { useHttps = false, httpsOptions, corsOptions, openaiApiKey, notionThoughtDbKey } = options;

    const defaultCorsOptions = {
        origin: '*',
        methods: ['GET', 'POST', 'OPTIONS'],
        headers: ['Content-Type', 'Authorization'],
        maxAge: 86400,
    };

    new CORS(corsOptions || defaultCorsOptions);

    const serverOptions: ServerOptions = useHttps && httpsOptions
        ? {
            key: httpsOptions.key,
            cert: httpsOptions.cert,
        }
        : {};

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const thoughtDb = new Thought.ThoughtDB(vanjacloud.Keys.notion, notionThoughtDbKey);

    const server = new Router({
        hostname: '0.0.0.0',
        port: useHttps ? 443 : 80,
        ...serverOptions,
    });

    server
        .guard("/", async (req, res) => {
            const debugHeader = req.headers.get('VanjaCloud-Debug');
            adze.info('debug header', debugHeader);
        })
        .get('/', () => new Response('Hi'))
        .get('/version', () => {
            const version = execSync('git rev-parse HEAD').toString().trim();
            const latestCommitDate = execSync('git log -1 --format=%cd').toString().trim();
            const versionInfo = {
                commitHash: version,
                commitDate: latestCommitDate
            };
            console.log('versionInfo', versionInfo);

            return new Response(JSON.stringify(versionInfo));
        })
        .post('/', () => new Response('Hi'))
        .post('/mochi/add', () => {
            return new Response('Hi');
        })
        .post('/myspace', async (req) => {
            const data = await req.json();
            return new Response(JSON.stringify(data));
        })
        .post('/retrospective', async (req) => {
            const data = await req.json();
            const t = thoughtDb.getLatest(moment.duration(1, 'week'));
            let thoughts = [];
            for await (const thought of t) {
                thoughts.push(thought);
            }
            console.log({ data, thoughts });
            const r = await openai.completions.create({
                model: 'gpt-3.5-turbo-instruct',
                prompt: data.prompt + '\n\n References: \n' + thoughts.join('\n') + '\n\nSure, here is your response:\n',
                temperature: 0.7,
                max_tokens: 1024,
            });
            const response = { text: r.choices[0].text };
            console.log({ response });
            return new Response(JSON.stringify(response));
        })
        .post('/translate', async (req) => {

            const data = await req.json();
            adze.debug('/translate', { data })
            const response = await bulkTranslateText(data.text, data.to);
            return new Response(JSON.stringify(response));
        })
        .post('/explain', async (req) => {
            const data = await req.json();
            const r = await openai.completions.create({
                model: 'gpt-3.5-turbo-instruct',
                prompt: `Explain the following phrase in language=${data.target} in the target language ONLY

        Phrase: ${data.text}
        \n\nSure, here is your explanation:\n`,
                temperature: 0.7,
                max_tokens: 1024,
            });
            const response = { response: r.choices[0].text };
            console.log({ data, response });
            return new Response(JSON.stringify(response));
        })
        .post('/audio', async (req) => {
            const fileName = `${moment()}`;
            const ext = '.m4a';
            const targetPath = Path.join('./data', 'input', fileName + ext);
            const data = await req.formData();
            const f = data.get('cv') as File;
            await writeFile(targetPath, f);
            const transcriptionResponse = await openai.audio.transcriptions.create({
                file: fs.createReadStream(targetPath),
                model: 'whisper-1',
            });
            await thoughtDb.saveIt2(transcriptionResponse.text, Thought.ThoughtType.note, ['#audio']);
            return new Response();
        })
        .post('/debug/weeklysummary', async (req) => {
            await weeklySummary(openai, thoughtDb);
            return new Response('Weekly summary completed');
        });

    return server;
}

import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import { Translation } from 'vanjacloud.shared.js/dist/src/AzureTranslate';

const TranslationResult = z.array(z.object({
    text: z.string(),
    to: z.string(),
}));

async function bulkTranslateText(text: string, targetLanguages: string[]): Promise<Translation[]> {
    adze.debug('bulkTranslate', { text, targetLanguages, key: vanjacloud.Keys.azure.translate });
    const translator = new AzureTranslate(vanjacloud.Keys.azure.translate);
    const r = await translator.translate(text, { to: targetLanguages });
    adze.debug('bulkTranslate', { r });
    return r;
}

// async function newOpenAITranslate(openai: OpenAI, text: string, targetLanguages: string[]): Promise<string> {
//     const prompt = `Translate the following text into only these languages: [ ${targetLanguages} ]
//   Make sure to convert all units and measurements to the target language, even if it is a number/digit write it out voice like ie. '1' becomes 'one' or whatever in target language.
//   Expected output format JSON: [{text: string, to: string}]
//   --- Text:
//   ${text}
//   `;

//   console.log({ text, targetLanguages, prompt });

//   const response = await openai.chat.completions.create({
//     model: 'gpt-4o-mini',

//     prompt: prompt,
//     temperature: 0.7,
//     max_tokens: 1024
//   }, {
//     response_format: zodResponseFormat(TranslationResult, "event"),
//   });

//   adze.info('response:bulkTranslateText', {text}, response.choices?.[0]);
//   return response.choices?.[0]?.message.content;
// }

async function writeFile(targetPath: fs.PathLike | fs.promises.FileHandle, data: Blob | File) {
    const speechBuffer = await data.arrayBuffer();
    return await fs.promises.writeFile(targetPath, new Uint8Array(speechBuffer));
}

async function weeklySummary(openai: OpenAI, thoughtDb: Thought.ThoughtDB) {
    adze.info('Running weekly retrospective');
    const t = thoughtDb.getLatest(moment.duration(1, 'week'));
    let thoughts = [];
    for await (const thought of t) {
        thoughts.push(thought);
    }
    const prompt = `Summarize this shiz`;
    console.log({ prompt, thoughts });
    const r = await openai.completions.create({
        model: 'gpt-3.5-turbo-instruct',
        prompt: prompt + '\n\n References: \n' + thoughts.join('\n') + '\n\nSure, here is your response:\n',
        temperature: 0.7,
        max_tokens: 1024,
    });
    const response = { text: r.choices[0].text };
    // todo: email it somewhere?
}
