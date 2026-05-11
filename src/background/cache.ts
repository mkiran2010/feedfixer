import type { Score } from "../shared/types";

const DB_NAME = "feedfixer";
const DB_VERSION = 1;
const STORE = "scores";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: ["videoId", "rubricVersion"] });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

export async function getScores(
  videoIds: string[],
  rubricVersion: number,
): Promise<Map<string, Score>> {
  const db = await openDb();
  const out = new Map<string, Score>();
  await Promise.all(
    videoIds.map(
      (id) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE, "readonly");
          const req = tx.objectStore(STORE).get([id, rubricVersion]);
          req.onsuccess = () => {
            const v = req.result as Score | undefined;
            if (v) out.set(id, v);
            resolve();
          };
          req.onerror = () => reject(req.error);
        }),
    ),
  );
  return out;
}

export async function putScores(scores: Score[]): Promise<void> {
  if (scores.length === 0) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    for (const s of scores) store.put(s);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearCache(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
