module.exports = {
  async up(db /*, client */) {
    // Ensure field exists (optional)
    await db.collection('laborders').updateMany(
      { lastReadAt: { $exists: false } },
      { $set: { lastReadAt: null } }
    );

    // Create index on lastReadAt for queryability
    await db.collection('laborders').createIndex({ lastReadAt: 1 }, { name: 'lastReadAt_1' });
  },

  async down(db /*, client */) {
    try {
      await db.collection('laborders').dropIndex('lastReadAt_1');
    } catch (e) {
      // ignore if index doesn't exist
    }
  },
};


