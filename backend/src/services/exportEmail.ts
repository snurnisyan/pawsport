import nodemailer from "nodemailer";

import { env } from "../config/env";

export const PET_EXPORT_PDF_CONTENT_TYPE = "application/pdf";

export interface ExportReadyEmailPayload {
  to: string;
  petName: string;
  downloadUrl: string;
  attachment: {
    filename: string;
    content: Buffer;
    contentType: string;
  };
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export const buildPetExportFilename = (petName: string): string => {
  const basename = petName.trim().replace(/[^a-z0-9_-]+/gi, "-").replace(/^-|-$/g, "");
  return `${basename || "pet"}-report.pdf`;
};

export const sendExportReadyEmail = async ({
  to,
  petName,
  downloadUrl,
  attachment
}: ExportReadyEmailPayload): Promise<void> => {
  const safePetName = escapeHtml(petName);
  const safeDownloadUrl = downloadUrl.replace(/"/g, "%22");
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
    subject: `Отчет Pawsport для ${petName} готов`,
    text: [
      "Здравствуйте!",
      "",
      `PDF-отчет Pawsport для ${petName} во вложении.`,
      `Если вложение недоступно, скачайте отчет по временной ссылке: ${downloadUrl}`,
      "",
      "Ссылка временная. Если вы не запрашивали экспорт, просто проигнорируйте это письмо."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #202124; line-height: 1.55;">
        <h1 style="font-size: 22px; margin: 0 0 16px;">Отчет Pawsport готов</h1>
        <p>Здравствуйте!</p>
        <p>PDF-отчет Pawsport для <strong>${safePetName}</strong> во вложении.</p>
        <p>Если вложение недоступно, <a href="${safeDownloadUrl}">скачайте отчет по временной ссылке</a>.</p>
        <p style="color: #5f6368;">Ссылка временная. Если вы не запрашивали экспорт, просто проигнорируйте это письмо.</p>
      </div>
    `,
    attachments: [
      {
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType
      }
    ]
  });
};
