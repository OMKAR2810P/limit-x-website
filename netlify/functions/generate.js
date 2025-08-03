// This is the code for your secure serverless function.
// Save this in a file named: netlify/functions/generate.js
const fetch = require('node-fetch');

// The Gemini API schema for the expected response
// *** MODIFICATION: Added an optional 'price' field for each component ***
const schema = {
    type: "OBJECT",
    properties: {
        buildName: { "type": "STRING", "description": "A creative and fitting name for the PC build." },
        estimatedPrice: { "type": "STRING", "description": "The total estimated price of the build, in Indian Rupees (INR)." },
        reasoning: { "type": "STRING", "description": "A brief explanation of why these components were chosen for the user's needs and budget, considering Indian market prices." },
        components: {
            type: "ARRAY",
            description: "A list of the core PC components.",
            items: {
                type: "OBJECT",
                properties: {
                    type: { "type": "STRING", "description": "The type of component (e.g., CPU, GPU, Motherboard)." },
                    name: { "type": "STRING", "description": "The specific model name of the component." },
                    price: { "type": "STRING", "description": "The estimated price of the individual component in INR. Only include this if the user specifically asks for per-component pricing." }
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

        // *** THIS IS THE MODIFIED PROMPT ***
        // Added a specific instruction to handle per-component pricing requests.
        const systemInstruction = `
            You are an expert PC builder for a shop in India. 
            VERY IMPORTANT: All cost estimates and budgets MUST be in Indian Rupees (INR) and formatted like "₹1,50,000".
            If a user provides an ambiguous budget like "4k" or "80k", interpret it as Indian Rupees (e.g., ₹4,000 or ₹80,000), not USD.
            Base your component choices on availability and pricing within the Indian market.
            
            CRITICAL INSTRUCTION: If the user's request contains phrases like "price of each component", "component pricing", or "show price of each", you MUST include the estimated 'price' for each item in the components list. If the user does not ask for this, you MUST omit the 'price' field for each component.

            Now, generate a PC component list based on this user's request: "${prompt}".
        `;

        // Construct the payload for the Gemini API
        const payload = {
            contents: [{
                parts: [{ text: systemInstruction }]
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
