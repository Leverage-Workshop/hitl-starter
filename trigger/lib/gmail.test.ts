import { describe, it, expect } from 'vitest'

import {
  decodeBase64Url,
  extractPlainText,
  getHeader,
  parseGmailMessage,
  parsePubSubPush,
  type GmailMessage,
} from './gmail'

/** Encode UTF-8 text as base64url, as Gmail/Pub-Sub do on the wire. */
function b64url(text: string): string {
  return Buffer.from(text, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_')
}

describe('decodeBase64Url', () => {
  it('round-trips base64url-encoded text', () => {
    expect(decodeBase64Url(b64url('Fresno → Dallas'))).toBe('Fresno → Dallas')
  })
})

describe('parsePubSubPush', () => {
  it('decodes the Gmail notification from the envelope', () => {
    const data = b64url(JSON.stringify({ emailAddress: 'quotes@halberd-co.com', historyId: 987654 }))
    const note = parsePubSubPush({ message: { data }, subscription: 'projects/p/subscriptions/s' })
    expect(note).toEqual({ emailAddress: 'quotes@halberd-co.com', historyId: '987654' })
  })

  it('throws when message.data is missing', () => {
    expect(() => parsePubSubPush({ subscription: 's' })).toThrow(/missing message.data/)
  })

  it('throws when the decoded payload lacks required fields', () => {
    const data = b64url(JSON.stringify({ historyId: 1 }))
    expect(() => parsePubSubPush({ message: { data } })).toThrow(/emailAddress\/historyId/)
  })

  it('throws on non-JSON data', () => {
    expect(() => parsePubSubPush({ message: { data: b64url('not json') } })).toThrow(/base64/)
  })
})

describe('getHeader', () => {
  it('looks up headers case-insensitively', () => {
    const payload = { headers: [{ name: 'From', value: 'a@b.com' }] }
    expect(getHeader(payload, 'from')).toBe('a@b.com')
    expect(getHeader(payload, 'Subject')).toBeNull()
  })
})

describe('extractPlainText', () => {
  it('prefers a text/plain part', () => {
    const payload = {
      mimeType: 'multipart/alternative',
      parts: [
        { mimeType: 'text/plain', body: { data: b64url('plain body') } },
        { mimeType: 'text/html', body: { data: b64url('<p>html body</p>') } },
      ],
    }
    expect(extractPlainText(payload)).toBe('plain body')
  })

  it('falls back to stripped HTML when no plain part exists', () => {
    const payload = {
      mimeType: 'text/html',
      body: { data: b64url('<p>Hello</p><br><div>World &amp; co</div>') },
    }
    expect(extractPlainText(payload)).toBe('Hello\n\nWorld & co')
  })

  it('reads a single-part text/plain body off the payload', () => {
    const payload = { mimeType: 'text/plain', body: { data: b64url('direct body') } }
    expect(extractPlainText(payload)).toBe('direct body')
  })

  it('descends into nested multipart trees', () => {
    const payload = {
      mimeType: 'multipart/mixed',
      parts: [
        {
          mimeType: 'multipart/alternative',
          parts: [{ mimeType: 'text/plain', body: { data: b64url('nested plain') } }],
        },
        { mimeType: 'application/pdf', filename: 'rate.pdf', body: { data: b64url('PDF') } },
      ],
    }
    expect(extractPlainText(payload)).toBe('nested plain')
  })
})

describe('parseGmailMessage', () => {
  it('flattens headers, body, and internalDate', () => {
    const message: GmailMessage = {
      id: 'm1',
      threadId: 't1',
      internalDate: '1748534400000', // 2025-05-29T16:00:00Z
      payload: {
        mimeType: 'text/plain',
        headers: [
          { name: 'From', value: 'logistics@valleypack.com' },
          { name: 'Subject', value: 'Need a reefer Thu' },
        ],
        body: { data: b64url('Fresno to Dallas, ~42k produce.') },
      },
    }
    const parsed = parseGmailMessage(message)
    expect(parsed.messageId).toBe('m1')
    expect(parsed.threadId).toBe('t1')
    expect(parsed.from).toBe('logistics@valleypack.com')
    expect(parsed.subject).toBe('Need a reefer Thu')
    expect(parsed.body).toContain('Fresno to Dallas')
    expect(parsed.date).toBe('2025-05-29T16:00:00.000Z')
  })

  it('tolerates a missing thread, headers, and internalDate', () => {
    const parsed = parseGmailMessage({ id: 'm2' })
    expect(parsed.threadId).toBeNull()
    expect(parsed.from).toBe('')
    expect(parsed.subject).toBe('')
    expect(parsed.date).toBeNull()
    expect(parsed.body).toBe('')
  })
})
