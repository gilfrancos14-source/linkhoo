import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync, writeFileSync } from 'node:fs';

const HARNESS = 'C:/Users/USER/AppData/Local/Temp/opencode/maq4-harness.html';
const FRESH = 'C:/Users/USER/AppData/Local/Temp/opencode/maq4-harness-fresh.html';

const old = readFileSync(HARNESS, 'utf8');
const logo = old.match(/src="(data:image\/jpeg;base64,[^"]+)"/)?.[1];
if (!logo) throw new Error('logo data URI not found');

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
});

try {
  const { default: Page } = await server.ssrLoadModule('/src/pages/gerant/DemandesReservationMaq4.tsx');
  const { MarketProvider } = await server.ssrLoadModule('/src/contexts/MarketContext.tsx');
  const markup = renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: ['/ci/gerant/reservations/demandes'] },
      React.createElement(MarketProvider, null, React.createElement(Page)),
    ),
  );
  const bodyStart = old.indexOf('<body>') + '<body>'.length;
  const bodyEnd = old.indexOf('</body>');
  const fresh = `${old.slice(0, bodyStart)}${markup
    .replace('src="/logo.jpg"', `src="${logo}"`)}${old.slice(bodyEnd)}`;
  writeFileSync(FRESH, fresh);
  console.log(FRESH);
} finally {
  await server.close();
}
