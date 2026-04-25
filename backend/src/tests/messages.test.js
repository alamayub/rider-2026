import assert from 'node:assert/strict';
import test from 'node:test';
import { signIn } from '../services/auth.service.js';
import { listConversationMessages, sendMessage, startConversation } from '../services/messages.service.js';
import { registerDbHooks } from './test-db-hooks.js';

registerDbHooks();

test('rider can start conversation with driver and exchange messages', async () => {
  const rider = (await signIn({ phone: '+911000000001', role: 'rider', password: 'Pass@123' })).user;
  const driver = (await signIn({ phone: '+911000000002', role: 'driver', password: 'Pass@123' })).user;

  const conversation = await startConversation({
    initiatorUserId: rider.id,
    initiatorRole: rider.role,
    participantUserId: driver.id
  });

  const msg1 = await sendMessage({
    conversationId: conversation.id,
    senderUserId: rider.id,
    content: 'Hi, where are you?'
  });

  const msg2 = await sendMessage({
    conversationId: conversation.id,
    senderUserId: driver.id,
    content: 'Arriving in 2 mins'
  });

  const messages = await listConversationMessages({
    conversationId: conversation.id,
    userId: rider.id
  });

  assert.equal(messages.length, 2);
  assert.equal(msg1.senderUserId, rider.id);
  assert.equal(msg2.senderUserId, driver.id);
});

test('driver cannot start conversation with admin directly', async () => {
  const driver = (await signIn({ phone: '+911000000003', role: 'driver', password: 'Pass@123' })).user;
  const admin = (await signIn({ phone: '+911000000004', role: 'admin', password: 'Pass@123' })).user;

  await assert.rejects(
    () =>
      startConversation({
        initiatorUserId: driver.id,
        initiatorRole: driver.role,
        participantUserId: admin.id
      }),
    /Conversation type not allowed/
  );
});
