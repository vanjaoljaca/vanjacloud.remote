require('dotenv').config();

const isDev = process.env.DEV;

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
        model: "gpt-4o-mini",
        prompt: prompt,
        temperature: 0.7,
        max_tokens: 1024,
        response_format: { type: 'json_object' } 
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


const corsOptions = {
    origin: '*', // or ['https://www.google.com'] for more restrictive setup
    methods: ['GET', 'POST', 'OPTIONS'],
    headers: ['Content-Type', 'Authorization'],
    maxAge: 86400, // 24 hours
};

new CORS(corsOptions)


const options = isDev ? {} : {
    key: readFileSync("/etc/letsencrypt/live/remote.vanja.oljaca.me/privkey.pem"),
    cert: readFileSync("/etc/letsencrypt/live/remote.vanja.oljaca.me/fullchain.pem"),
};

export const server = new Router({
    hostname: '0.0.0.0', // no idea why this is needed remotely to not use 127
    ...options,
})
.guard("/", async (req, res) => {
        const debugHeader = req.headers.get('VanjaCloud-Debug');
        adze.info('debug header', debugHeader)
        // todo: get logging to send logs to telegram if debugging
        
    })
    .get('/', () => new Response('Hi'))
    .get('/version', () => {
        const version = execSync('git rev-parse HEAD').toString().trim();
        const latestCommitDate = execSync('git log -1 --format=%cd').toString().trim();
        const versionInfo = {
            commitHash: version,
            commitDate: latestCommitDate
        };
        return new Response(JSON.stringify(versionInfo));
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
    })
    .post('/debug/weeklysummary', async (req) => {
        await weeklySummary();
    });

// Schedule job for Sunday at 5 PM every week
const job = schedule.scheduleJob({ hour: 17, minute: 0, dayOfWeek: 0 }, async () => {
    await weeklySummary();
    return new Response('ok');
});


async function weeklySummary() {

    adze.info('Running weekly retrospective')

    const t = thoughtDb.getLatest(moment.duration(1, 'week'))

    let thoughts = []
    for await (const thought of t) {
        thoughts.push(thought)
    }

    const prompt = `Summarize this shiz`;

    console.log({ prompt, thoughts })


    const r = openai.completions.create({
        model: 'gpt-3.5-turbo-instruct',
        prompt: prompt + '\n\n References: \n' + thoughts.join('\n') + '\n\nSure, here is your response:\n',
        temperature: 0.7,
        max_tokens: 1024,
    });

    const response = {
        text: (await r).choices[0].text
    }

    // todo: email it somewhere?

}

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

    await setupLogging();
}

init(); // sigh

import { Router, wrap } from '@stricjs/router';
import { CORS } from '@stricjs/utils';


import fs from 'fs';
import OpenAI from "openai";
import moment from "moment";
import Path from 'path'
import vanjacloud, { Thought } from 'vanjacloud.shared.js';
import { execSync } from 'child_process';
import schedule from 'node-schedule';
import adze from "adze";
import { readFileSync } from "fs";
import { Bot } from 'grammy';


/* logging set up */
import Log, { setup } from 'adze';
import { TelegramMiddleware } from '../other/TelegramMiddleware';
// import AdzeFileTransport from '@adze/transport-file';

// const fileTransport = new AdzeTransportFile({ directory: './logs', frequency: '12h' });
// await fileTransport.load();

async function setupLogging() {


    // const telegramMw = new TelegramMiddleware(bot);
    // await telegramMw.load();

    const logStore = setup({
        middleware: [
            // fileTransport, 
            // telegramMw
        ],
    });


    if (isDev) {
        adze.info('dev mode: not sending telegram messages')
    }
    else {
        const VANJA_CHAT_ID = 7502414131;
        const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

        bot.on('message', (ctx) => {
            const chatId = ctx.chat.id;
            console.log('Chat ID:', chatId);
            ctx.reply(`Your chat ID is: ${chatId}`);
        });

        const allListenerId = logStore.addListener('*', (log: Log) => {
            // const data = log.data;
            bot.api.sendMessage(VANJA_CHAT_ID, JSON.stringify(log.data?.message.slice(1)))
                // .then(() => console.log('Message sent via grammY'))
                .catch((err) => console.error('Error:', err));
        });

        adze.info('starting telegram bot')

        const poller = bot.start();
        bot.catch((e) => {
            adze.error('error starting telegram bot', e)
        })

        process.on('SIGUSR2', () => {
            console.log('Hot reload triggered. Cleaning up...');
            bot.stop();
        });


        adze.info('telegram bot started')
    }


}
