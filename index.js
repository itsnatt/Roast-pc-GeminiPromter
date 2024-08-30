const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();
const app = express();
const rateLimit = require('express-rate-limit');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

app.use(express.json());

// Initialize GoogleGenerativeAI instances with different API keys
const genAI1 = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_1);
const genAI2 = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_2);
const genAI3 = new GoogleGenerativeAI(process.env.GEMINI_API_KEY_3);

// Define the file path in the root directory
const filePath = path.join(__dirname, 'requests.csv');

// Initialize CSV writer
const csvWriter = createCsvWriter({
    path: filePath,
    header: [
        { id: 'timestamp', title: 'Timestamp' },
        { id: 'processor', title: 'Processor' },
        { id: 'gpu', title: 'GPU' },
        { id: 'mobo', title: 'Motherboard' },
        { id: 'psu', title: 'PSU' },
        { id: 'ram', title: 'RAM' },
        { id: 'storage', title: 'Storage' },
        { id: 'useCase', title: 'Use Case' },
        { id: 'response', title: 'Response' }
    ],
    append: true // Append to existing file if it exists
});

// Middleware to log IPs that exceed the rate limit
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 minute
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many requests from this IP, please try again after 10 minutes',
    onLimitReached: (req, res) => {
        console.log("Limit reached for IP:", req.ip);
    },
    headers: true, // Include rate limit info in the `RateLimit-*` headers
});

// Apply the rate limiter to the POST endpoint
app.post('/gate1', limiter, async (req, res) => {
    console.log("gate1");
    await processRequest(req, res, genAI1);
});

// POST endpoint for Server 2
app.post('/gate2', limiter, async (req, res) => {
    console.log("gate2");
    await processRequest(req, res, genAI2);
});

// POST endpoint for Server 3
app.post('/gate3', limiter, async (req, res) => {
    console.log("gate3");
    await processRequest(req, res, genAI3);
});

// Function to process the request and generate content
const processRequest = async (req, res, genAIInstance) => {
    const { processor, gpu, mobo, psu, ram, storage, useCase } = req.body;
    const roastingText = `
        roastingkan spek pc dengan komponen nya dibawah ini, kalu bisa buatkan dengan 1 paragraf saja dengan bahasa indonesia:
        Prosesor: ${processor}
        GPU: ${gpu}
        Motherboard: ${mobo}
        PSU: ${psu}
        RAM: ${ram}
        Storage: ${storage}
        Kegunaan: ${useCase}
    `;

    try {
        const model = genAIInstance.getGenerativeModel({ model: "gemini-1.5-flash" });
        const result = await model.generateContent(roastingText);
        const response = await result.response;
        const text = await response.text();

        // Save request and response data to CSV
        await csvWriter.writeRecords([{
            timestamp: new Date().toISOString(),
            processor: processor,
            gpu: gpu,
            mobo: mobo,
            psu: psu,
            ram: ram,
            storage: storage,
            useCase: useCase,
            response: text
        }]);

        res.json({ result: text });
    } catch (error) {
        console.log("error");
        // Respond with a JSON message and a 200 status code
        res.status(200).json({ result: 'Too many requests, please try again after 5 minutes' });
    }
};

// Start the server
const PORT = process.env.PORT || 15021;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
