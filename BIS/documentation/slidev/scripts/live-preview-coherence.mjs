import { createHash } from 'node:crypto'

const normalize = (value) => String(value ?? '').replace(/\r\n/g, '\n').trim()

export function fingerprintEditorRecord(record) {
  const body = record?.body ?? record ?? {}
  const normalized = {
    content: normalize(body.content ?? body.slide?.content),
    note: normalize(body.note ?? body.slide?.note),
    revision: body.revision ?? body.slide?.revision ?? null,
  }
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 16)
}

export async function scanWithStableSource({ readSource, scan, attempts = 3 }) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const before = normalize(await readSource())
    const result = await scan()
    const after = normalize(await readSource())
    if (before === after) return { ...result, sourceFingerprint: createHash('sha256').update(before).digest('hex').slice(0, 16), attempts: attempt }
  }
  throw new Error(`Source changed during ${attempts} consecutive coherence scans; retry after editing stops.`)
}
