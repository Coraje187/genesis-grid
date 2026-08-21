// Express.js Secure Backend Proxy Pattern (TypeScript)
import express, { Request, Response } from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

// Backend endpoint keeps API keys hidden from client browser extensions
app.post('/api/generate', async (req: Request, res: Response) => {
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': Bearer {process.env.OPENAI_API_KEY} // Key never leaves backend
      },
      body: JSON.stringify(req.body)
    });
    
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to proxy request to AI provider' });
  }
});
export default app;
