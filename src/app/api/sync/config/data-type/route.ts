'use server'

// Placeholder — the actual [type] handler is in sync/data/[type]
export async function GET() {
  return Response.json({ error: 'Specify a data type' }, { status: 400 })
}