import { parseSnapshot, type Snapshot } from './merge';

const API = 'https://api.github.com';
export const GIST_FILE = 'zapped-data.json';
const DESCRIPTION = 'zapped · datos de la app de mecanografía (no borrar)';

export class GistError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function request(token: string, path: string, init: RequestInit = {}): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new GistError('Sin conexión con GitHub.', 0);
  }
  if (res.ok) return res;
  if (res.status === 401) throw new GistError('Token no válido o caducado.', 401);
  if (res.status === 403) throw new GistError('GitHub rechazó la petición (permisos o límite de uso).', 403);
  if (res.status === 404) throw new GistError('No se encontró el gist (¿el token tiene permiso "gist"?).', 404);
  throw new GistError(`GitHub respondió ${res.status}.`, res.status);
}

export async function verifyToken(token: string): Promise<string> {
  const res = await request(token, '/user');
  const user = (await res.json()) as { login?: string };
  return user.login ?? 'usuario';
}

interface GistFile {
  content?: string;
  truncated?: boolean;
  raw_url?: string;
}
interface GistInfo {
  id: string;
  files: Record<string, GistFile | null>;
}

/** Looks through the user's gists (secret ones included) for an existing zapped file. */
export async function findGist(token: string): Promise<string | null> {
  for (let page = 1; page <= 3; page++) {
    const res = await request(token, `/gists?per_page=100&page=${page}`);
    const list = (await res.json()) as GistInfo[];
    const hit = list.find((g) => g.files && GIST_FILE in g.files);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  return null;
}

export async function createGist(token: string, snapshot: Snapshot): Promise<string> {
  const res = await request(token, '/gists', {
    method: 'POST',
    body: JSON.stringify({
      description: DESCRIPTION,
      public: false,
      files: { [GIST_FILE]: { content: JSON.stringify(snapshot) } },
    }),
  });
  return ((await res.json()) as GistInfo).id;
}

export async function readGist(token: string, id: string): Promise<Snapshot | null> {
  const res = await request(token, `/gists/${id}`);
  const gist = (await res.json()) as GistInfo;
  const file = gist.files?.[GIST_FILE];
  if (!file) return null;
  let content = file.content;
  if ((file.truncated || content === undefined) && file.raw_url) {
    // large files come truncated; the raw URL has the full body
    content = await (await fetch(file.raw_url)).text();
  }
  if (!content) return null;
  try {
    return parseSnapshot(JSON.parse(content));
  } catch {
    throw new GistError('El gist existe pero su contenido no se puede leer.', 422);
  }
}

export async function writeGist(token: string, id: string, snapshot: Snapshot): Promise<void> {
  await request(token, `/gists/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ files: { [GIST_FILE]: { content: JSON.stringify(snapshot) } } }),
  });
}
