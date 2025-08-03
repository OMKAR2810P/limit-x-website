// This is the code for your secure serverless function.
// Save this in a file named: netlify/functions/generate.js

// The Gemini API schema for the expected response
const schema = {
    type: "OBJECT",
    properties: {
        buildName: { "type": "STRING", "description": "A creative and fitting name for the PC build." },
        estimatedPrice: { "type": "STRING", "description": "The total estimated price of the build, in the currency requested by the user (e.g., INR for India)." },
        reasoning: { "type": "STRING", "description": "A brief explanation of why these components were chosen for the user's needs." },
        components: {
            type: "ARRAY",
            description: "A list of the core PC components.",
            items: {
                type: "OBJECT",
                properties: {
                    type: { "type": "STRING", "description": "The type of component (e.g., CPU, GPU, Motherboard)." },
                    name: { "type": "STRING", "description": "The specific model name of the component." }
                },
                required: ["type", "name"]
            }
        }
    },
    required: ["buildName", "estimatedPrice", "reasoning", "components"]
};

exports.handler = async function(event, context) {
    // Only allow POST requests
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, body: 'Method Not Allowed' };
    }

    try {
        // Get the user's prompt from the request body
        const { prompt } = JSON.parse(event.body);

        if (!prompt) {
            return { statusCode: 400, body: JSON.stringify({ error: 'Prompt is required.' }) };
        }
        
        // Securely get the API key from Netlify's environment variables
        const API_KEY = process.env.GEMINI_API_KEY;
        if (!API_KEY) {
             return { statusCode: 500, body: JSON.stringify({ error: 'API Key is not configured on the server.' }) };
        }

        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${API_KEY}`;

        // Construct the payload for the Gemini API
        const payload = {
            contents: [{
                parts: [{ text: `Generate a PC component list for a user based on this request: "${prompt}". Pay close attention to any mention of currency or location (like India/INR). Provide the estimated price in the user's local currency. Also give a creative name for the build, a brief reasoning for your choices, and a list of core components.` }]
            }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: schema,
            }
        };

        // Make the actual call to the Gemini API
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errorBody = await response.json();
            console.error('Google API Error:', errorBody);
            return { statusCode: response.status, body: JSON.stringify({ error: `Failed to get a response from the AI model. ${errorBody.error?.message}` }) };
        }

        const result = await response.json();
        const buildDataText = result.candidates[0].content.parts[0].text;
        
        // Return the successful response from the Gemini API back to the frontend
        return {
            statusCode: 200,
            headers: { 'Content-Type': 'application/json' },
            body: buildDataText
        };

    } catch (error) {
        console.error('Serverless function error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'An internal server error occurred.' })
        };
    }
};
