/**
 * Cliente do object storage (atividade 6).
 *
 * O catalogo e o UNICO container que fala com o MinIO: o MinIO nao publica
 * porta (mesma regra do auth-service e do log-service), entao o navegador
 * nunca o alcanca. Quem entrega os bytes ao navegador e o catalogo, na rota
 * GET /api/perfil/:id/foto — a decisao "bucket privado + URL controlada"
 * esta documentada no README da atividade 6.
 *
 * O arquivo (a foto) vai para o MinIO; o MariaDB guarda so a chave
 * (`perfis/<usuarioId>/avatar-<timestamp>.<ext>`). O timestamp no nome faz a
 * URL mudar a cada upload, evitando imagem velha em cache — mesmo truque do
 * `app.js?v=3` do frontend.
 *
 * Falha de rede do MinIO NUNCA pode derrubar o catalogo: as rotas chamam
 * `enviarFoto`/`obterFoto` dentro de try/catch e devolvem 503 com mensagem
 * clara, continuando todo o resto do catalogo no ar.
 */

import { Client } from "minio";

// MINIO_ENDPOINT aceita "http://minio:9000" (rede interna do Docker) ou
// "http://127.0.0.1:9000" (dev local). O cliente precisa de host/porta
// separados e de saber se usa TLS.
const URL_RAW = (process.env.MINIO_ENDPOINT ?? "http://127.0.0.1:9000").replace(/\/+$/, "");
const useSSL = URL_RAW.startsWith("https://");
const SEM_PROTOCOLO = URL_RAW.replace(/^https?:\/\//, "");
const [endPoint, portaTexto] = SEM_PROTOCOLO.split(":");

export const MINIO_BUCKET = process.env.MINIO_BUCKET ?? "perfis";
export const TAMANHO_MAX_FOTO = 2 * 1024 * 1024; // 2 MB — "tamanho maximo razoavel"

const cliente = new Client({
  endPoint,
  port: portaTexto ? Number(portaTexto) : useSSL ? 443 : 80,
  useSSL,
  accessKey: process.env.MINIO_ROOT_USER ?? "",
  secretKey: process.env.MINIO_ROOT_PASSWORD ?? "",
});

// Certifica que o bucket existe. Chamado no boot (com retry) e antes de cada
// upload (por seguranca). Idempotente — chamar de novo nao faz estrago.
export async function garantirBucket(): Promise<void> {
  try {
    if (!(await cliente.bucketExists(MINIO_BUCKET))) {
      await cliente.makeBucket(MINIO_BUCKET, "us-east-1");
      console.log(`[minio] bucket "${MINIO_BUCKET}" criado`);
    }
  } catch (erro) {
    const motivo = erro instanceof Error ? erro.message : String(erro);
    throw new Error(`bucket inacessivel (${motivo})`);
  }
}

/** Extensoes aceitas. O `Content-Type` informado E confirmado pelos bytes. */
export type FormatoImagem = "png" | "jpg" | "gif" | "webp";

/**
 * Detecta o formato olhando os MAGIC BYTES do arquivo — nao confia so no
 * `Content-Type` do navegador, que o cliente manda do jeito que quer.
 * Devolve null para qualquer coisa que nao seja PNG/JPEG/GIF/WebP.
 */
export function detectarFormato(contentType: string, bytes: Uint8Array): FormatoImagem | null {
  const b = bytes;
  if (!contentType.startsWith("image/")) return null;

  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "png"; // \x89PNG
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg"; // \xFF\xD8\xFF
  if (b.length >= 4 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38) return "gif"; // GIF8
  if (
    b.length >= 12 &&
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && // RIFF
    b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 // WEBP
  ) {
    return "webp";
  }
  return null;
}

const CONTENT_TYPE: Record<FormatoImagem, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
};

/**
 * Envia a foto e devolve a CHAVE do objeto gravado. A chave tem timestamp
 * para nunca reutilizar a mesma URL (cache) e para dois avatares diferentes
 * do mesmo usuario coexistirem enquanto um browser ainda mostra o antigo.
 */
export async function enviarFoto(
  usuarioId: number,
  bytes: Buffer,
  formato: FormatoImagem
): Promise<string> {
  await garantirBucket();
  const chave = `perfis/${usuarioId}/avatar-${Date.now()}.${formato}`;
  await cliente.putObject(MINIO_BUCKET, chave, bytes, bytes.length, {
    "Content-Type": CONTENT_TYPE[formato],
  });
  return chave;
}

/** Apaga a foto antiga depois de um novo upload (nao acumular lixo no bucket). */
export async function removerFoto(chave: string): Promise<void> {
  try {
    await cliente.removeObject(MINIO_BUCKET, chave);
  } catch {
    // Se a foto antiga ja nao existir (ou o MinIO mudou), nao tem o que fazer.
  }
}

export type FotoLida = { bytes: Buffer; contentType: string };

/** Le os bytes do objeto. Para avatares (<= 2 MB) o buffer inteiro e ok. */
export async function obterFoto(chave: string): Promise<FotoLida | null> {
  try {
    const stat = await cliente.statObject(MINIO_BUCKET, chave);
    const stream = await cliente.getObject(MINIO_BUCKET, chave);
    const partes: Buffer[] = [];
    for await (const parte of stream as AsyncIterable<Buffer>) {
      partes.push(Buffer.from(parte));
    }
    return { bytes: Buffer.concat(partes), contentType: stat.metaData?.["content-type"] ?? "application/octet-stream" };
  } catch (erro: any) {
    if (erro?.code === "NoSuchKey" || erro?.message?.includes("NoSuchKey")) return null;
    throw erro;
  }
}