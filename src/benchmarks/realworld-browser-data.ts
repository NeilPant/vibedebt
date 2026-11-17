import type { ApiFixture, JsonValue } from '../generic/browser/types.js';

export const api = 'https://conduit.productionready.io/api';
export const tokenKey = 'user_token_v1';
const jwt = (exp: number) => [
  Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url'),
  Buffer.from(JSON.stringify({ id: 7, username: 'boundary-user', exp })).toString('base64url'),
  'synthetic-signature',
].join('.');
export const validToken = jwt(1893456000);
export const expiredToken = jwt(1577836800);
export const image = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
export const user: JsonValue = {
  email: 'boundary@example.invalid', username: 'boundary-user', token: validToken,
  bio: 'Boundary characterization', image,
};
export const article = {
  slug: 'boundary-article', title: 'Boundary article', description: 'Controlled fixture article',
  body: 'A synthetic article body.', tagList: ['boundary'], createdAt: '2022-01-02T03:04:05.000Z',
  updatedAt: '2022-01-02T03:04:05.000Z', favorited: false, favoritesCount: 0,
  author: { username: 'fixture-author', bio: '', image, following: false },
};
export function fixture(id: string, method: string, path: string, json: JsonValue,
  token: string | null = null): ApiFixture {
  return { id, method, url: `${api}${path}`, headers: { authorization: token ? `Token ${token}` : null },
    response: { status: 200, json }, max: 8 };
}
export function homeFixtures(token: string | null): ApiFixture[] {
  return [fixture('articles', 'GET', '/articles?limit=5&skip=0', { articles: [article], articlesCount: 1 }, token),
    fixture('tags', 'GET', '/tags', { tags: ['boundary'] })];
}
export const externalAssets = [
  'http://code.ionicframework.com/ionicons/2.0.1/css/ionicons.min.css',
  'http://fonts.googleapis.com/css?family=Titillium+Web:700|Source+Serif+Pro:400,700|Merriweather+Sans:400,700|Source+Sans+Pro:400,300,600,700,300italic,400italic,600italic,700italic',
  'http://demo.productionready.io/main.css',
].map(url => ({ url, contentType: 'text/css', body: '/* deterministic harness asset */' }));
