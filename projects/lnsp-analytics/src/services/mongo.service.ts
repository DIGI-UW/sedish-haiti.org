import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MongoClient, Document } from 'mongodb';

@Injectable()
export class MongoService {
  private client: MongoClient;
  private dbName: string;

  constructor(private readonly config: ConfigService) {}

  private async getClient(): Promise<MongoClient> {
    if (this.client) return this.client;
    const uri = this.config.get<string>('MONGO_URI') || 'mongodb://lnsp-mongo-1:27017';
    this.dbName = this.config.get<string>('DB_NAME') || 'nest';
    this.client = new MongoClient(uri);
    await this.client.connect();
    return this.client;
  }

  private resolveRange(from?: string, to?: string): { fromDate: Date; toDate: Date } {
    const now = new Date();
    const toDate = to && !isNaN(Date.parse(to)) ? new Date(to) : now;
    let fromDate: Date;
    if (from && !isNaN(Date.parse(from))) {
      fromDate = new Date(from);
    } else {
      fromDate = new Date(toDate.getTime());
      fromDate.setMonth(fromDate.getMonth() - 1);
    }
    return { fromDate, toDate };
  }

  private getRangeFilter(from?: string, to?: string, field: string = 'createdAt'): Document {
    const { fromDate, toDate } = this.resolveRange(from, to);
    return { [field]: { $gte: fromDate, $lte: toDate } } as Document;
  }

  async countByCreatedAt(collection: string, facilityId?: string, from?: string, to?: string) {
    const client = await this.getClient();
    const coll = client.db(this.dbName).collection(collection);
    const match: any = { ...this.getRangeFilter(from, to, 'createdAt') };
    if (facilityId) match['facilityId'] = facilityId;
    const count = await coll.countDocuments(match);
    return { value: count };
  }

  async countByDateField(collection: string, field: string, facilityId?: string, from?: string, to?: string) {
    const client = await this.getClient();
    const coll = client.db(this.dbName).collection(collection);
    const range = this.getRangeFilter(from, to, field) as any;
    const match: any = { };
    if (facilityId) match['facilityId'] = facilityId;
    match[field] = { $ne: null, ...(range[field] || {}) };
    const count = await coll.countDocuments(match);
    return { value: count };
  }

  async countBooleanFlag(collection: string, field: string, value: boolean, from?: string, to?: string) {
    const client = await this.getClient();
    const coll = client.db(this.dbName).collection(collection);
    const match: any = { [field]: value, ...this.getRangeFilter(from, to, 'createdAt') };
    const count = await coll.countDocuments(match);
    return { value: count };
  }

  async notificationsCreatedCount(facilityId?: string, from?: string, to?: string) {
    const client = await this.getClient();
    const db = client.db(this.dbName);
    const { fromDate, toDate } = this.resolveRange(from, to);
    const pipeline: Document[] = [
      { $match: { createdAt: { $gte: fromDate, $lte: toDate } } },
      { $lookup: { from: 'laborders', localField: 'documentId', foreignField: 'documentId', as: 'orders' } },
      { $unwind: { path: '$orders', preserveNullAndEmptyArrays: true } },
      ...(facilityId ? [{ $match: { 'orders.facilityId': facilityId } }] : []),
      { $count: 'value' },
    ];
    const res = await db.collection('notifications').aggregate(pipeline).toArray();
    return { value: res[0]?.value ?? 0 };
  }

  async notificationsDeliveredCount(facilityId?: string, from?: string, to?: string) {
    const client = await this.getClient();
    const db = client.db(this.dbName);
    const { fromDate, toDate } = this.resolveRange(from, to);
    const pipeline: Document[] = [
      { $match: { createdAt: { $gte: fromDate, $lte: toDate }, delivered: true } },
      { $lookup: { from: 'laborders', localField: 'documentId', foreignField: 'documentId', as: 'orders' } },
      { $unwind: { path: '$orders', preserveNullAndEmptyArrays: true } },
      ...(facilityId ? [{ $match: { 'orders.facilityId': facilityId } }] : []),
      { $count: 'value' },
    ];
    const res = await db.collection('notifications').aggregate(pipeline).toArray();
    return { value: res[0]?.value ?? 0 };
  }

  async uniqueFacilityIds(): Promise<string[]> {
    const client = await this.getClient();
    const db = client.db(this.dbName);
    const values = await db.collection('laborders').distinct('facilityId');
    return (values as string[]).filter(Boolean).sort();
  }

  async recentOrdersRead(facilityId?: string, from?: string, to?: string) {
    const client = await this.getClient();
    const coll = client.db(this.dbName).collection('laborders');
    const range = this.getRangeFilter(from, to, 'lastReadAt') as any;
    const match: any = { lastReadAt: { $ne: null, ...(range.lastReadAt || {}) } };
    if (facilityId) match['facilityId'] = facilityId;
    const cursor = coll
      .find(match, { projection: { _id: 0, documentId: 1, labOrderId: 1, facilityId: 1, lastReadAt: 1 } })
      .sort({ lastReadAt: -1 })
      .limit(100);
    return cursor.toArray();
  }

  async summary(entity: 'orders' | 'results' | 'notifications', facilityId?: string, from?: string, to?: string) {
    const client = await this.getClient();
    const db = client.db(this.dbName);
    const { fromDate, toDate } = this.resolveRange(from, to);

    if (entity === 'orders') {
      const orders = db.collection('laborders');
      const match: any = {};
      if (facilityId) match['facilityId'] = facilityId;
      match['createdAt'] = { $gte: fromDate, $lte: toDate };
      const pipeline = [
        { $match: match },
        {
          $lookup: {
            from: 'notifications',
            localField: 'documentId',
            foreignField: 'documentId',
            as: 'notifications',
          },
        },
        {
          $lookup: {
            from: 'labresults',
            localField: 'documentId',
            foreignField: 'documentId',
            as: 'results',
          },
        },
        { $unwind: { path: '$notifications', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$results', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            orderDocumentId: '$documentId',
            labOrderId: 1,
            facilityId: 1,
            orderCreatedAt: '$createdAt',
            orderLastReadAt: '$lastReadAt',
            notificationId: '$notifications._id',
            notificationLastRetryAt: '$notifications.lastRetryAt',
            resultDocumentId: '$results.documentId',
            resultCreatedAt: '$results.createdAt',
          },
        },
        { $limit: 500 },
      ];
      return orders.aggregate(pipeline).toArray();
    }

    if (entity === 'results') {
      const results = db.collection('labresults');
      const match: any = {};
      if (facilityId) match['facilityId'] = facilityId;
      match['createdAt'] = { $gte: fromDate, $lte: toDate };
      const pipeline = [
        { $match: match },
        {
          $lookup: {
            from: 'laborders',
            localField: 'documentId',
            foreignField: 'documentId',
            as: 'orders',
          },
        },
        { $unwind: { path: '$orders', preserveNullAndEmptyArrays: true } },
        {
          $lookup: {
            from: 'notifications',
            localField: 'documentId',
            foreignField: 'documentId',
            as: 'notifications',
          },
        },
        { $unwind: { path: '$notifications', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            _id: 0,
            orderDocumentId: '$orders.documentId',
            labOrderId: '$orders.labOrderId',
            facilityId: '$orders.facilityId',
            orderCreatedAt: '$orders.createdAt',
            orderLastReadAt: '$orders.lastReadAt',
            notificationId: '$notifications._id',
            notificationLastRetryAt: '$notifications.lastRetryAt',
            resultDocumentId: '$documentId',
            resultCreatedAt: '$createdAt',
          },
        },
        { $limit: 500 },
      ];
      return results.aggregate(pipeline).toArray();
    }

    // notifications
    const notifs = db.collection('notifications');
    const match: any = { createdAt: { $gte: fromDate, $lte: toDate } };
    const pipeline = [
      { $match: match },
      {
        $lookup: {
          from: 'laborders',
          localField: 'documentId',
          foreignField: 'documentId',
          as: 'orders',
        },
      },
      { $unwind: { path: '$orders', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'labresults',
          localField: 'documentId',
          foreignField: 'documentId',
          as: 'results',
        },
      },
      { $unwind: { path: '$results', preserveNullAndEmptyArrays: true } },
      ...(facilityId ? [{ $match: { 'orders.facilityId': facilityId } }] : []),
      {
        $project: {
          _id: 0,
          orderDocumentId: '$orders.documentId',
          labOrderId: '$orders.labOrderId',
          facilityId: '$orders.facilityId',
          orderCreatedAt: '$orders.createdAt',
          orderLastReadAt: '$orders.lastReadAt',
          notificationId: '$_id',
          notificationLastRetryAt: '$lastRetryAt',
          resultDocumentId: '$results.documentId',
          resultCreatedAt: '$results.createdAt',
        },
      },
      { $limit: 500 },
    ];
    return notifs.aggregate(pipeline).toArray();
  }

  // Very limited read-only passthrough. Enforces:
  // - allowed collections
  // - only find or aggregate
  // - no update/insert/delete commands
  async query(body: any) {
    const client = await this.getClient();
    const db = client.db(this.dbName);

    const allowedCollections = new Set(['laborders', 'labresults', 'notifications']);

    const { collection, type } = body || {};
    if (!collection || !allowedCollections.has(collection)) {
      return { error: 'Invalid collection' };
    }

    const coll = db.collection(collection);

    if (type === 'aggregate') {
      const pipeline = Array.isArray(body.pipeline) ? body.pipeline : [];
      // Prevent $out/$merge to enforce read-only
      const forbidden = pipeline.some((stage: any) => stage.$out || stage.$merge);
      if (forbidden) return { error: 'Forbidden stage in pipeline' };
      const limitAdded = pipeline.some((s: any) => s.$limit);
      const safePipeline = limitAdded ? pipeline : [...pipeline, { $limit: 1000 }];
      const docs = await coll.aggregate(safePipeline, { allowDiskUse: true }).toArray();
      return docs;
    }

    if (type === 'find') {
      const filter = (body.filter && typeof body.filter === 'object') ? body.filter : {};
      const projection = (body.projection && typeof body.projection === 'object') ? body.projection : {};
      const sort = (body.sort && typeof body.sort === 'object') ? body.sort : {};
      const limit = Number.isInteger(body.limit) ? Math.min(body.limit, 1000) : 500;
      const cursor = coll.find(filter, { projection }).sort(sort).limit(limit);
      return cursor.toArray();
    }

    return { error: 'Invalid type. Use aggregate or find' };
  }
}


