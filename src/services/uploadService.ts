import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Faz o upload de um arquivo para o Firebase Storage e retorna a URL pública.
 * @param file O arquivo a ser enviado.
 * @param path O caminho dentro do storage (ex: 'diagnosticos/protocolo123.pdf').
 */
export async function uploadFile(file: File, path: string): Promise<string> {
  try {
    const storageRef = ref(storage, path);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Erro no upload do arquivo:", error);
    throw new Error("Falha ao enviar o arquivo para o servidor.");
  }
}
