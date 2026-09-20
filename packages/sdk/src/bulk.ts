import type { EmailProvider } from "./provider.js";

export interface BulkRecipient {
  email: string;
  fields: Record<string, string>;
  row: number;
}

export interface BulkSendEntry {
  email: string;
  status: "sent" | "failed";
  id?: string;
  error?: string;
}

export interface BulkSendReport {
  total: number;
  sent: number;
  failed: number;
  entries: BulkSendEntry[];
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TEMPLATE_PATTERN = /{{\s*([\w.-]+)\s*}}/g;

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (quoted) {
      if (character === '"' && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }

  if (quoted) {
    throw new Error("Recipients CSV contains an unclosed quoted field");
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((candidate) => candidate.some((value) => value.trim().length > 0));
}

export function parseBulkRecipients(csv: string): BulkRecipient[] {
  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ""));
  if (rows.length < 2) {
    throw new Error("Recipients CSV must contain a header and at least one recipient");
  }

  const headers = rows[0].map((header) => header.trim().toLowerCase());
  if (headers.some((header) => !header)) {
    throw new Error("Recipients CSV contains an empty column name");
  }
  if (new Set(headers).size !== headers.length) {
    throw new Error("Recipients CSV contains duplicate column names");
  }

  const emailIndex = headers.indexOf("email");
  if (emailIndex === -1) {
    throw new Error('Recipients CSV must contain an "email" column');
  }

  const recipients: BulkRecipient[] = [];
  const seenEmails = new Set<string>();

  for (const [index, values] of rows.slice(1).entries()) {
    const rowNumber = index + 2;
    if (values.length > headers.length) {
      throw new Error(`Recipients CSV row ${rowNumber} has more values than the header`);
    }

    const fields = Object.fromEntries(
      headers.map((header, columnIndex) => [header, values[columnIndex]?.trim() ?? ""]),
    );
    const email = fields.email.toLowerCase();

    if (!EMAIL_PATTERN.test(email)) {
      throw new Error(`Recipients CSV row ${rowNumber} has an invalid email address`);
    }
    if (seenEmails.has(email)) {
      throw new Error(`Recipients CSV row ${rowNumber} duplicates ${email}`);
    }

    seenEmails.add(email);
    recipients.push({ email, fields: { ...fields, email }, row: rowNumber });
  }

  return recipients;
}

export function renderBulkTemplate(template: string, fields: Record<string, string>): string {
  return template.replace(TEMPLATE_PATTERN, (_match, field: string) => fields[field] ?? "");
}

function wait(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

export async function sendBulkEmails(options: {
  sender: Pick<EmailProvider, "send">;
  recipients: BulkRecipient[];
  from: string;
  subject: string;
  html: string;
  ratePerSecond: number;
}): Promise<BulkSendReport> {
  const entries: BulkSendEntry[] = [];
  const delayMilliseconds = 1_000 / options.ratePerSecond;

  for (const [index, recipient] of options.recipients.entries()) {
    try {
      // Sequential sends enforce the configured rate and avoid unbounded provider concurrency.
      // eslint-disable-next-line no-await-in-loop
      const result = await options.sender.send({
        from: options.from,
        to: recipient.email,
        subject: renderBulkTemplate(options.subject, recipient.fields),
        html: renderBulkTemplate(options.html, recipient.fields),
      });
      entries.push({ email: recipient.email, status: "sent", id: result.id });
    } catch (error) {
      entries.push({
        email: recipient.email,
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
      });
    }

    if (index < options.recipients.length - 1) {
      // eslint-disable-next-line no-await-in-loop
      await wait(delayMilliseconds);
    }
  }

  const sent = entries.filter((entry) => entry.status === "sent").length;
  return {
    total: entries.length,
    sent,
    failed: entries.length - sent,
    entries,
  };
}
