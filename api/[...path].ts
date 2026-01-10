import serverless from 'serverless-http';
import app from '../backend/src/index';

const handler = serverless(app);

export default async (req, res) => {
  try {
    return await handler(req, res);
  } catch (error) {
    console.error('Serverless error:', error);
    res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
};