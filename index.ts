require('dotenv').config();

const hostname = '0.0.0.0';
const port = 3000;

const notionSecret = process.env.NOTION_SECRET;
console.log(`Server running at http://${hostname}:${port}/ and length: ${notionSecret ? notionSecret.length : 0}`);

Bun.serve({
    port,
    fetch(req) {

        return new Response(`Hello world 4 + ${notionSecret?.length}!`);
    },
});
