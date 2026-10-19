import {
  listarPendentes,
  marcarComoSincronizado,
} from './database';
import { enviarUsuario } from './api';

export type ResultadoSincronizacao = {
  total: number;
  sincronizados: number;
  erros: number;
};

export async function sincronizarPendentes(): Promise<ResultadoSincronizacao> {
  const pendentes = await listarPendentes();

  let sincronizados = 0;
  let erros = 0;

  for (const usuario of pendentes) {
    try {
      await enviarUsuario(usuario);
      await marcarComoSincronizado(usuario.id);
      sincronizados++;
    } catch (error) {
      console.log(
        `Não foi possível sincronizar ${usuario.id}`,
        error
      );
      erros++;
    }
  }

  return {
    total: pendentes.length,
    sincronizados,
    erros,
  };
}
