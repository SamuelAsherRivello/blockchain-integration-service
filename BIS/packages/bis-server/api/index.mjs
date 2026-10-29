export default function handler(_request, response) {
  response.status(503).send('BIS server build artifact is unavailable.');
}
