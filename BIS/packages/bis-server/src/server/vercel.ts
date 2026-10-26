import { createHostedHandler } from './hosted.ts';

let handler: ReturnType<typeof createHostedHandler> | undefined;
export async function GET(request: Request) {
  return (handler ??= createHostedHandler())(request);
}
export const POST = GET;
export const OPTIONS = GET;
