import assert from 'node:assert/strict';
import test from 'node:test';
import { signIn } from '../services/auth.service.js';
import { ensureRiderSupportConversation, listConversationMessages, sendMessage, startConversation } from '../services/messages.service.js';
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

test('rider can open support conversation and message admin', async () => {
  const rider = (await signIn({ phone: '+911000000010', role: 'rider', password: 'Pass@123' })).user;
  const admin = (await signIn({ phone: '+911000000011', role: 'admin', password: 'Pass@123' })).user;

  const conversation = await ensureRiderSupportConversation({ riderUserId: rider.id });
  assert.ok(conversation.id);

  await sendMessage({
    conversationId: conversation.id,
    senderUserId: rider.id,
    content: 'Need help with a trip'
  });
  await sendMessage({
    conversationId: conversation.id,
    senderUserId: admin.id,
    content: 'Hi, how can we help?'
  });

  const messages = await listConversationMessages({
    conversationId: conversation.id,
    userId: rider.id
  });
  assert.equal(messages.length, 2);
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
