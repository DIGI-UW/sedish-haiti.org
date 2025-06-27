module.exports = {
  async up(db, client) {
    console.log("Adding duplicate prevention and error handling features...");

    // 1. Add indexes to laborders collection for efficient duplicate detection
    console.log("Creating indexes for duplicate detection...");
    await db.collection('laborders').createIndex(
      { labOrderId: 1, patientId: 1, facilityId: 1 },
      { name: 'duplicate_detection_idx' }
    );

    // 2. Add individual indexes for better query performance
    await db.collection('laborders').createIndex({ labOrderId: 1 });
    await db.collection('laborders').createIndex({ patientId: 1 });
    await db.collection('laborders').createIndex({ facilityId: 1 });

    // 3. Add duplicate tracking fields to existing lab orders
    console.log("Adding duplicate tracking fields to existing lab orders...");
    const labOrdersResult = await db.collection('laborders').updateMany(
      { 
        duplicateOrders: { $exists: false }
      },
      {
        $set: {
          duplicateOrders: 0,
          duplicateDocumentContents: [],
          duplicateHl7Contents: []
        }
      }
    );
    console.log(`Updated ${labOrdersResult.modifiedCount} lab orders with duplicate tracking fields.`);

    // 4. Create erroredrequests collection with proper indexes
    console.log("Creating erroredrequests collection...");
    await db.createCollection('erroredrequests');

    // 5. Create indexes for erroredrequests collection
    await db.collection('erroredrequests').createIndex({ requestId: 1 }, { unique: true });
    await db.collection('erroredrequests').createIndex({ errorType: 1 });
    await db.collection('erroredrequests').createIndex({ createdAt: 1 });
    await db.collection('erroredrequests').createIndex({ attemptedParsing: 1 });

    console.log("Duplicate prevention and error handling migration completed successfully!");
  },

  async down(db, client) {
    console.log("Rolling back duplicate prevention and error handling features...");

    // 1. Remove indexes from laborders collection
    console.log("Removing duplicate detection indexes...");
    try {
      await db.collection('laborders').dropIndex('duplicate_detection_idx');
      await db.collection('laborders').dropIndex({ labOrderId: 1 });
      await db.collection('laborders').dropIndex({ patientId: 1 });
      await db.collection('laborders').dropIndex({ facilityId: 1 });
    } catch (error) {
      console.log("Some indexes may not exist, continuing...");
    }

    // 2. Remove duplicate tracking fields from lab orders
    console.log("Removing duplicate tracking fields from lab orders...");
    const labOrdersResult = await db.collection('laborders').updateMany(
      {},
      {
        $unset: {
          duplicateOrders: "",
          duplicateDocumentContents: "",
          duplicateHl7Contents: ""
        }
      }
    );
    console.log(`Removed duplicate tracking fields from ${labOrdersResult.modifiedCount} lab orders.`);

    // 3. Drop erroredrequests collection
    console.log("Dropping erroredrequests collection...");
    try {
      await db.collection('erroredrequests').drop();
    } catch (error) {
      console.log("erroredrequests collection may not exist, continuing...");
    }

    console.log("Duplicate prevention and error handling rollback completed!");
  },
}; 