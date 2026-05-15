import nodemailer from "nodemailer";

import { env } from "../config/env";
import type { EventType, ReminderOffset } from "../models/Event";

export interface ReminderEmailPayload {
  to: string;
  petName: string;
  eventTitle: string;
  eventDate: Date;
  eventType: EventType;
  dueAt: Date;
  offset: ReminderOffset;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const formatDate = (date: Date): string =>
  new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "UTC"
  }).format(date);

const offsetLabels: Record<ReminderOffset, string> = {
  day: "за день",
  week: "за неделю",
  month: "за месяц"
};

export const sendReminderEmail = async ({
  to,
  petName,
  eventTitle,
  eventDate,
  eventType,
  dueAt,
  offset
}: ReminderEmailPayload): Promise<void> => {
  const safePetName = escapeHtml(petName);
  const safeEventTitle = escapeHtml(eventTitle);
  const safeEventType = escapeHtml(eventType);
  const formattedEventDate = formatDate(eventDate);
  const formattedDueAt = formatDate(dueAt);
  const offsetLabel = offsetLabels[offset];
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: `Команда Pawsport <${env.SMTP_FROM}>`,
    to,
    subject: `Напоминание Pawsport: ${eventTitle}`,
    text: [
      "Здравствуйте!",
      "",
      `Напоминаем о событии "${eventTitle}" для ${petName}.`,
      `Тип события: ${eventType}.`,
      `Дата события: ${formattedEventDate}.`,
      `Напоминание настроено ${offsetLabel}; срок: ${formattedDueAt}.`,
      "",
      "Если событие уже не актуально, обновите календарь Pawsport."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #202124; line-height: 1.55;">
        <h1 style="font-size: 22px; margin: 0 0 16px;">Напоминание Pawsport</h1>
        <p>Здравствуйте!</p>
        <p>Напоминаем о событии <strong>${safeEventTitle}</strong> для <strong>${safePetName}</strong>.</p>
        <p>Тип события: ${safeEventType}.</p>
        <p>Дата события: ${formattedEventDate}.</p>
        <p>Напоминание настроено ${offsetLabel}; срок: ${formattedDueAt}.</p>
        <p style="color: #5f6368;">Если событие уже не актуально, обновите календарь Pawsport.</p>
      </div>
    `
  });
};
