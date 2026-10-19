import * as SQLite from 'expo-sqlite';

export type Usuario = {
  id: string;
  email: string;
  senha?: string;
  sincronizado: number;
};

// Mantido alias para retrocompatibilidade se necessário
export type Pessoa = Usuario;

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync('offline-first.db');
  }

  return dbPromise;
}

export async function initDatabase() {
  const db = await getDatabase();

  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS usuarios (
      id TEXT PRIMARY KEY NOT NULL,
      email TEXT NOT NULL,
      senha TEXT NOT NULL,
      sincronizado INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Semente do usuário base para autenticação e testes offline
  const check = await db.getAllAsync<{ count: number }>(
    `SELECT count(*) as count FROM usuarios WHERE email = 'tecnico@fieldops.com'`
  );

  if (!check[0] || check[0].count === 0) {
    await db.runAsync(
      `INSERT INTO usuarios (id, email, senha, sincronizado)
       VALUES (?, ?, ?, 1)`,
      'user-tecnico-01',
      'tecnico@fieldops.com',
      'fieldops123'
    );
  }
}

export async function inserirUsuario(
  id: string,
  email: string,
  senha: string
) {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO usuarios (id, email, senha, sincronizado)
     VALUES (?, ?, ?, 0)`,
    id,
    email,
    senha
  );
}

export async function buscarUsuarioPorEmail(email: string) {
  const db = await getDatabase();

  return db.getFirstAsync<Usuario>(
    `SELECT id, email, senha, sincronizado
       FROM usuarios
      WHERE LOWER(email) = LOWER(?)
      ORDER BY sincronizado DESC, rowid ASC`,
    email.trim()
  );
}

export async function validarCredenciais(email: string, senha: string) {
  const db = await getDatabase();

  return db.getFirstAsync<Usuario>(
    `SELECT id, email, senha, sincronizado
       FROM usuarios
      WHERE LOWER(email) = LOWER(?) AND senha = ?
      ORDER BY sincronizado DESC, rowid ASC`,
    email.trim(),
    senha
  );
}

export async function listarUsuarios() {
  const db = await getDatabase();

  return db.getAllAsync<Usuario>(
    `SELECT id, email, sincronizado
       FROM usuarios
      ORDER BY rowid DESC`
  );
}

export async function listarPendentes() {
  const db = await getDatabase();

  return db.getAllAsync<Usuario>(
    `SELECT id, email, senha, sincronizado
       FROM usuarios
      WHERE sincronizado = 0
      ORDER BY rowid`
  );
}

export async function marcarComoSincronizado(id: string) {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE usuarios
        SET sincronizado = 1
      WHERE id = ?`,
    id
  );
}
