
interface WhatsAppMessage {
    object: string;
    entry: [{
        id: string;
        time: number;
        changes: [{
            field: "messages" | any;
            value: {
                message: {
                    from: string;
                    id: string;
                    text: {
                        body: string;
                    };
                }
            }
        }]
    }]
}


const accessToken = process.env['FB_SECRET']

export async function sendMessage(to: string, message: string) {
    const url = `https://graph.facebook.com/v17.0/112171265246690/messages`;

    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
    };

    const payload = {
        messaging_product: 'whatsapp',
        to: to,
        type: 'template',
        template: {
            name: 'hello_world',
            language: {
                code: 'en_US',
            },
        },
    };

    try {
        const response = await axios.post(url, payload, { headers });
        console.log(response.data);
    } catch (error) {
        console.error(error);
    }
};


function handleMessage(body: WhatsAppMessage) {
    if (body.object == 'whatsapp_business_account') {
        let entry = body.entry;
        for (const m of entry[0].changes.map(c => c.value.message)) {
            console.log("Got Message", m)
        }
        return 'good';
    }
    return {
        error: 'invalid token'
    }
}