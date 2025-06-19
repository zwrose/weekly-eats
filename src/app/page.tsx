import React from 'react';
import { getMongoClient } from '../lib/mongodb';

type CollectionInfo = { name: string };

// Presentational component for displaying collections
const CollectionsList = ({ collections }: { collections: CollectionInfo[] }) => {
  if (!collections.length) {
    return <div className="text-gray-500">No collections found.</div>;
  }
  return (
    <div>
      <h2 className="text-xl text-gray-300 text-center">Collections - NonProd:</h2>
      <ul className="list-disc pl-5">
        {collections.map((col) => (
          <li key={col.name}>{col.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default async function Home() {
  let collections: CollectionInfo[] = [];
  let error = null;
  try {
    const client = await getMongoClient();
    const db = client.db();
    // Only pass serializable data (collection names)
    const rawCollections = await db.listCollections().toArray();
    collections = rawCollections.map((col: CollectionInfo) => ({ name: col.name }));
  } catch (err) {
    error = err;
  }

  // Hide collections list in Vercel production environment
  const isProd = process.env.VERCEL_ENV === 'production';

  return (
    <div className="min-h-screen bg-black grid place-items-center p-8 pb-20 font-[family-name:var(--font-geist-sans)]">
      <main className="flex flex-col gap-8 items-center">
        <h1 className="text-3xl font-bold text-center text-white">Weekly Eats: Coming Soon</h1>
        {isProd ? (
          <h2 className="text-xl text-gray-300 text-center">Come back in a bit!</h2>
        ) : error ? (
          <div className="text-red-500">Failed to load collections.</div>
        ) : (
          <CollectionsList collections={collections} />
        )}
      </main>
    </div>
  );
}
