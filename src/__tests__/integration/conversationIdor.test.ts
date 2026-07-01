import mongoose from 'mongoose';
import { connectTestDB, clearTestDB, closeTestDB } from '../helpers/mongo';
import { conversationService } from '../../services/conversationService';
import { Conversation } from '../../models/conversation.model';

beforeAll(connectTestDB);
afterEach(clearTestDB);
afterAll(closeTestDB);

describe('QC-19: DM access control (getMessages)', () => {
  const makeConvo = () =>
    Conversation.create({
      callerId: new mongoose.Types.ObjectId(),
      hostId: new mongoose.Types.ObjectId(),
    });

  it('throws FORBIDDEN for a user who is not a participant', async () => {
    const convo = await makeConvo();
    const stranger = new mongoose.Types.ObjectId().toString();
    await expect(
      conversationService.getMessages(convo._id.toString(), stranger, 'caller'),
    ).rejects.toThrow('FORBIDDEN');
  });

  it('allows the caller participant to read messages', async () => {
    const convo = await makeConvo();
    const res = await conversationService.getMessages(
      convo._id.toString(),
      convo.callerId.toString(),
      'caller',
    );
    expect(res).toHaveProperty('messages');
  });

  it('throws NOT_FOUND for a non-existent conversation', async () => {
    const ghost = new mongoose.Types.ObjectId().toString();
    await expect(
      conversationService.getMessages(ghost, new mongoose.Types.ObjectId().toString(), 'caller'),
    ).rejects.toThrow('NOT_FOUND');
  });
});
