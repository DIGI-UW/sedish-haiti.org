import { INestApplication } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';
import { MongoMemoryServer } from 'mongodb-memory-server';
import * as request from 'supertest';
import { SubscriptionModule } from './subscription.module';

// Allow extra time for the first-run mongodb-memory-server binary download.
jest.setTimeout(60_000);

describe('Subscription CRUD (integration)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [MongooseModule.forRoot(mongod.getUri()), SubscriptionModule],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  it('round-trips a subscription through POST / GET list / GET:id / PATCH / DELETE', async () => {
    const http = request(app.getHttpServer());

    // Create
    const createRes = await http
      .post('/subscription')
      .send({ targetAddress: 'http://a.example/cb' })
      .expect(201);
    expect(createRes.body.targetAddress).toBe('http://a.example/cb');
    const id = createRes.body._id;
    expect(typeof id).toBe('string');

    // List contains it
    const listRes = await http.get('/subscription').expect(200);
    expect(Array.isArray(listRes.body)).toBe(true);
    expect(listRes.body.map((s: any) => s._id)).toContain(id);

    // Read by id
    const getRes = await http.get(`/subscription/${id}`).expect(200);
    expect(getRes.body.targetAddress).toBe('http://a.example/cb');

    // Patch
    const patchRes = await http
      .patch(`/subscription/${id}`)
      .send({ targetAddress: 'http://b.example/cb' })
      .expect(200);
    expect(patchRes.body.targetAddress).toBe('http://b.example/cb');

    // Delete
    await http.delete(`/subscription/${id}`).expect(200);

    // Now missing
    await http.get(`/subscription/${id}`).expect(404);
  });

  it('returns 400 on invalid ObjectId', async () => {
    await request(app.getHttpServer()).get('/subscription/not-an-id').expect(400);
    await request(app.getHttpServer()).delete('/subscription/not-an-id').expect(400);
    await request(app.getHttpServer())
      .patch('/subscription/not-an-id')
      .send({ targetAddress: 'http://c' })
      .expect(400);
  });

  it('returns 404 on valid-but-missing id', async () => {
    const unknown = '507f1f77bcf86cd799439011';
    await request(app.getHttpServer()).get(`/subscription/${unknown}`).expect(404);
    await request(app.getHttpServer()).delete(`/subscription/${unknown}`).expect(404);
    await request(app.getHttpServer())
      .patch(`/subscription/${unknown}`)
      .send({ targetAddress: 'http://c' })
      .expect(404);
  });

  it('rejects POST without targetAddress with 400', async () => {
    await request(app.getHttpServer())
      .post('/subscription')
      .send({})
      .expect(400);
  });
});
