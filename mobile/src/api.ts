import { Platform } from 'react-native';

import { Usuario } from './database';

const API_URL =
  Platform.OS === 'web'
    ? process.env.EXPO_PUBLIC_API_URL_WEB ?? 'http://localhost:8080'
    : process.env.EXPO_PUBLIC_API_URL_MOBILE ?? 'http://10.0.2.2:8080';

export async function enviarUsuario(usuario: Usuario) {
  const response = await fetch(`${API_URL}/usuarios`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      id: usuario.id,
      email: usuario.email,
      senha: usuario.senha,
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Erro ao sincronizar. HTTP ${response.status}`
    );
  }

  return response.json();
}

export async function listarUsuariosRemotos() {
  const response = await fetch(`${API_URL}/usuarios`);

  if (!response.ok) {
    throw new Error(
      `Erro ao consultar API. HTTP ${response.status}`
    );
  }

  return response.json();
}

// Mantido alias para retrocompatibilidade
export const enviarPessoa = enviarUsuario;
export const listarPessoasRemotas = listarUsuariosRemotos;
