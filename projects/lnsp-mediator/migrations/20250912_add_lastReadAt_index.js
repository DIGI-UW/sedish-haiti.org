// Simple migration to create an index on lastReadAt for LabOrder

const { MongoClient } = require('mongodb');

async function run() {
  const uri = process.env.MONGO_URI || `mongodb://${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || '27017'}/${process.env.DB_NAME || 'nest'}`;
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const dbName = client.db().databaseName;
    const db = client.db(dbName);
    const collection = db.collection('laborders');
    await collection.createIndex({ lastReadAt: 1 }, { name: 'lastReadAt_1' });
    console.log('Created index lastReadAt_1 on laborders');
  } finally {
    await client.close();
  }
}

run().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});


