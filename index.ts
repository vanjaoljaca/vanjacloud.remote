require('dotenv').config();

const hostname = '0.0.0.0';
const port = 3000;

const notionSecret = process.env.NOTION_SECRET;
console.log(`Server running at http://${hostname}:${port}/ and length: ${notionSecret ? notionSecret.length : 0}`);

const server = Bun.serve({
    port,
    fetch(req) {

        return new Response(`Hello world FINAL TEST VERIFY HOT RELOAD + ${notionSecret?.length}!`);
    },
});

console.log(`Listening on ${server.url}`);