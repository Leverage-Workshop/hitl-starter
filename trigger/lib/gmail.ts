/**
 * Gmail intake helpers for the quote-desk RFQ task.
 *
 * Real-time path: Gmail `users.watch` publishes a change notification to a
 * Pub/Sub topic; a push subscription POSTs the wrapped message to our endpoint.
 * The pure helpers here decode that envelope and flatten a Gmail message into a
 * plain `{ from, subject, date, body }` shape — deterministic and unit-testable
 * offline. The {@link GmailClient} performs the authenticated REST calls (access
 * token supplied by the caller; OAuth/refresh is an integration concern, see
 * quote-desk-setup.md).
 */

/* ------------------------------------------------------------------ */
/* Pub/Sub push envelope                                               */
/* ------------------------------------------------------------------ */

/** Body of a Pub/Sub push POST (https://cloud.google.com/pubsub/docs/push). */
export interface PubSubPushBody {
  message?: { data?: string; messageId?: string; publishTime?: string };
  subscription?: string;
}

/** Gmail change notification carried in the Pub/Sub message `data` (base64). */
export interface GmailNotification {
  emailAddress: string;
  historyId: string;
}

/** Decode a base64url (RFC 4648 §5) string to UTF-8 text. */
export function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

/**
 * Extract the {@link GmailNotification} from a Pub/Sub push body. Throws on a
 * malformed envelope so the push endpoint can reject it with a 400.
 */
export function parsePubSubPush(body: PubSubPushBody): GmailNotification {
  const data = body?.message?.data;
  if (!data) throw new Error("Pub/Sub push body missing message.data");
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(data));
  } catch {
    throw new Error("Pub/Sub message.data is not valid base64-encoded JSON");
  }
  const note = parsed as Partial<GmailNotification>;
  if (!note || typeof note.emailAddress !== "string" || note.historyId == null) {
    throw new Error("Gmail notification missing emailAddress/historyId");
  }
  return { emailAddress: note.emailAddress, historyId: String(note.historyId) };
}

/* ------------------------------------------------------------------ */
/* Gmail message shapes (subset of the REST resource)                  */
/* ------------------------------------------------------------------ */

export interface GmailHeader {
  name: string;
  value: string;
}

export interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: GmailHeader[];
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

export interface GmailMessage {
  id: string;
  threadId?: string;
  internalDate?: string;
  snippet?: string;
  payload?: GmailPart;
}

/** Flattened, quote-desk-ready view of an inbound email. */
export interface ParsedEmail {
  messageId: string;
  threadId: string | null;
  from: string;
  subject: string;
  /** ISO-8601 received time derived from `internalDate`, or null. */
  date: string | null;
  body: string;
}

/** Case-insensitive header lookup over a message payload. */
export function getHeader(payload: GmailPart | undefined, name: string): string | null {
  const target = name.toLowerCase();
  const found = payload?.headers?.find((h) => h.name.toLowerCase() === target);
  return found ? found.value : null;
}

/** Strip tags and collapse whitespace from an HTML body. */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Extract the best plain-text body from a Gmail payload. Prefers `text/plain`;
 * falls back to a tag-stripped `text/html`. Walks nested multipart trees.
 */
export function extractPlainText(payload: GmailPart | undefined): string {
  if (!payload) return "";
  const plain = findPart(payload, "text/plain");
  if (plain?.body?.data) return decodeBase64Url(plain.body.data).trim();
  const html = findPart(payload, "text/html");
  if (html?.body?.data) return htmlToText(decodeBase64Url(html.body.data));
  // Single-part message: body sits directly on the payload.
  if (payload.body?.data && !payload.parts?.length) {
    const text = decodeBase64Url(payload.body.data);
    return payload.mimeType === "text/html" ? htmlToText(text) : text.trim();
  }
  return "";
}

function findPart(part: GmailPart, mimeType: string): GmailPart | undefined {
  if (part.mimeType === mimeType && part.body?.data) return part;
  for (const child of part.parts ?? []) {
    const hit = findPart(child, mimeType);
    if (hit) return hit;
  }
  return undefined;
}

/** Flatten a {@link GmailMessage} into a {@link ParsedEmail}. */
export function parseGmailMessage(message: GmailMessage): ParsedEmail {
  const internal = message.internalDate ? Number.parseInt(message.internalDate, 10) : NaN;
  return {
    messageId: message.id,
    threadId: message.threadId ?? null,
    from: getHeader(message.payload, "From") ?? "",
    subject: getHeader(message.payload, "Subject") ?? "",
    date: Number.isFinite(internal) ? new Date(internal).toISOString() : null,
    body: extractPlainText(message.payload),
  };
}

/* ------------------------------------------------------------------ */
/* Outbound message (quote reply — feat-017)                           */
/* ------------------------------------------------------------------ */

/** A plain-text reply to send via Gmail `users.messages.send`. */
export interface OutboundEmail {
  to: string;
  from: string;
  subject: string;
  body: string;
  /**
   * Original message's RFC 5322 `Message-ID` header value, threaded via
   * `In-Reply-To`/`References` when present. Threading is also pinned by the
   * Gmail `threadId` passed to {@link GmailClient.sendMessage}.
   */
  inReplyTo?: string | null;
}

/** Base64url-encode UTF-8 text (RFC 4648 §5), stripping `=` padding. */
function encodeBase64Url(text: string): string {
  return Buffer.from(text, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Build a base64url-encoded RFC 5322 message for `users.messages.send`. Pure and
 * unit-testable; the {@link GmailClient.sendMessage} call submits the result.
 */
export function buildRawMessage(email: OutboundEmail): string {
  const headers = [
    `To: ${email.to}`,
    `From: ${email.from}`,
    `Subject: ${email.subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
  ];
  if (email.inReplyTo) {
    headers.push(`In-Reply-To: ${email.inReplyTo}`);
    headers.push(`References: ${email.inReplyTo}`);
  }
  return encodeBase64Url(`${headers.join("\r\n")}\r\n\r\n${email.body}`);
}

/* ------------------------------------------------------------------ */
/* REST client                                                         */
/* ------------------------------------------------------------------ */

export interface GmailClientOptions {
  /**
   * OAuth2 access token. Reading needs `gmail.readonly`; sending the approved
   * quote reply (feat-017) needs `gmail.send` (see quote-desk-setup.md §5).
   */
  accessToken: string;
  /** Mailbox to operate on. Defaults to `me` (the authorized user). */
  userId?: string;
  /** Override fetch (for tests). Defaults to global `fetch`. */
  fetch?: typeof fetch;
}

export class GmailApiError extends Error {
  constructor(readonly status: number, readonly path: string, readonly body: string) {
    super(`Gmail API ${path} failed: ${status} ${body}`);
    this.name = "GmailApiError";
  }
}

const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1";

export class GmailClient {
  private readonly userId: string;
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: GmailClientOptions) {
    this.userId = options.userId ?? "me";
    this.fetchImpl = options.fetch ?? fetch;
  }

  private async get<T>(path: string): Promise<T> {
    const res = await this.fetchImpl(`${GMAIL_BASE}/users/${this.userId}${path}`, {
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new GmailApiError(res.status, path, await res.text());
    return (await res.json()) as T;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchImpl(`${GMAIL_BASE}/users/${this.userId}${path}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.options.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new GmailApiError(res.status, path, await res.text());
    return (await res.json()) as T;
  }

  /**
   * Send a built {@link buildRawMessage} payload. Passing `threadId` keeps the
   * reply on the original RFQ thread (feat-017). Needs `gmail.send` scope.
   */
  async sendMessage(params: { raw: string; threadId?: string | null }): Promise<{ id: string; threadId: string }> {
    const body: { raw: string; threadId?: string } = { raw: params.raw };
    if (params.threadId) body.threadId = params.threadId;
    return this.post<{ id: string; threadId: string }>("/messages/send", body);
  }

  /** Fetch a full message resource and flatten it for the RFQ extractor. */
  async getMessage(id: string): Promise<ParsedEmail> {
    const message = await this.get<GmailMessage>(`/messages/${encodeURIComponent(id)}?format=full`);
    return parseGmailMessage(message);
  }

  /**
   * List message ids added since `startHistoryId` (label `INBOX`). Returns the
   * de-duplicated message ids so the caller can fetch + extract each one.
   */
  async addedMessageIds(startHistoryId: string): Promise<string[]> {
    const query =
      `/history?startHistoryId=${encodeURIComponent(startHistoryId)}` +
      `&historyTypes=messageAdded&labelId=INBOX`;
    const data = await this.get<{ history?: Array<{ messagesAdded?: Array<{ message?: { id?: string } }> }> }>(
      query,
    );
    const ids = new Set<string>();
    for (const entry of data.history ?? []) {
      for (const added of entry.messagesAdded ?? []) {
        if (added.message?.id) ids.add(added.message.id);
      }
    }
    return [...ids];
  }
}
