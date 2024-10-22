import { createServer } from './server';
import schedule from 'node-schedule';
import adze from "adze";
import { Bot } from 'grammy';
import fs from 'fs';
import Path from 'path';

require('dotenv').config();

const isDev = process.env.DEV;

enum Folders {
    input,
    translation,
    translated
}

const dataFolder = './data';

let httpsOptions;
if (!isDev) {
  httpsOptions = {
    key: fs.readFileSync("/etc/letsencrypt/live/remote.vanja.oljaca.me/privkey.pem", 'utf8'),
    cert: fs.readFileSync("/etc/letsencrypt/live/remote.vanja.oljaca.me/fullchain.pem", 'utf8'),
  };
}

const server: Server = createServer({
  useHttps: !isDev,
  httpsOptions,
  openaiApiKey: process.env.OPENAI_KEY!,
  notionThoughtDbKey: process.env.NOTION_THOUGHTDB!
});

// Schedule job for Sunday at 5 PM every week
const job = schedule.scheduleJob({ hour: 17, minute: 0, dayOfWeek: 0 }, async () => {
    await server.fetch('/debug/weeklysummary', { method: 'POST' });
});

async function setupLogging() {
    if (isDev) {
        adze.info('dev mode: not sending telegram messages');
    } else {
        const VANJA_CHAT_ID = 7502414131;
        const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN!);

        bot.on('message', (ctx) => {
            const chatId = ctx.chat.id;
            console.log('Chat ID:', chatId);
            ctx.reply(`Your chat ID is: ${chatId}`);
        });

        adze.info('starting telegram bot');

        const poller = bot.start();
        bot.catch((e) => {
            adze.error('error starting telegram bot', e);
        });

        process.on('SIGUSR2', () => {
            console.log('Hot reload triggered. Cleaning up...');
            bot.stop();
        });

        adze.info('telegram bot started');
    }
}

async function init() {
    await fs.promises.mkdir(Path.join(dataFolder, Folders[Folders.input]), { recursive: true });
    await fs.promises.mkdir(Path.join(dataFolder, Folders[Folders.translated]), { recursive: true });
    await fs.promises.mkdir(Path.join(dataFolder, Folders[Folders.translation]), { recursive: true });

    await setupLogging();
}

init();


export default server;