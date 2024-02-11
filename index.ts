require('dotenv').config();
import http from 'http';

const hostname = '0.0.0.0';
const port = 3000;

const server = http.createServer((req, res) => {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Hello, World!\n');
});

server.listen(port, hostname, () => {
    const notionSecret = process.env.NOTION_SECRET;
    console.log(`Server running at http://${hostname}:${port}/ and length: ${notionSecret ? notionSecret.length : 0}`);
});
