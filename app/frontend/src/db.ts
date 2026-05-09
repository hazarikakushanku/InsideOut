import { Platform } from 'react-native';

let db: any = null;

if (Platform.OS !== 'web') {
  try {
    const SQLite = require('expo-sqlite');
    try {
      db = SQLite.openDatabaseSync('insideout.db');
    } catch (e) {
      db = SQLite.openDatabase('insideout.db');
    }
  } catch (err) {
    console.warn("SQLite not available");
  }
}

let webScans: any[] = [];

export const initDB = async () => {
  if (Platform.OS === 'web') {
    try {
      const saved = localStorage.getItem('TodayScans');
      if (saved) webScans = JSON.parse(saved);
    } catch (e) {}
    return;
  }
  
  if (!db) return;
  try {
    const createQuery = `
      CREATE TABLE IF NOT EXISTS TodayScans (
        id TEXT PRIMARY KEY,
        product_name TEXT,
        health_score INTEGER,
        status TEXT,
        risky_count INTEGER,
        caution_count INTEGER,
        safe_count INTEGER,
        alternatives_json TEXT,
        created_at TEXT
      );
    `;
    if (db.execAsync) await db.execAsync(createQuery);
    else {
      db.transaction((tx: any) => tx.executeSql(createQuery));
    }
  } catch (e) { console.error(e); }
};

export const saveScanToDB = async (scan: any) => {
  let risky = 0, caution = 0, safe = 0;
  scan.ingredients.forEach((ing: any) => {
    if (ing.status === 'risky') risky++;
    else if (ing.status === 'caution') caution++;
    else safe++;
  });
  const alts = JSON.stringify(scan.alternatives || []);
  const date = new Date().toISOString();

  if (Platform.OS === 'web') {
    const record = { id: scan.id, product_name: scan.product_name, health_score: scan.health_score, status: scan.overall_status, risky_count: risky, caution_count: caution, safe_count: safe, alternatives_json: alts, created_at: date };
    webScans.unshift(record);
    try { localStorage.setItem('TodayScans', JSON.stringify(webScans)); } catch(e){}
    return;
  }

  if (!db) return;
  try {
    const q = 'INSERT OR REPLACE INTO TodayScans (id, product_name, health_score, status, risky_count, caution_count, safe_count, alternatives_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const params = [scan.id, scan.product_name, scan.health_score, scan.overall_status, risky, caution, safe, alts, date];
    if (db.runAsync) await db.runAsync(q, ...params);
    else db.transaction((tx: any) => tx.executeSql(q, params));
  } catch (e) { console.error(e); }
};

export const getTodayScans = async () => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  if (Platform.OS === 'web') {
    return webScans.filter((s: any) => new Date(s.created_at) >= todayStart);
  }
  
  if (!db) return [];
  try {
    if (db.getAllAsync) {
      return await db.getAllAsync('SELECT * FROM TodayScans WHERE created_at >= ? ORDER BY created_at DESC', todayStart.toISOString());
    } else {
      return new Promise((resolve, reject) => {
        db.transaction((tx: any) => {
          tx.executeSql(
            'SELECT * FROM TodayScans WHERE created_at >= ? ORDER BY created_at DESC',
            [todayStart.toISOString()],
            (_: any, { rows }: any) => resolve(rows._array),
            (_: any, err: any) => reject(err)
          );
        });
      });
    }
  } catch (e) {
    return [];
  }
};
