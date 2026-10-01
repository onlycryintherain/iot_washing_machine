import { pgTable, text, timestamp, jsonb, integer, real, boolean, pgEnum, uniqueIndex } from 'drizzle-orm/pg-core';
export const washerState = pgEnum('washer_state', ['IDLE','RESERVED','RUNNING','MAYBE_FINISHED','FINISHED','WAITING_FOR_PICKUP']);
export const sessionStatus = pgEnum('session_status', ['RESERVED','RUNNING','FINISHED','PICKED_UP','CANCELLED']);
export const users = pgTable('users', {
  id: text('id').primaryKey(), nickname: text('nickname').notNull(), studentId: text('student_id'), userCode: text('user_code').notNull().unique(), tokenHash: text('token_hash').notNull().unique(), createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(), updatedAt: timestamp('updated_at',{withTimezone:true}).defaultNow().notNull()
});
export const washers = pgTable('washers', {
  id: text('id').primaryKey(), name: text('name').notNull(), location: text('location').notNull(), state: washerState('state').default('IDLE').notNull(), currentUserId: text('current_user_id').references(()=>users.id), reservedAt: timestamp('reserved_at',{withTimezone:true}), startedAt: timestamp('started_at',{withTimezone:true}), finishedAt: timestamp('finished_at',{withTimezone:true}), lastActivityAt: timestamp('last_activity_at',{withTimezone:true}), vibration: integer('vibration'), current: real('current'), doorOpen: boolean('door_open').default(false).notNull(), pushSentAt: timestamp('push_sent_at',{withTimezone:true}), createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(), updatedAt: timestamp('updated_at',{withTimezone:true}).defaultNow().notNull()
});
export const sessions = pgTable('laundry_sessions', {
  id: text('id').primaryKey(), washerId: text('washer_id').notNull().references(()=>washers.id), userId: text('user_id').notNull().references(()=>users.id), status: sessionStatus('status').notNull(), reservedAt: timestamp('reserved_at',{withTimezone:true}).defaultNow().notNull(), startedAt: timestamp('started_at',{withTimezone:true}), finishedAt: timestamp('finished_at',{withTimezone:true}), pickedUpAt: timestamp('picked_up_at',{withTimezone:true}), finishedNotificationSentAt: timestamp('finished_notification_sent_at',{withTimezone:true}), remindersSent: jsonb('reminders_sent').$type<number[]>().default([]).notNull(), createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(), updatedAt: timestamp('updated_at',{withTimezone:true}).defaultNow().notNull()
});
export const subscriptions = pgTable('push_subscriptions', {
  id: text('id').primaryKey(), userId: text('user_id').notNull().references(()=>users.id), endpoint: text('endpoint').notNull().unique(), p256dh: text('p256dh').notNull(), auth: text('auth').notNull(), userAgent: text('user_agent'), createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull(), updatedAt: timestamp('updated_at',{withTimezone:true}).defaultNow().notNull()
});
export const events = pgTable('washer_events', {
  id: text('id').primaryKey(), washerId: text('washer_id').notNull().references(()=>washers.id), type: text('type').notNull(), vibration: integer('vibration'), current: real('current'), doorOpen: boolean('door_open'), metadata: jsonb('metadata'), createdAt: timestamp('created_at',{withTimezone:true}).defaultNow().notNull()
});
export const reminderLog = pgTable('reminder_log', { id:text('id').primaryKey(), sessionId:text('session_id').notNull().references(()=>sessions.id), reminderMinutes:integer('reminder_minutes').notNull(), sentAt:timestamp('sent_at',{withTimezone:true}).defaultNow().notNull() }, t=>[uniqueIndex('reminder_session_minute_idx').on(t.sessionId,t.reminderMinutes)]);
