/**
 * MongoDB initialization script
 * Creates the billpromax database with required collections and indexes
 */

// Switch to billpromax database
db = db.getSiblingDB('billpromax');

// Create collections with validation
db.createCollection('businesses', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['name', 'ownerUserId', 'createdAt'],
      properties: {
        name: { bsonType: 'string', description: 'Business name is required' },
        ownerUserId: { bsonType: 'string', description: 'Owner user ID is required' },
        settings: { bsonType: 'object' },
        createdAt: { bsonType: 'date' },
        updatedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('users');
db.createCollection('parties');
db.createCollection('inventory');
db.createCollection('challans');
db.createCollection('bills');
db.createCollection('payments');
db.createCollection('purchases');
db.createCollection('audit_logs');
db.createCollection('sequences');

// Create indexes for businesses
db.businesses.createIndex({ ownerUserId: 1 });
db.businesses.createIndex({ name: 'text' });

// Create indexes for users
db.users.createIndex({ keycloakUserId: 1 }, { unique: true, sparse: true });
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ businessIds: 1 });

// Create indexes for parties
db.parties.createIndex({ businessId: 1 });
db.parties.createIndex({ businessId: 1, roles: 1 });
db.parties.createIndex({ businessId: 1, 'contact.email': 1 });
db.parties.createIndex({ name: 'text', 'contact.person': 'text' });

// Create indexes for inventory
db.inventory.createIndex({ businessId: 1 });
db.inventory.createIndex({ businessId: 1, category: 1 });
db.inventory.createIndex({ name: 'text', category: 'text' });

// Create indexes for challans
db.challans.createIndex({ businessId: 1 });
db.challans.createIndex({ businessId: 1, date: -1 });
db.challans.createIndex({ businessId: 1, partyId: 1 });
db.challans.createIndex({ businessId: 1, partyId: 1, type: 1 });
db.challans.createIndex({ businessId: 1, status: 1 });
db.challans.createIndex({ challanNumber: 1 }, { unique: true });

// Create indexes for bills
db.bills.createIndex({ businessId: 1 });
db.bills.createIndex({ businessId: 1, status: 1 });
db.bills.createIndex({ businessId: 1, partyId: 1 });
db.bills.createIndex({ businessId: 1, partyId: 1, status: 1 });
db.bills.createIndex({ businessId: 1, dueDate: 1, status: 1 });
db.bills.createIndex({ billNumber: 1 }, { unique: true });

// Create indexes for payments
db.payments.createIndex({ businessId: 1 });
db.payments.createIndex({ businessId: 1, billId: 1 });
db.payments.createIndex({ businessId: 1, partyId: 1 });
db.payments.createIndex({ businessId: 1, date: -1 });

// Create indexes for purchases
db.purchases.createIndex({ businessId: 1 });
db.purchases.createIndex({ businessId: 1, supplierPartyId: 1 });
db.purchases.createIndex({ businessId: 1, date: -1 });

// Create indexes for audit logs
db.audit_logs.createIndex({ businessId: 1, createdAt: -1 });
db.audit_logs.createIndex({ userId: 1, createdAt: -1 });
db.audit_logs.createIndex({ entityType: 1, entityId: 1, createdAt: -1 });

// Create sequence documents for auto-incrementing numbers
db.sequences.insertMany([
  { _id: 'challan_sequence', seq: 0 },
  { _id: 'bill_sequence', seq: 0 }
]);

print('MongoDB initialization completed successfully');
