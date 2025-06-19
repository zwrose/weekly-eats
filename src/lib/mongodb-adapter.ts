import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;

if (!uri) {
  throw new Error('Please add your MongoDB URI to .env.local as MONGODB_URI');
}

const clientPromise = new MongoClient(uri).connect();

export default clientPromise; 